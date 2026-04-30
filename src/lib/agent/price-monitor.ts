/**
 * Price Monitoring AI Agent — Cost-Optimised Orchestrator
 *
 * Optimisation strategy:
 *  1. BATCH  — 1 Browser-Use session per competitor (not per SKU)
 *  2. PARALLEL — all competitor sessions run simultaneously
 *  3. CACHE  — skip re-checking within monitoring frequency TTL
 *
 * Cost comparison:
 *  Before: 6 SKUs × 5 competitors = 30 sessions @ ~$0.24 = ~$7.20/run
 *  After:  5 competitor sessions (parallel) + cache hits = ~$2.00/run
 *  Savings: ~72% per run; more with cache warmth
 */

import type { SKU, Competitor, CompetitorCheck, Recommendation } from '@/types'
import {
  batchScrapeCompetitor,
  saveScreenshotToSupabase,
  getCacheStats,
  type ScrapedPriceResult,
} from './browser-use'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentContext {
  run_id: string
  sku: SKU
  competitor: Competitor
  log: (level: 'info' | 'warn' | 'error' | 'success', message: string, details?: Record<string, unknown>) => void
}

export interface PriceComparisonResult {
  status: CompetitorCheck['status']
  recommended_price: number
  recommendation_reason: string
  price_diff: number
  price_diff_pct: number
}

export interface AgentRunConfig {
  skus: SKU[]
  competitors: Competitor[]
  max_skus_per_run?: number
  on_log?: (log: { level: string; message: string; sku_id?: string; competitor_id?: string }) => void
  on_check_complete?: (check: Partial<CompetitorCheck>) => void
}

// ─── Price Comparison & Recommendation Logic ──────────────────────────────────

/**
 * Apply business rules to determine the recommended price action.
 */
export function computePriceRecommendation(
  sku: SKU,
  checks: Array<{ price: number; availability: boolean }>
): PriceComparisonResult {
  const available = checks.filter(c => c.availability && c.price > 0)

  if (available.length === 0) {
    return {
      status: 'competitor_out_of_stock',
      recommended_price: sku.current_price,
      recommendation_reason: 'All competitors are out of stock. Maintain current price.',
      price_diff: 0,
      price_diff_pct: 0,
    }
  }

  const prices = available.map(c => c.price)
  const minPrice = Math.min(...prices)
  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  const our = sku.current_price
  const overpriceThreshold = 5 // percent

  // We are significantly overpriced vs the cheapest competitor
  if (our > minPrice * (1 + overpriceThreshold / 100)) {
    const recommended = Math.min(
      Math.max(Math.round(minPrice * 1.02), sku.min_price),
      sku.max_price
    )
    const diff = recommended - our
    return {
      status: 'overpriced',
      recommended_price: recommended,
      recommendation_reason: `Lowest competitor is AED ${minPrice.toLocaleString()}. We are ${((our - minPrice) / minPrice * 100).toFixed(1)}% higher. Recommend reducing to AED ${recommended.toLocaleString()}.`,
      price_diff: diff,
      price_diff_pct: (diff / our) * 100,
    }
  }

  // We are below market average — opportunity to increase
  if (our < avgPrice * 0.95) {
    const recommended = Math.min(
      Math.max(Math.round(avgPrice * 0.97), sku.min_price),
      sku.max_price
    )
    if (recommended > our) {
      const diff = recommended - our
      return {
        status: 'underpriced',
        recommended_price: recommended,
        recommendation_reason: `Market average is AED ${avgPrice.toLocaleString()}. We are below market. Recommend increasing to AED ${recommended.toLocaleString()}.`,
        price_diff: diff,
        price_diff_pct: (diff / our) * 100,
      }
    }
  }

  return {
    status: 'price_ok',
    recommended_price: our,
    recommendation_reason: `Price is competitive. Lowest: AED ${minPrice.toLocaleString()}, Average: AED ${avgPrice.toLocaleString()}.`,
    price_diff: 0,
    price_diff_pct: 0,
  }
}

// ─── Email Alert ──────────────────────────────────────────────────────────────

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
  screenshot_url?: string
  timestamp: string
}

