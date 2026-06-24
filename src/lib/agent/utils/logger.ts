import { execute } from '@/lib/db/connection'

export async function log(
  level: 'info' | 'warn' | 'error' | 'success',
  message: string,
  details?: object,
  context?: { runId?: string; skuId?: string; competitorId?: string }
): Promise<void> {
  console.log(`[${level.toUpperCase()}] ${message}`, details ?? '')
  try {
    const id = crypto.randomUUID()
    await execute(
      `INSERT INTO audit_logs (id, run_id, sku_id, competitor_id, level, message, details, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id,
        context?.runId ?? null,
        context?.skuId ?? null,
        context?.competitorId ?? null,
        level,
        message,
        details ? JSON.stringify(details) : null,
      ]
    )
  } catch {
    // swallow — logging must never throw
  }
}
