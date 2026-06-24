import { execute } from '@/lib/db/connection'
import { saveScreenshot } from '@/lib/agent/utils/screenshot'
import { launchBrowser, newStealthContext } from '@/lib/agent/utils/browser'
import { dismissConsentPopups } from '@/lib/agent/utils/popup'
import type { Page } from 'playwright'
import type { SKU, Competitor } from '@/types'
import type { ListingCandidate } from './03_geminiListing'

export interface ClickDetailResult {
  checkId: string
  detailScreenshotPath: string
  detailUrl: string
}

export async function clickAndDetail({
  checkId,
  sku,
  competitor,
  candidate,
  searchUrl,
  searchName,
}: {
  checkId: string
  sku: SKU
  competitor: Competitor
  candidate: ListingCandidate
  searchUrl: string
  searchName: string
}): Promise<ClickDetailResult> {
  const browser = await launchBrowser()
  try {
    const context = await newStealthContext(browser)
    const page = await context.newPage()

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    // Wait for SPA product cards to render (Noon loads via XHR after DOM ready)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await dismissConsentPopups(page)

    let detailPage: Page = page
    const titleText = candidate.title.slice(0, 40).replace(/['"]/g, ' ').trim()

    // Determine the product URL pattern for this site so we only match real product links,
    // never sponsored redirect URLs (e.g. Amazon /sspa/click?... which have correct titles
    // but route to entirely different products via the ad system).
    const origin = new URL(searchUrl).origin
    const productHrefFragment = origin.includes('amazon') ? '/dp/' : '/p/'
    const productLinkSel = `a[href*="${productHrefFragment}"]:has-text("${titleText}")`

    // Strategy 1: extract href and navigate directly — avoids new-tab and coordinate-drift issues
    let navigatedDirectly = false
    try {
      const href = await page.locator(productLinkSel).first().getAttribute('href', { timeout: 3000 })
      if (href && (href.startsWith('/') || href.startsWith('http'))) {
        const fullUrl = href.startsWith('http') ? href : `${origin}${href}`
        await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
        navigatedDirectly = true
      }
    } catch { /* fall through to click strategy */ }

    if (!navigatedDirectly) {
      // Strategy 2: click, watching for a new tab (Noon opens products in new tabs)
      const newTabPromise = context.waitForEvent('page', { timeout: 6000 }).catch(() => null)

      try {
        await page.locator(`text="${candidate.title.slice(0, 50)}"`).first().click({ timeout: 4000 })
      } catch {
        await page.mouse.click(candidate.position.x, candidate.position.y)
      }

      const newTab = await newTabPromise
      if (newTab) {
        detailPage = newTab
      }
    }

    await detailPage.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {})
    await detailPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})

    const popupDismissed = await dismissConsentPopups(detailPage)
    if (popupDismissed) {
      const currentUrl = detailPage.url()
      await detailPage.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await detailPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    }

    // If the page looks empty (SPA didn't hydrate), reload once
    if (!await pageHasDetailContent(detailPage)) {
      await detailPage.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
      await detailPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    }

    await trySelectMatchingVariant(detailPage, searchName)

    // Scroll to top so the screenshot captures the price/variant section, not the specs table
    await detailPage.evaluate(() => window.scrollTo(0, 0))
    // Wait for any variant-navigation to fully settle before screenshotting
    await detailPage.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})

    const detailUrl = detailPage.url()

    const filename = `detail_${sku.sku_id}_${competitor.name.replace(/\s/g, '_')}_${Date.now()}.png`
    const result = await saveScreenshot(detailPage, filename)

    const screenshotId = crypto.randomUUID()
    await execute(
      `INSERT INTO screenshots
         (id, check_id, sku_id, competitor_id, type, storage_path, file_size_bytes, width, height, competitor_name, timestamp)
       VALUES (?, ?, ?, ?, 'product_page', ?, ?, ?, ?, ?, NOW())`,
      [
        screenshotId,
        checkId,
        sku.id,
        competitor.id,
        result.path,
        result.sizeBytes,
        result.width,
        result.height,
        competitor.name,
      ]
    )

    await execute(
      `UPDATE competitor_checks SET screenshot_product_url = ? WHERE id = ?`,
      [detailUrl, checkId]
    )

    return { checkId, detailScreenshotPath: result.path, detailUrl }
  } finally {
    await browser.close()
  }
}

