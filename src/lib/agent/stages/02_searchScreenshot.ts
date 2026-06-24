import { execute } from '@/lib/db/connection'
import { saveScreenshot } from '@/lib/agent/utils/screenshot'
import { launchBrowser, newStealthContext } from '@/lib/agent/utils/browser'
import { dismissConsentPopups } from '@/lib/agent/utils/popup'
import type { Page } from 'playwright'
import type { SKU, Competitor } from '@/types'

export interface SearchScreenshotResult {
  checkId: string
  screenshotPath: string
  searchUrl: string
}

export async function searchAndScreenshot({
  runId,
  sku,
  competitor,
  searchName,
}: {
  runId: string
  sku: SKU
  competitor: Competitor
  searchName: string
}): Promise<SearchScreenshotResult> {
  // Create the competitor_check row first so the screenshot FK is valid
  const checkId = crypto.randomUUID()
  await execute(
    `INSERT INTO competitor_checks
       (id, run_id, sku_id, competitor_id, competitor_name, our_price, status, match_confidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'needs_manual_review', 0, NOW())`,
    [checkId, runId, sku.id, competitor.id, competitor.name, sku.current_price]
  )

  const searchUrl = competitor.search_url_pattern.replace(
    '{query}',
    encodeURIComponent(searchName)
  )

  const browser = await launchBrowser()
  try {
    const context = await newStealthContext(browser)
    const page = await context.newPage()

    for (let attempt = 1; attempt <= 2; attempt++) {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
      // Wait for SPA data-fetches (Noon and others load results via XHR after DOM is ready)
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})

      const popupDismissed = await dismissConsentPopups(page)
      if (popupDismissed) {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      }

      // Some sites (e.g. Noon) show results from the URL but don't populate the search box.
      // If the search input is empty, fill it and re-submit so the box shows the query.
      await fillSearchBoxIfEmpty(page, searchName)

      if (await pageHasSearchResults(page) || attempt === 2) break
      // First attempt yielded no results — wait briefly and retry
      await page.waitForTimeout(2000)
    }

    // Scroll past promotional banners so product cards fill the screenshot frame
    await page.evaluate(() => window.scrollBy(0, 320))
    await page.waitForTimeout(400)

    const filename = `search_${sku.sku_id}_${competitor.name.replace(/\s/g, '_')}_${Date.now()}.png`
    const result = await saveScreenshot(page, filename)

    const screenshotId = crypto.randomUUID()
    await execute(
      `INSERT INTO screenshots
         (id, check_id, sku_id, competitor_id, type, storage_path, file_size_bytes, width, height, competitor_name, timestamp)
       VALUES (?, ?, ?, ?, 'search_page', ?, ?, ?, ?, ?, NOW())`,
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
      `UPDATE competitor_checks SET screenshot_search_url = ? WHERE id = ?`,
      [searchUrl, checkId]
    )

    return { checkId, screenshotPath: result.path, searchUrl }
  } finally {
    await browser.close()
  }
}

// Returns true if the page has at least one product result visible.
async function pageHasSearchResults(page: Page): Promise<boolean> {
  for (const sel of [
    'a[href*="/dp/"]',          // Amazon
    'a[href*="/p/"]',           // Noon, Carrefour
    '[data-asin]',              // Amazon
    '[class*="productCard"]',
    '[class*="product-card"]',
    '[class*="grid-item"]',
    '[data-qa="product-card"]',
  ]) {
    try {
      if (await page.locator(sel).count() > 0) return true
    } catch { /* ignore */ }
  }
  return false
}

// Some sites (e.g. Noon) render results from the URL query param but never populate
// the search input element. Filling it ensures the search box shows the term in the
// screenshot and re-submitting guarantees the results match exactly what was typed.
async function fillSearchBoxIfEmpty(page: Page, query: string): Promise<void> {
  const SEARCH_INPUT_SELECTOR =
    'input[type="search"], input[name="q"], input[name="keyword"], input[name="query"], ' +
    'input[placeholder*="ooking" i], input[placeholder*="earch" i]'
  try {
    const input = page.locator(SEARCH_INPUT_SELECTOR).first()
    if (!await input.isVisible({ timeout: 3000 }).catch(() => false)) return
    const current = await input.inputValue().catch(() => '')
    if (current.trim()) return // already populated — nothing to do
    await input.fill(query)
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      input.press('Enter'),
    ])
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  } catch { /* search input not found or interaction failed — proceed with current results */ }
}
