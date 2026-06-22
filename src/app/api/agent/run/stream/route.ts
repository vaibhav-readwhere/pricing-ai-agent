import { query } from '@/lib/db/connection'

type Row = Record<string, unknown>

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const runId = searchParams.get('run_id')
  if (!runId) return new Response('run_id required', { status: 400 })

  const encoder = new TextEncoder()
  const seen = new Set<string>()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch { /* client disconnected */ }
      }

      let done = false

      while (!done) {
        if (request.signal.aborted) break

        // Fetch all logs for this run, emit unseen ones
        const logs = await query<Row>(
          `SELECT id, level, message, details, timestamp, sku_id
           FROM audit_logs WHERE run_id = ? ORDER BY timestamp ASC`,
          [runId]
        ).catch(() => [] as Row[])

        for (const log of logs) {
          const id = String(log.id)
          if (!seen.has(id)) {
            seen.add(id)
            send({
              type: 'log',
              id,
              level: log.level,
              message: log.message,
              details: (() => {
                if (!log.details) return null
                if (typeof log.details === 'string') {
                  try { return JSON.parse(log.details) } catch { return null }
                }
                return log.details
              })(),
              timestamp: log.timestamp,
              sku_id: log.sku_id,
            })
          }
        }

        // Check run completion
        const runs = await query<Row>(
          `SELECT status, skus_processed, skus_total, competitors_checked,
                  mismatches_found, screenshots_captured, alerts_sent, error_message
           FROM agent_runs WHERE id = ?`,
          [runId]
        ).catch(() => [] as Row[])

        const run = runs[0]
        if (run) {
          const status = String(run.status)
          if (status === 'completed' || status === 'failed') {
            send({ type: 'done', status, run })
            done = true
          }
        }

        if (!done) await new Promise(r => setTimeout(r, 1500))
      }

      try { controller.close() } catch { /* already closed */ }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
