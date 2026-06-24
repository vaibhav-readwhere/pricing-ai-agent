import fs from 'fs'
import path from 'path'
import type { Page } from 'playwright'

export interface ScreenshotResult {
  path: string
  sizeBytes: number
  width: number
  height: number
}

export async function saveScreenshot(page: Page, filename: string): Promise<ScreenshotResult> {
  const dir = process.env.SCREENSHOT_DIR || 'public/screenshots'
  fs.mkdirSync(dir, { recursive: true })
  const fullPath = path.join(dir, filename)
  await page.screenshot({ path: fullPath })
  const stat = fs.statSync(fullPath)
  const viewport = page.viewportSize()
  return {
    path: fullPath,
    sizeBytes: stat.size,
    width: viewport?.width ?? 1440,
    height: viewport?.height ?? 900,
  }
}
