import { execute } from '@/lib/db/connection'
import { saveScreenshot } from '@/lib/agent/utils/screenshot'
import { launchBrowser, newStealthContext } from '@/lib/agent/utils/browser'
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
    await page.waitForTimeout(5000)

    // Try text-based click, fall back to coordinate click
    try {
      await page.locator(`text="${candidate.title.slice(0, 50)}"`).first().click({ timeout: 4000 })
    } catch {
      await page.mouse.click(candidate.position.x, candidate.position.y)
    }

    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(4000)

    // If the product has storage/color variants, click the one matching our search
    await trySelectMatchingVariant(page, searchName)

    const detailUrl = page.url()

    const filename = `detail_${sku.sku_id}_${competitor.name.replace(/\s/g, '_')}_${Date.now()}.png`
    const result = await saveScreenshot(page, filename)

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

// Tries to click a storage/color variant button matching the search name.
// Fails silently — if no matching variant is found we proceed with whatever is selected.
async function trySelectMatchingVariant(page: Page, searchName: string): Promise<void> {
  const storageMatch = searchName.match(/\b(\d+)\s*(TB|GB)\b/i)
  if (!storageMatch) return

  const num = storageMatch[1]
  const unit = storageMatch[2].toUpperCase()
  const candidates = [`${num} ${unit}`, `${num}${unit}`] // e.g. ["2 TB", "2TB"]

  for (const term of candidates) {
    try {
      const loc = page.locator(
        `li:has-text("${term}"), button:has-text("${term}"), [data-value="${term}"]`
      ).first()
      if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loc.click({ timeout: 3000 })
        await page.waitForTimeout(2500) // wait for price to update after variant switch
        return
      }
    } catch { /* not found on this site — move on */ }
  }
}
