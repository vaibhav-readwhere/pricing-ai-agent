import { execute } from '@/lib/db/connection'
import { saveScreenshot } from '@/lib/agent/utils/screenshot'
import { launchBrowser, newStealthContext } from '@/lib/agent/utils/browser'
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

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(5000)

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
