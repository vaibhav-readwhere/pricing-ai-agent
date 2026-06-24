import { query, execute } from '@/lib/db/connection'
import type { SKU, CompetitorCheckStatus } from '@/types'

export interface RecommendationResult {
  action: 'increase' | 'decrease' | 'maintain'
  recommended: number
  status: CompetitorCheckStatus
  reason: string
  minPrice: number
  maxPrice: number
  avgPrice: number
}

type CheckRow = {
  competitor_name: string
  competitor_price: string | number
  competitor_url: string | null
}

export async function buildRecommendation({
  runId,
  sku,
}: {
  runId: string
  sku: SKU
}): Promise<RecommendationResult | null> {
  const rows = await query<CheckRow>(
    `SELECT competitor_name, competitor_price, competitor_url
     FROM competitor_checks
     WHERE run_id = ? AND sku_id = ? AND match_confidence >= 0.75 AND competitor_price IS NOT NULL`,
    [runId, sku.id]
  )

  if (!rows.length) return null

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max)

  const prices = rows.map(r => Number(r.competitor_price))
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length
  const current = sku.current_price

  let action: 'increase' | 'decrease' | 'maintain'
  let recommended: number
  let status: CompetitorCheckStatus
  let reason: string

  if (current > maxPrice * 1.05) {
    action = 'decrease'
    recommended = clamp(Math.round(avgPrice * 0.98 * 100) / 100, sku.min_price, sku.max_price)
    status = 'overpriced'
    reason = `We are ${((current / maxPrice - 1) * 100).toFixed(1)}% above the highest competitor price (AED ${maxPrice.toFixed(2)}). Recommend reducing to AED ${recommended.toFixed(2)}.`
  } else if (current < minPrice * 0.95) {
    action = 'increase'
    recommended = clamp(Math.round(minPrice * 0.97 * 100) / 100, sku.min_price, sku.max_price)
    status = 'underpriced'
    reason = `We are ${((1 - current / minPrice) * 100).toFixed(1)}% below the lowest competitor price (AED ${minPrice.toFixed(2)}). Recommend increasing to AED ${recommended.toFixed(2)}.`
  } else {
    action = 'maintain'
    recommended = current
    status = 'price_ok'
    reason = `Price is competitive. Competitor range: AED ${minPrice.toFixed(2)} – ${maxPrice.toFixed(2)}, avg AED ${avgPrice.toFixed(2)}.`
  }

  const priceDiff = Math.abs(current - recommended)
  const priceDiffPct = Math.abs(((current - recommended) / current) * 100)

  const recId = crypto.randomUUID()
  const competitorData = rows.map(r => ({
    competitor_name: r.competitor_name,
    price: Number(r.competitor_price),
    url: r.competitor_url,
  }))

  await execute(
    `INSERT INTO recommendations
       (id, run_id, sku_id, sku_name, sku_brand, current_price, recommended_price,
        lowest_competitor_price, highest_competitor_price, avg_competitor_price,
        status, action, price_diff, price_diff_pct, competitor_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      recId,
      runId,
      sku.id,
      sku.product_name,
      sku.brand,
      current,
      recommended,
      minPrice,
      maxPrice,
      Math.round(avgPrice * 100) / 100,
      status,
      action,
      Math.round(priceDiff * 100) / 100,
      Math.round(priceDiffPct * 10000) / 10000,
      JSON.stringify(competitorData),
    ]
  )

  await execute(
    `UPDATE competitor_checks
     SET recommended_price = ?, recommendation_reason = ?
     WHERE run_id = ? AND sku_id = ?`,
    [recommended, reason, runId, sku.id]
  )

  return { action, recommended, status, reason, minPrice, maxPrice, avgPrice }
}
