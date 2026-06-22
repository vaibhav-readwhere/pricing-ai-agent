import { query, execute } from '@/lib/db/connection'
import type { Recommendation } from '@/types'

type Row = Record<string, unknown>

function parseJSON<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T } catch { return fallback }
  }
  return val as T
}

function toNum(v: unknown): number {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

function parse(row: Row): Recommendation {
  return {
    ...(row as unknown as Recommendation),
    reviewed:              Boolean(row.reviewed),
    applied:               Boolean(row.applied),
    competitor_data:       parseJSON(row.competitor_data, []),
    current_price:         toNum(row.current_price),
    recommended_price:     toNum(row.recommended_price),
    price_diff:            toNum(row.price_diff),
    price_diff_pct:        toNum(row.price_diff_pct),
    lowest_competitor_price:  toNum(row.lowest_competitor_price),
    highest_competitor_price: toNum(row.highest_competitor_price),
    avg_competitor_price:     toNum(row.avg_competitor_price),
  }
}

export const RecommendationModel = {
  async findAll(filters: { action?: string; status?: string } = {}): Promise<Recommendation[]> {
    const clauses: string[] = []
    const values: unknown[] = []
    if (filters.action) { clauses.push('action = ?');  values.push(filters.action) }
    if (filters.status) { clauses.push('status = ?');  values.push(filters.status) }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = await query<Row>(`SELECT * FROM recommendations ${where} ORDER BY created_at DESC`, values)
    return rows.map(parse)
  },

  async findById(id: string): Promise<Recommendation | null> {
    const rows = await query<Row>('SELECT * FROM recommendations WHERE id = ?', [id])
    return rows[0] ? parse(rows[0]) : null
  },

  async update(id: string, data: { reviewed?: boolean; applied?: boolean }): Promise<Recommendation | null> {
    const sets: string[] = []
    const values: unknown[] = []

    if (data.reviewed !== undefined) {
      sets.push('reviewed = ?')
      values.push(data.reviewed ? 1 : 0)
      if (data.reviewed) { sets.push('reviewed_at = NOW()') }
    }
    if (data.applied !== undefined) {
      sets.push('applied = ?')
      values.push(data.applied ? 1 : 0)
      if (data.applied) { sets.push('applied_at = NOW()') }
    }

    if (!sets.length) return this.findById(id)
    values.push(id)
    await execute(`UPDATE recommendations SET ${sets.join(', ')} WHERE id = ?`, values)
    return this.findById(id)
  },
}
