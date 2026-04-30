/**
 * Price Monitoring AI Agent
 *
 * Uses Browser-Use Cloud API (https://browser-use.com) for AI-powered
 * competitor scraping — no CSS selectors required.
 * Set BROWSER_USE_API_KEY in .env.local to enable live scraping.
 */

import type { SKU, Competitor, CompetitorCheck, AgentRun, Recommendation } from '@/types'
import {
  scrapeCompetitorPriceViaBrowserUse,
  saveScreenshotToSupabase,
} from './browser-use'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScrapedProduct {
  title: string
  price: number
  currency: string
  availability: boolean
  delivery_fee: number
  product_url: string
  match_confidence: number
  screenshot_search_url?: string
  screenshot_product_url?: string
}

export interface AgentContext {
  run_id: string
  sku: SKU
  competitor: Competitor
  log: (level: 'info' | 'warn' | 'error' | 'success', message: string, details?: Record<string, unknown>) => void
}

// ─── Placeholder Scraping Functions ─────────────────────────────────────────
// Replace these with real Playwright automation in production.

/**
 * PLACEHOLDER: Launch a browser session for a competitor website.
 * In production: use Playwright's chromium.launch() or connect to Browserless.
 */
async function launchBrowserSession(competitorUrl: string): Promise<{ sessionId: string }> {
  console.log(`[PLACEHOLDER] Would launch browser for: ${competitorUrl}`)
  return { sessionId: `session-${Date.now()}` }
}

/**
 * PLACEHOLDER: Search for a product on a competitor website.
 * In production: navigate to search URL, wait for results, extract product cards.
 */
async function searchCompetitorProduct(
  searchUrl: string,
  query: string,
  _sessionId: string
): Promise<{ results: Array<{ title: string; price: number; url: string; thumbnail?: string }>; screenshotPath?: string }> {
  console.log(`[PLACEHOLDER] Would search "${query}" at ${searchUrl}`)
  // Simulate network delay
  await new Promise(r => setTimeout(r, 100))
  // Return mock data — replace with real scraping
  return {
    results: [
      { title: `${query} (found on competitor)`, price: Math.round(Math.random() * 1000 + 500), url: searchUrl },
    ],
  }
}

/**
 * PLACEHOLDER: Extract product details from a competitor product page.
 * In production: navigate to product URL, extract price, availability, delivery.
 */
async function extractProductDetails(
  productUrl: string,
  priceSelector: string,
  _sessionId: string
): Promise<{ price: number; availability: boolean; delivery_fee: number; screenshotPath?: string }> {
  console.log(`[PLACEHOLDER] Would extract details from ${productUrl} using selector "${priceSelector}"`)
  await new Promise(r => setTimeout(r, 100))
  return {
    price: Math.round(Math.random() * 1000 + 500),
    availability: Math.random() > 0.1,
    delivery_fee: 0,
  }
}

/**
 * PLACEHOLDER: Calculate text similarity between two product titles.
 * In production: use a proper similarity algorithm (Levenshtein, cosine similarity, or ML model).
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const t1 = title1.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
  const t2 = title2.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
  const set1 = new Set(t1)
  const set2 = new Set(t2)
  const intersection = [...set1].filter(w => set2.has(w))
  const union = new Set([...set1, ...set2])
  return intersection.length / union.size
}

/**
 * PLACEHOLDER: Store a screenshot in Supabase Storage.
 * In production: upload the screenshot buffer to Supabase Storage and return the URL.
 */
async function storeScreenshot(
  _screenshotBuffer: Buffer | string,
  _fileName: string,
  _bucket = 'screenshots'
): Promise<string> {
  console.log(`[PLACEHOLDER] Would upload screenshot to Supabase Storage`)
  return `/screenshots/placeholder-${Date.now()}.png`
}

// ─── Core Agent Functions ────────────────────────────────────────────────────

/**
 * Find and extract the best matching product from a competitor site for a given SKU.
 * Powered by Browser-Use Cloud API — AI navigates the site and extracts data.
 * Falls back gracefully if BROWSER_USE_API_KEY is not set (returns null).
 */
