import { execute } from '@/lib/db/connection'
import { launchBrowser, newStealthContext } from '@/lib/agent/utils/browser'
import { dismissConsentPopups } from '@/lib/agent/utils/popup'
import { initGemini, parseGeminiJSON } from '@/lib/agent/utils/gemini'
import type { Page } from 'playwright'
import type { SKU, Competitor, CompetitorCheckStatus } from '@/types'

export interface FastFetchResult {
  checkId: string
  price: number | null
  status: CompetitorCheckStatus
}

/**
 * When a previous run found the exact product URL at high confidence (≥0.9),
 * skip the search + Gemini listing/detail pipeline entirely.
 * Navigate directly to the URL, parse the price from the DOM, and record the result.
 * Returns null if the DOM extraction fails (caller should fall back to full pipeline).
 */
export async function fetchCachedProductPrice({
  runId,
  sku,
  competitor,
  cachedUrl,
}: {
  runId: string
  sku: SKU
  competitor: Competitor
  cachedUrl: string
}): Promise<FastFetchResult | null> {
  const checkId = crypto.randomUUID()

  await execute(
    `INSERT INTO competitor_checks
       (id, run_id, sku_id, competitor_id, competitor_name, our_price, status, match_confidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'needs_manual_review', 0, NOW())`,
    [checkId, runId, sku.id, competitor.id, competitor.name, sku.current_price]
  )

  const browser = await launchBrowser()
  try {
    const context = await newStealthContext(browser)
    const page = await context.newPage()

    await page.goto(cachedUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})

    const popupDismissed = await dismissConsentPopups(page)
    if (popupDismissed) {
      await page.goto(cachedUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    }

    console.log(`[${sku.sku_id}] ${competitor.name}: fetching price from cached URL…`)
    const currentUrl = page.url()
    console.log(`[${sku.sku_id}] ${competitor.name}: current URL → ${currentUrl}`)
    const price = await extractPriceFromDOM(page)
    console.log(`[${sku.sku_id}] ${competitor.name}: extracted price → ${price}`)

    // If we got nothing from the DOM the URL may have changed or the product was removed;
    // signal to the caller to fall back to the full pipeline.
    if (!price) return null

    const availability = await checkAvailabilityFromDOM(page)

    let status: CompetitorCheckStatus
    if (sku.current_price > price * 1.05) {
      status = 'overpriced'
    } else if (sku.current_price < price * 0.95) {
      status = 'underpriced'
    } else {
      status = 'price_ok'
    }

    await execute(
      `UPDATE competitor_checks
       SET competitor_price = ?, competitor_url = ?, availability = ?,
           status = ?, match_confidence = 0.9
       WHERE id = ?`,
      [price, currentUrl, availability ? 1 : 0, status, checkId]
    )

    const snapshotId = crypto.randomUUID()
    await execute(
      `INSERT INTO price_snapshots (id, sku_id, competitor_id, price, availability, snapshot_url, captured_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [snapshotId, sku.id, competitor.id, price, availability ? 1 : 0, currentUrl]
    )

    return { checkId, price, status }
  } finally {
    await browser.close()
  }
}

// Extracts the selling price using three strategies in order:
//   1. Gemini text extraction    (primary — reads visible page text, understands context, ignores warranty prices)
//   2. JSON-LD structured data   (fallback — machine-readable but can include warranty/accessory schema prices)
//   3. <meta property="product:price:amount"> (last resort)
async function extractPriceFromDOM(page: Page): Promise<number | null> {
  // Strategy 1: Gemini text extraction
  try {
    const pageText = await page.evaluate(() => document.body.innerText)
    const currentUrl = page.url()
    const model = initGemini()
    const prompt =
      `Extract the current selling price of the main product from this e-commerce page text. ` +
      `Return ONLY a raw JSON object with a single key, no markdown: {"price": <number>}. ` +
      `Use the main product price — ignore warranty, protection plan, or accessory prices. ` +
      `Source URL: ${currentUrl}\n\n` +
      `--- PAGE TEXT START ---\n${pageText.slice(0, 8000)}\n--- PAGE TEXT END ---`
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const parsed = parseGeminiJSON<{ price: number }>(text)
    if (parsed?.price && parsed.price > 10) return parsed.price
  } catch { /* fall through to structural fallbacks */ }

  // Strategy 2: JSON-LD — collect ALL Product schema prices, return the maximum
  try {
    const p = await page.evaluate((): number | null => {
      let maxPrice = 0
      for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
        try {
          const data = JSON.parse(script.textContent ?? '')
          const items: unknown[] = Array.isArray(data) ? data : [data]
          for (const item of items) {
            const obj = item as Record<string, unknown>
            const graphs = ((obj['@graph'] as unknown[]) ?? []) as Record<string, unknown>[]
            const products: Record<string, unknown>[] = [
              ...(obj['@type'] === 'Product' ? [obj] : []),
              ...graphs.filter((g) => g['@type'] === 'Product'),
            ]
            for (const product of products) {
              const offers = product['offers'] as Record<string, unknown> | Record<string, unknown>[] | undefined
              const offerList: Record<string, unknown>[] = Array.isArray(offers) ? offers : (offers ? [offers] : [])
              for (const offer of offerList) {
                const price = parseFloat(String(offer['price'] ?? ''))
                if (price > maxPrice) maxPrice = price
              }
            }
          }
        } catch { /* malformed script tag */ }
      }
      return maxPrice > 10 ? maxPrice : null
    })
    if (p) return p
  } catch { /* ignore */ }

  // Strategy 3: Open Graph / meta price tag
  try {
    const p = await page.evaluate((): number | null => {
      const meta = document.querySelector<HTMLMetaElement>(
        'meta[property="product:price:amount"], meta[name="product:price:amount"]'
      )
      if (!meta?.content) return null
      const price = parseFloat(meta.content)
      return price > 10 ? price : null
    })
    if (p) return p
  } catch { /* ignore */ }

  return null
}

async function checkAvailabilityFromDOM(page: Page): Promise<boolean> {
  for (const sel of [
    '#add-to-cart-button',
    'button:has-text("Add to Cart")',
    'button:has-text("Add to cart")',
    'button:has-text("Add to Bag")',
    'button:has-text("Buy Now")',
    '[class*="addToCart"]:not([disabled])',
    '[class*="add-to-cart"]:not([disabled])',
  ]) {
    try {
      if (await page.locator(sel).count() > 0) return true
    } catch { /* ignore */ }
  }
  return false
}