export function composeAlertEmail(
  sku: SKU,
  check: Partial<CompetitorCheck>,
  rec: Partial<Recommendation>
): AlertEmailPayload {
  const overpriced = (check.competitor_price ?? 0) < sku.current_price
  return {
    to: sku.alert_recipients,
    subject: `${overpriced ? '⚠️' : '📈'} Price Alert: ${sku.product_name} — ${overpriced ? 'overpriced' : 'opportunity'} vs ${check.competitor_name}`,
    sku_id: sku.sku_id,
    product_name: sku.product_name,
    our_price: sku.current_price,
    competitor_name: check.competitor_name ?? '',
    competitor_price: check.competitor_price ?? 0,
    competitor_url: check.competitor_url,
    recommended_price: rec.recommended_price ?? sku.current_price,
    reason: `Recommended price change to AED ${rec.recommended_price?.toLocaleString()}.`,
    screenshot_url: check.screenshot_search_url,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Send alert email via configured provider.
 * Replace with Resend/SendGrid SDK when RESEND_API_KEY is set.
 */
export async function sendAlertEmail(payload: AlertEmailPayload): Promise<{ success: boolean; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.log(`[Email PLACEHOLDER] Would send to ${payload.to.join(', ')}: ${payload.subject}`)
    return { success: true }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'PriceWatch AI <alerts@pricewatch.ai>',
        to: payload.to,
        subject: payload.subject,
        html: buildEmailHtml(payload),
      }),
    })
    if (!res.ok) return { success: false, error: await res.text() }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function buildEmailHtml(p: AlertEmailPayload): string {
  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#4f46e5">${p.subject}</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:8px;background:#f9fafb"><b>SKU</b></td><td style="padding:8px">${p.sku_id}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb"><b>Product</b></td><td style="padding:8px">${p.product_name}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb"><b>Our Price</b></td><td style="padding:8px">AED ${p.our_price.toLocaleString()}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb"><b>${p.competitor_name} Price</b></td><td style="padding:8px;color:#dc2626">AED ${p.competitor_price.toLocaleString()}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb"><b>Recommended Price</b></td><td style="padding:8px;color:#4f46e5"><b>AED ${p.recommended_price.toLocaleString()}</b></td></tr>
    <tr><td style="padding:8px;background:#f9fafb"><b>Reason</b></td><td style="padding:8px">${p.reason}</td></tr>
  </table>
  ${p.screenshot_url ? `<p><a href="${p.screenshot_url}">View screenshot proof →</a></p>` : ''}
  <p style="color:#6b7280;font-size:12px">PriceWatch AI · ${new Date(p.timestamp).toLocaleString()}</p>
</div>`
}

// ─── Main Agent Orchestrator ──────────────────────────────────────────────────

export async function runPriceMonitoringAgent(config: AgentRunConfig): Promise<{
  run_id: string
  checks: Partial<CompetitorCheck>[]
  recommendations: Partial<Recommendation>[]
  alerts_sent: number
  total_cost_usd: number
  cache_stats: { valid: number; expired: number; total: number }
  errors: string[]
}> {
  const run_id = `run-${Date.now()}`
  const checks: Partial<CompetitorCheck>[] = []
  const recommendations: Partial<Recommendation>[] = []
  const errors: string[] = []
  let alerts_sent = 0
  let total_cost_usd = 0

  const log = (level: 'info' | 'warn' | 'error' | 'success', message: string, sku_id?: string, competitor_id?: string) => {
    console.log(`[${level.toUpperCase()}] ${message}`)
    config.on_log?.({ level, message, sku_id, competitor_id })
  }

  const activeSKUs = config.skus
    .filter(s => s.status === 'active')
    .slice(0, config.max_skus_per_run ?? 50)

  const activeCompetitors = config.competitors.filter(c => c.status === 'active')

  log('info', `Agent run ${run_id} started. ${activeSKUs.length} SKUs × ${activeCompetitors.length} competitors.`)
  log('info', `Cache stats before run: ${JSON.stringify(getCacheStats())}`)

  // ── Skip live scraping if no API key (demo mode) ──────────────────────────
  if (!process.env.BROWSER_USE_API_KEY) {
    log('warn', 'BROWSER_USE_API_KEY not set — running in demo mode (no live scraping)')
    return { run_id, checks: [], recommendations: [], alerts_sent: 0, total_cost_usd: 0, cache_stats: getCacheStats(), errors: ['No API key configured'] }
  }

  // ── OPTIMISATION: 1 session per competitor, run ALL in PARALLEL ───────────
  log('info', `Starting ${activeCompetitors.length} parallel competitor sessions (1 per competitor, all SKUs batched)...`)

  const competitorBatches = await Promise.allSettled(
    activeCompetitors.map(competitor =>
      batchScrapeCompetitor({
        competitor_name: competitor.name,
        competitor_url: competitor.website_url,
        search_url_pattern: competitor.search_url_pattern,
        skus: activeSKUs.map(s => ({
          sku_id: s.id,
          product_name: s.product_name,
          brand: s.brand,
          monitoring_frequency: s.monitoring_frequency,
          min_confidence: competitor.matching_rules.title_similarity_threshold,
        })),
      })
    )
  )

  // ── Process results from each competitor batch ────────────────────────────
  // Build a map: sku_id → [all competitor results]
  const skuResultMap = new Map<string, Array<{ result: ScrapedPriceResult; competitor: Competitor }>>()
  activeSKUs.forEach(s => skuResultMap.set(s.id, []))

  for (let i = 0; i < competitorBatches.length; i++) {
    const competitor = activeCompetitors[i]
    const batch = competitorBatches[i]

    if (batch.status === 'rejected') {
      const msg = `${competitor.name} batch failed: ${batch.reason}`
      errors.push(msg)
      log('error', msg)
      continue
    }

    const { results, cost_usd, session_id, duration_ms } = batch.value
    total_cost_usd += cost_usd

    log(
      cost_usd === 0 ? 'info' : 'success',
      `${competitor.name}: ${results.filter(r => r.found).length}/${results.length} found` +
      (cost_usd > 0 ? ` — $${cost_usd.toFixed(4)} — ${Math.round(duration_ms / 1000)}s` : ' (from cache)'),
    )

    for (const result of results) {
      const sku = activeSKUs.find(s => s.id === result.sku_id)
      if (!sku) continue

      // Persist screenshot to Supabase if available
      let screenshotUrl = result.screenshot_url
      if (screenshotUrl && competitor.screenshot_required && session_id !== 'cached') {
        const saved = await saveScreenshotToSupabase(
          screenshotUrl,
          `${run_id}-${competitor.id}-${sku.id}.png`
        )
        if (saved) screenshotUrl = saved
      }

      const check: Partial<CompetitorCheck> = {
        run_id,
        sku_id: sku.id,
        competitor_id: competitor.id,
        competitor_name: competitor.name,
        our_price: sku.current_price,
        competitor_price: result.found ? result.price : null,
        availability: result.availability,
        delivery_fee: result.delivery_fee,
        competitor_url: result.product_url || undefined,
        match_confidence: result.match_confidence,
        screenshot_search_url: screenshotUrl,
        screenshot_product_url: screenshotUrl,
        status: result.found ? 'price_ok' : 'error',
        email_sent: false,
        agent_notes: result.raw_output?.slice(0, 500),
        created_at: new Date().toISOString(),
      }

      checks.push(check)
      config.on_check_complete?.(check)
      skuResultMap.get(sku.id)?.push({ result, competitor })
    }
  }

  // ── Generate recommendations per SKU ─────────────────────────────────────
  for (const sku of activeSKUs) {
    const skuChecks = skuResultMap.get(sku.id) ?? []
    const validChecks = skuChecks.filter(c => c.result.found && c.result.price > 0)

    if (validChecks.length === 0) {
      log('warn', `No valid competitor data for ${sku.product_name} — skipping recommendation`, sku.id)
      continue
    }

    const priceResult = computePriceRecommendation(
      sku,
      validChecks.map(c => ({ price: c.result.price, availability: c.result.availability }))
    )

    // Update the worst-offending check status
    const worstCheck = checks.find(
      c => c.sku_id === sku.id && c.competitor_price === Math.min(...validChecks.map(c => c.result.price))
    )
    if (worstCheck) {
      worstCheck.status = priceResult.status
      worstCheck.recommended_price = priceResult.recommended_price
      worstCheck.recommendation_reason = priceResult.recommendation_reason
    }

    const prices = validChecks.map(c => c.result.price)
    const rec: Partial<Recommendation> = {
      run_id,
      sku_id: sku.id,
      sku_name: sku.product_name,
      sku_brand: sku.brand,
      current_price: sku.current_price,
      recommended_price: priceResult.recommended_price,
      lowest_competitor_price: Math.min(...prices),
      highest_competitor_price: Math.max(...prices),
      avg_competitor_price: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      status: priceResult.status,
      action: priceResult.price_diff < -10 ? 'decrease' : priceResult.price_diff > 10 ? 'increase' : priceResult.status === 'needs_manual_review' ? 'manual_review' : 'maintain',
      price_diff: priceResult.price_diff,
      price_diff_pct: priceResult.price_diff_pct,
      competitor_data: validChecks.map(c => ({
        competitor_name: c.competitor.name,
        price: c.result.price,
        url: c.result.product_url,
      })),
      reviewed: false,
      applied: false,
      created_at: new Date().toISOString(),
    }
    recommendations.push(rec)

    // ── Send alert if mismatch found ────────────────────────────────────────
    if (
      (priceResult.status === 'overpriced' || priceResult.status === 'underpriced') &&
      sku.alert_recipients.length > 0
    ) {
      const alertPayload = composeAlertEmail(sku, worstCheck ?? {}, rec)
      const emailResult = await sendAlertEmail(alertPayload)
      if (emailResult.success) {
        alerts_sent++
        if (worstCheck) worstCheck.email_sent = true
        log('success', `Alert sent to ${sku.alert_recipients.join(', ')} for ${sku.product_name}`, sku.id)
      } else {
        errors.push(`Email failed for ${sku.product_name}: ${emailResult.error}`)
        log('error', `Alert failed: ${emailResult.error}`, sku.id)
      }
    }
  }

  const cacheStats = getCacheStats()
  log('success', `Run ${run_id} complete. Cost: $${total_cost_usd.toFixed(4)} | ${checks.length} checks | ${recommendations.length} recs | ${alerts_sent} alerts | Cache: ${cacheStats.valid} valid entries`)

  return { run_id, checks, recommendations, alerts_sent, total_cost_usd, cache_stats: cacheStats, errors }
}
