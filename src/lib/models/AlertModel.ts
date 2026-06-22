import { query, execute } from '@/lib/db/connection'
import type { EmailAlert } from '@/types'

type Row = Record<string, unknown>

function parseJSON<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T } catch { return fallback }
  }
  return val as T
}

function parse(row: Row): EmailAlert {
  return {
    ...(row as unknown as EmailAlert),
    preview_data: parseJSON(row.preview_data, {
      our_price: 0,
      competitor_price: 0,
      competitor_name: '',
      recommended_price: 0,
      reason: '',
    }),
  }
}

export const AlertModel = {
  async findAll(): Promise<EmailAlert[]> {
    const rows = await query<Row>(
      'SELECT * FROM email_alerts ORDER BY created_at DESC'
    )
    return rows.map(parse)
  },

  async findById(id: string): Promise<EmailAlert | null> {
    const rows = await query<Row>('SELECT * FROM email_alerts WHERE id = ?', [id])
    return rows[0] ? parse(rows[0]) : null
  },

  async resetToPending(id: string): Promise<EmailAlert | null> {
    await execute(
      `UPDATE email_alerts SET status = 'pending', error_message = NULL, sent_at = NULL WHERE id = ?`,
      [id]
    )
    return this.findById(id)
  },
}
