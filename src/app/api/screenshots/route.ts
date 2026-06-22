import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

type Row = Record<string, unknown>

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('run_id')

    const clauses: string[] = []
    const values: unknown[] = []

    if (runId) { clauses.push('cc.run_id = ?'); values.push(runId) }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const rows = await query<Row>(
      `SELECT ss.id, ss.check_id, ss.sku_id, ss.competitor_id, ss.type,
              ss.storage_path, ss.file_size_bytes, ss.width, ss.height,
              ss.competitor_name, ss.timestamp,
              s.sku_id AS sku_code, s.product_name AS sku_name
       FROM screenshots ss
       LEFT JOIN skus s ON s.id = ss.sku_id
       LEFT JOIN competitor_checks cc ON cc.id = ss.check_id
       ${where}
       ORDER BY ss.timestamp DESC
       LIMIT 200`,
      values
    )

    return NextResponse.json({ data: rows, total: rows.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
