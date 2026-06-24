import { execute } from '@/lib/db/connection'
import { log } from '@/lib/agent/utils/logger'

export interface RunStats {
  skusProcessed: number
  competitorsChecked: number
  mismatches: number
  screenshots: number
  alertsSent: number
}

export async function finaliseRun({
  runId,
  stats,
}: {
  runId: string
  stats: RunStats
}): Promise<void> {
  await execute(
    `UPDATE agent_runs
     SET status = 'completed',
         skus_processed = ?,
         competitors_checked = ?,
         mismatches_found = ?,
         screenshots_captured = ?,
         alerts_sent = ?,
         completed_at = NOW()
     WHERE id = ?`,
    [
      stats.skusProcessed,
      stats.competitorsChecked,
      stats.mismatches,
      stats.screenshots,
      stats.alertsSent,
      runId,
    ]
  )

  await execute(
    `UPDATE skus SET last_checked = NOW()
     WHERE id IN (SELECT DISTINCT sku_id FROM competitor_checks WHERE run_id = ?)`,
    [runId]
  )

  await log('success', 'Agent run completed', stats, { runId })
}
