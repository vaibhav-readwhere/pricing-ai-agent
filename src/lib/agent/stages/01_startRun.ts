import { query, execute } from '@/lib/db/connection'
import type { SKU, Competitor } from '@/types'

export async function startRun({
  triggeredBy,
  userId,
  runId: preGeneratedRunId,
}: {
  triggeredBy: 'manual' | 'scheduled'
  userId?: string
  runId?: string
}): Promise<{ runId: string; skus: SKU[]; competitors: Competitor[] }> {
  const runId = preGeneratedRunId ?? crypto.randomUUID()

  await execute(
    `INSERT INTO agent_runs (id, status, triggered_by, triggered_by_user, started_at)
     VALUES (?, 'running', ?, ?, NOW())`,
    [runId, triggeredBy, userId ?? null]
  )

  type Row = Record<string, unknown>

  const skuRows = await query<Row>(`SELECT * FROM skus WHERE status = 'active'`)
  const competitorRows = await query<Row>(`SELECT * FROM competitors WHERE status = 'active'`)

  const skus: SKU[] = skuRows.map(r => ({
    ...(r as unknown as SKU),
    competitor_urls: parseJSON<string[]>(r.competitor_urls, []),
    alert_recipients: parseJSON<string[]>(r.alert_recipients, []),
  }))

  const defaultRules = { title_similarity_threshold: 0.75, brand_match_required: true, model_match_required: false }
  const competitors: Competitor[] = competitorRows.map(r => ({
    ...(r as unknown as Competitor),
    screenshot_required: Boolean(r.screenshot_required),
    matching_rules: parseJSON(r.matching_rules, defaultRules),
  }))

  await execute(`UPDATE agent_runs SET skus_total = ? WHERE id = ?`, [skus.length, runId])

  return { runId, skus, competitors }
}

function parseJSON<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T } catch { return fallback }
  }
  return val as T
}