// Returns true if the page has rendered a recognisable product detail (price or add-to-cart).
async function pageHasDetailContent(page: Page): Promise<boolean> {
  for (const sel of [
    '[class*="sellingPrice"]', '[class*="price"]',
    '[data-testid*="price"]', '[itemprop="price"]',
    'button:has-text("Add to Cart")', 'button:has-text("Add to cart")',
    'button:has-text("Add to Bag")', '[class*="addToCart"]',
  ]) {
    try {
      if (await page.locator(sel).count() > 0) return true
    } catch { /* ignore */ }
  }
  return false
}

// Clicks the storage and color variant that matches the search name, if selectors are found.
// Fails silently — if no matching variant button is visible we proceed with the default selection.
// On Amazon, selecting a variant navigates to a new ASIN URL, so we wait for networkidle after each click.
async function trySelectMatchingVariant(page: Page, searchName: string): Promise<void> {
  // Storage variant (e.g. "256 GB", "256GB", "2 TB")
  const storageMatch = searchName.match(/\b(\d+)\s*(TB|GB)\b/i)
  if (storageMatch) {
    const num = storageMatch[1]
    const unit = storageMatch[2].toUpperCase()
    const unitLower = unit.toLowerCase()
    // Build a flat priority list: text-match selectors first, then URL-based (Amazon data-dp-url)
    const storageSelectors = [
      `li:has-text("${num} ${unit}")`,
      `button:has-text("${num} ${unit}")`,
      `[data-value="${num} ${unit}"]`,
      `li:has-text("${num}${unit}")`,
      `button:has-text("${num}${unit}")`,
      `[data-value="${num}${unit}"]`,
      // Amazon encodes storage in the variant link's data-dp-url (e.g. "2tb", "2-tb")
      `[data-dp-url*="${num}${unitLower}"]:not([data-dp-url*="${num}${unitLower}b"])`,
      `[data-dp-url*="${num}-${unitLower}"]`,
      `[data-dp-url*="${num}_${unitLower}"]`,
    ]
    for (const sel of storageSelectors) {
      try {
        const loc = page.locator(sel).first()
        if (await loc.isVisible({ timeout: 1000 }).catch(() => false)) {
          await loc.click({ timeout: 2000 })
          // Amazon navigates to a new ASIN URL after variant selection — wait for it to settle
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
          break
        }
      } catch { /* try next selector */ }
    }
  }

  // Color variant — ordered from most specific (compound names) to least
  const COLOR_RE =
    /\b(titanium black|titanium white|titanium silver|titanium yellow|titanium gray|titanium grey|deep blue|midnight black|midnight|starlight|black|white|silver|gold|purple|pink|red|green|blue|gray|grey)\b/i
  const colorMatch = searchName.match(COLOR_RE)
  if (colorMatch) {
    const color = colorMatch[0]
    const colorSlug = color.replace(/\s/g, '-').toLowerCase()
    for (const sel of [
      `li:has-text("${color}")`,
      `button:has-text("${color}")`,
      `[aria-label*="${color}" i]`,
      `[data-dp-url*="${colorSlug}"]`,
      `img[alt*="${color}" i]`,
    ]) {
      try {
        const loc = page.locator(sel).first()
        if (await loc.isVisible({ timeout: 1000 }).catch(() => false)) {
          await loc.click({ timeout: 2000 })
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
          return
        }
      } catch { /* try next selector */ }
    }
  }
}