export async function scrapeCompetitorPrice(ctx: AgentContext): Promise<ScrapedProduct | null> {
  const { sku, competitor, log } = ctx

  // Require API key — skip gracefully in demo/dev mode
  if (!process.env.BROWSER_USE_API_KEY) {
    log('warn', `BROWSER_USE_API_KEY not set — skipping live scrape for ${competitor.name}`)
    return null
  }

  log('info', `[Browser-Use] Visiting ${competitor.name} — searching for "${sku.product_name}"`)

  try {
    // Browser-Use AI navigates, searches, matches, and extracts — all automatically
    const result = await scrapeCompetitorPriceViaBrowserUse({
      product_name: sku.product_name,
      brand: sku.brand,
      sku_id: sku.sku_id,
      competitor_name: competitor.name,
      competitor_url: competitor.website_url,
      search_url_pattern: competitor.search_url_pattern,
      min_confidence: competitor.matching_rules.title_similarity_threshold,
    })

    if (!result.found) {
      log('warn', `[Browser-Use] No confident match on ${competitor.name}: ${result.raw_output}`)
      return null
    }

    log('success', `[Browser-Use] Found on ${competitor.name}: AED ${result.price} — "${result.product_title}" (confidence: ${(result.match_confidence * 100).toFixed(0)}%)`)

    // Save Browser-Use screenshot to Supabase Storage if available
    let screenshotUrl: string | undefined
    if (result.screenshot_url && competitor.screenshot_required) {
      const fileName = `${ctx.run_id}-${competitor.id}-${Date.now()}.png`
      screenshotUrl = (await saveScreenshotToSupabase(result.screenshot_url, fileName)) ?? result.screenshot_url
      if (screenshotUrl) log('info', `Screenshot saved: ${fileName}`)
    }

    return {
      title: result.product_title,
      price: result.price,
      currency: result.currency,
      availability: result.availability,
      delivery_fee: result.delivery_fee,
      product_url: result.product_url,
      match_confidence: result.match_confidence,
      screenshot_search_url: screenshotUrl,
      screenshot_product_url: screenshotUrl,
    }
  } catch (error) {
    log('error', `[Browser-Use] Failed for ${competitor.name}: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

// ─── Price Comparison & Recommendation Logic ─────────────────────────────────

export interface PriceComparisonResult {
  status: CompetitorCheck['status']
  recommended_price: number
  recommendation_reason: string
  price_diff: number
  price_diff_pct: number
}

/**
 * Apply business rules to determine price recommendation.
 * Rules:
 *  1. Never go below min_price
 *  2. Never exceed max_price
 *  3. Maintain minimum margin (margin_threshold %)
 *  4. If overpriced: suggest competitor_min_price + small buffer
 *  5. If underpriced: suggest increase to approach market avg
 */
export function computePriceRecommendation(
  sku: SKU,
  checks: Array<{ price: number; availability: boolean }>
): PriceComparisonResult {
  const availableChecks = checks.filter(c => c.availability && c.price > 0)

  if (availableChecks.length === 0) {
    return {
      status: 'competitor_out_of_stock',
      recommended_price: sku.current_price,
      recommendation_reason: 'All competitors are out of stock. Maintain current price.',
      price_diff: 0,
      price_diff_pct: 0,
    }
  }

  const competitorPrices = availableChecks.map(c => c.price)
  const minPrice = Math.min(...competitorPrices)
  const maxPrice = Math.max(...competitorPrices)
  const avgPrice = competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length

  const our = sku.current_price
  const priceDiffPct = ((our - minPrice) / minPrice) * 100
  const thresholdPct = 5 // alert if we're more than 5% away from market

  // We are significantly overpriced
  if (our > minPrice * (1 + thresholdPct / 100)) {
    // Recommend matching the lowest competitor price + small buffer (within floor/ceiling)
    let recommended = Math.round(minPrice * 1.02) // 2% above lowest competitor
    recommended = Math.max(recommended, sku.min_price)
    recommended = Math.min(recommended, sku.max_price)
    return {
      status: 'overpriced',
      recommended_price: recommended,
      recommendation_reason: `Lowest competitor price is AED ${minPrice.toLocaleString()}. We are ${priceDiffPct.toFixed(1)}% higher. Recommend reducing to AED ${recommended.toLocaleString()} to stay competitive while maintaining margin.`,
      price_diff: recommended - our,
      price_diff_pct: ((recommended - our) / our) * 100,
    }
  }

  // We are significantly underpriced (opportunity to increase)
  if (our < avgPrice * 0.95) {
    let recommended = Math.round(avgPrice * 0.97)
    recommended = Math.max(recommended, sku.min_price)
    recommended = Math.min(recommended, sku.max_price)
    if (recommended > our) {
      return {
        status: 'underpriced',
        recommended_price: recommended,
        recommendation_reason: `Market average is AED ${avgPrice.toLocaleString()}. We are pricing below market. Recommend increasing to AED ${recommended.toLocaleString()} to improve margin.`,
        price_diff: recommended - our,
        price_diff_pct: ((recommended - our) / our) * 100,
      }
    }
  }

  return {
    status: 'price_ok',
    recommended_price: our,
    recommendation_reason: `Price is competitive. Lowest competitor: AED ${minPrice.toLocaleString()}, Average: AED ${avgPrice.toLocaleString()}.`,
    price_diff: 0,
    price_diff_pct: 0,
  }
}

// ─── Email Alert Composition ──────────────────────────────────────────────────

export interface AlertEmailPayload {
  to: string[]
  subject: string
  sku_id: string
  product_name: string
  our_price: number
  competitor_name: string
  competitor_price: number
  competitor_url?: string
  recommended_price: number
  reason: string
  screenshot_search_url?: string
  screenshot_product_url?: string
  timestamp: string
}

export function composeAlertEmail(
  sku: SKU,
  check: Partial<CompetitorCheck>,
  rec: Partial<Recommendation>
): AlertEmailPayload {
  const isOverpriced = (check.competitor_price ?? 0) < sku.current_price
  return {
    to: sku.alert_recipients,
    subject: `${isOverpriced ? '⚠️' : '📈'} Price Alert: ${sku.product_name} — ${isOverpriced ? 'overpriced' : 'opportunity'} vs ${check.competitor_name}`,
    sku_id: sku.sku_id,
    product_name: sku.product_name,
    our_price: sku.current_price,
    competitor_name: check.competitor_name ?? '',
    competitor_price: check.competitor_price ?? 0,
    competitor_url: check.competitor_url,
    recommended_price: rec.recommended_price ?? sku.current_price,
    reason: rec.recommended_price ? `Recommended price change to AED ${rec.recommended_price.toLocaleString()}.` : 'Review recommended.',
    screenshot_search_url: check.screenshot_search_url,
    screenshot_product_url: check.screenshot_product_url,
    timestamp: new Date().toISOString(),
  }
}

/**
 * PLACEHOLDER: Send email via configured provider.
 * In production: use Nodemailer (SMTP), Resend, or SendGrid SDK.
 */
export async function sendAlertEmail(payload: AlertEmailPayload): Promise<{ success: boolean; error?: string }> {
  console.log(`[PLACEHOLDER] Would send email to ${payload.to.join(', ')}: ${payload.subject}`)
  // In production:
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // return resend.emails.send({ from: '...', to: payload.to, subject: payload.subject, html: renderEmailTemplate(payload) })
  return { success: true }
}

// ─── Main Agent Orchestrator ──────────────────────────────────────────────────

export interface AgentRunConfig {
  skus: SKU[]
  competitors: Competitor[]
  max_skus_per_run?: number
  on_log?: (log: { level: string; message: string; sku_id?: string; competitor_id?: string }) => void
  on_check_complete?: (check: Partial<CompetitorCheck>) => void
}

/**
 * Run the price monitoring agent for a set of SKUs against configured competitors.
 * This is the main orchestrator function called by the scheduled job or manual trigger.
 */
export async function runPriceMonitoringAgent(config: AgentRunConfig): Promise<{
  run_id: string
  checks: Partial<CompetitorCheck>[]
  recommendations: Partial<Recommendation>[]
  alerts_sent: number
  errors: string[]
}> {
  const run_id = `run-${Date.now()}`
  const checks: Partial<CompetitorCheck>[] = []
  const recommendations: Partial<Recommendation>[] = []
  const errors: string[] = []
  let alerts_sent = 0

  const log = (level: 'info' | 'warn' | 'error' | 'success', message: string, sku_id?: string, competitor_id?: string) => {
    console.log(`[${level.toUpperCase()}] ${message}`)
    config.on_log?.({ level, message, sku_id, competitor_id })
  }

  const skusToProcess = config.skus
    .filter(s => s.status === 'active')
    .slice(0, config.max_skus_per_run ?? 50)

  const activeCompetitors = config.competitors.filter(c => c.status === 'active')

  log('info', `Agent run ${run_id} started. Processing ${skusToProcess.length} SKUs across ${activeCompetitors.length} competitors.`)

  for (const sku of skusToProcess) {
    log('info', `Checking SKU: ${sku.product_name}`, sku.id)
    const skuChecks: Array<{ price: number; availability: boolean; competitor_name: string; check: Partial<CompetitorCheck> }> = []

    for (const competitor of activeCompetitors) {
      const ctx: AgentContext = {
        run_id,
        sku,
        competitor,
        log: (level, msg, details) => log(level, msg, sku.id, competitor.id),
      }

      const scraped = await scrapeCompetitorPrice(ctx)

      const check: Partial<CompetitorCheck> = {
        run_id,
        sku_id: sku.id,
        competitor_id: competitor.id,
        competitor_name: competitor.name,
        our_price: sku.current_price,
        competitor_price: scraped?.price ?? null,
        availability: scraped?.availability ?? false,
        delivery_fee: scraped?.delivery_fee,
        competitor_url: scraped?.product_url,
        match_confidence: scraped?.match_confidence ?? 0,
        screenshot_search_url: scraped?.screenshot_search_url,
        screenshot_product_url: scraped?.screenshot_product_url,
        status: scraped ? 'price_ok' : 'error',
        email_sent: false,
        created_at: new Date().toISOString(),
      }

      checks.push(check)
      config.on_check_complete?.(check)

      if (scraped) {
        skuChecks.push({ price: scraped.price, availability: scraped.availability, competitor_name: competitor.name, check })
      }
    }

    // Compute recommendation based on all competitor checks for this SKU
    if (skuChecks.length > 0) {
      const priceResult = computePriceRecommendation(sku, skuChecks)

      // Update check statuses
      const worstCheck = skuChecks.reduce((worst, c) => c.price < worst.price ? c : worst, skuChecks[0])
      if (worstCheck) {
        worstCheck.check.status = priceResult.status
        worstCheck.check.recommended_price = priceResult.recommended_price
        worstCheck.check.recommendation_reason = priceResult.recommendation_reason
      }

      const rec: Partial<Recommendation> = {
        run_id,
        sku_id: sku.id,
        sku_name: sku.product_name,
        sku_brand: sku.brand,
        current_price: sku.current_price,
        recommended_price: priceResult.recommended_price,
        lowest_competitor_price: Math.min(...skuChecks.map(c => c.price)),
        highest_competitor_price: Math.max(...skuChecks.map(c => c.price)),
        avg_competitor_price: Math.round(skuChecks.reduce((s, c) => s + c.price, 0) / skuChecks.length),
        status: priceResult.status,
        action: priceResult.price_diff < -10 ? 'decrease' : priceResult.price_diff > 10 ? 'increase' : priceResult.status === 'needs_manual_review' ? 'manual_review' : 'maintain',
        price_diff: priceResult.price_diff,
        price_diff_pct: priceResult.price_diff_pct,
        competitor_data: skuChecks.map(c => ({ competitor_name: c.competitor_name, price: c.price })),
        reviewed: false,
        applied: false,
        created_at: new Date().toISOString(),
      }
      recommendations.push(rec)

      // Send alert if mismatch detected
      if (priceResult.status === 'overpriced' || priceResult.status === 'underpriced') {
        if (sku.alert_recipients.length > 0) {
          const alertPayload = composeAlertEmail(sku, worstCheck.check, rec)
          const result = await sendAlertEmail(alertPayload)
          if (result.success) {
            alerts_sent++
            worstCheck.check.email_sent = true
            log('success', `Alert sent to ${sku.alert_recipients.join(', ')} for ${sku.product_name}`, sku.id)
          } else {
            errors.push(`Failed to send alert for ${sku.product_name}: ${result.error}`)
            log('error', `Alert failed: ${result.error}`, sku.id)
          }
        }
      }
    }
  }

  log('success', `Agent run ${run_id} completed. ${checks.length} checks, ${recommendations.length} recommendations, ${alerts_sent} alerts sent.`)

  return { run_id, checks, recommendations, alerts_sent, errors }
}
