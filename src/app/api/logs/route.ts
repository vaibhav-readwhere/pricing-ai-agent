import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

type Row = Record<string, unknown>

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const runId   = searchParams.get('run_id')
    const level   = searchParams.get('level')
    const search  = searchParams.get('search')
    const limit   = Math.min(Number(searchParams.get('limit')) || 300, 500)

    const clauses: string[] = []
    const values: unknown[] = []

    if (runId)  { clauses.push('al.run_id = ?');         values.push(runId) }
    if (level)  { clauses.push('al.level = ?');           values.push(level) }
    if (search) { clauses.push('al.message LIKE ?');      values.push(`%${search}%`) }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const rows = await query<Row>(
      `SELECT al.id, al.run_id, al.sku_id, al.competitor_id, al.level, al.message,
              al.details, al.timestamp, s.sku_id AS sku_code
       FROM audit_logs al
       LEFT JOIN skus s ON s.id = al.sku_id
       ${where}
       ORDER BY al.timestamp DESC
       LIMIT ?`,
      [...values, limit]
    )

    const data = rows.map(r => ({
      ...r,
      details: (() => {
        if (!r.details) return null
        if (typeof r.details === 'string') {
          try { return JSON.parse(r.details) } catch { return null }
        }
        return r.details
      })(),
    }))

    return NextResponse.json({ data, total: data.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
