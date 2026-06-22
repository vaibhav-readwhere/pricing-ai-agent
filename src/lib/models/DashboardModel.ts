import { query } from '@/lib/db/connection'
import type { AgentRun, AgentLog, Recommendation } from '@/types'

type Row = Record<string, unknown>

function parseJSON<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T } catch { return fallback }
  }
  return val as T
}

export const DashboardModel = {
  async getStats() {
    const [
      [totalSkusRow],
      [activeCompRow],
      recentRuns,
      recentRecs,
      recentActivity,
    ] = await Promise.all([
      query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM skus'),
      query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM competitors WHERE status = ?', ['active']),
      query<Row>('SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT 5'),
      query<Row>('SELECT * FROM recommendations ORDER BY created_at DESC LIMIT 5'),
      query<Row>('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 10'),
    ])

    const lastRun = recentRuns[0] ?? null
    const priceMismatches = (lastRun?.mismatches_found as number) ?? 0
    const alertsSent = (lastRun?.alerts_sent as number) ?? 0

    return {
      total_skus:             totalSkusRow?.cnt ?? 0,
      active_competitors:     activeCompRow?.cnt ?? 0,
      price_mismatches:       priceMismatches,
      alerts_sent:            alertsSent,
      last_run:               lastRun as unknown as AgentRun | null,
      recent_runs:            recentRuns as unknown as AgentRun[],
      recent_recommendations: recentRecs.map(r => ({
        ...(r as unknown as Recommendation),
        reviewed: Boolean(r.reviewed),
        applied:  Boolean(r.applied),
        competitor_data: parseJSON(r.competitor_data, []),
      })),
      recent_activity: recentActivity.map(r => ({
        ...(r as unknown as AgentLog),
        details: parseJSON(r.details, undefined),
      })),
    }
  },
}
