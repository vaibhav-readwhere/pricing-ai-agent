import type { Page } from 'playwright'

// Ordered from most specific to most generic — stops on first match.
// Covers: OneTrust (Carrefour), generic accept/continue buttons and links.
const CONSENT_SELECTORS = [
  // OneTrust standard IDs (Carrefour, many other sites)
  '#onetrust-accept-btn-handler',
  '.onetrust-accept-btn-handler',
  '#accept-recommended-btn-handler',
  // Explicit "Accept All" / "Allow All" buttons
  'button:has-text("Accept All Cookies")',
  'button:has-text("Accept All")',
  'button:has-text("Allow All")',
  'button:has-text("Allow all")',
  // Carrefour Privacy Preference Center — "Continue" is an <a> link, not a button
  'a:has-text("Continue")',
  // Generic buttons
  'button:has-text("Continue")',
  'button:has-text("Accept")',
  'button:has-text("I Accept")',
  'button:has-text("Agree")',
  'button:has-text("OK")',
  'button:has-text("Save Settings")',
  'button:has-text("Confirm")',
  // Fallback attribute-based
  '[id*="accept"]:not(input)',
  '[class*="accept-btn"]',
  '[class*="cookie-accept"]',
]

/**
 * Tries to dismiss a consent/privacy popup.
 * Returns true if a popup button was found and clicked.
 */
export async function dismissConsentPopups(page: Page): Promise<boolean> {
  for (const selector of CONSENT_SELECTORS) {
    try {
      const btn = page.locator(selector).first()
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        await btn.click({ timeout: 2000 })
        await page.waitForTimeout(1000)
        return true
      }
    } catch { /* not found — try next */ }
  }
  return false
}
