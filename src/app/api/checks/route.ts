import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

type Row = Record<string, unknown>

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const runId  = searchParams.get('run_id')
    const status = searchParams.get('status')

    const clauses: string[] = []
    const values: unknown[] = []

    if (runId)  { clauses.push('cc.run_id = ?');  values.push(runId) }
    if (status) { clauses.push('cc.status = ?');  values.push(status) }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const rows = await query<Row>(
      `SELECT cc.id, cc.run_id, cc.sku_id, cc.competitor_id, cc.competitor_name,
              cc.our_price, cc.competitor_price, cc.competitor_url,
              cc.discount, cc.availability, cc.delivery_fee,
              cc.status, cc.match_confidence, cc.recommended_price,
              cc.recommendation_reason, cc.screenshot_search_url,
              cc.screenshot_product_url, cc.email_sent,
              cc.error_message, cc.agent_notes, cc.created_at,
              s.sku_id AS sku_code, s.product_name AS sku_name
       FROM competitor_checks cc
       LEFT JOIN skus s ON s.id = cc.sku_id
       ${where}
       ORDER BY cc.created_at DESC
       LIMIT 300`,
      values
    )

    const data = rows.map(r => ({
      ...r,
      availability: Boolean(r.availability),
      email_sent:   Boolean(r.email_sent),
    }))

    return NextResponse.json({ data, total: data.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
