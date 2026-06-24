import crypto from 'crypto'
import { query, execute } from '@/lib/db/connection'
import type { SKU } from '@/types'

type Row = Record<string, unknown>

function parse(row: Row): SKU {
  return {
    ...(row as unknown as SKU),
    competitor_urls:    parseJSON<string[]>(row.competitor_urls, []),
    alert_recipients:  parseJSON<string[]>(row.alert_recipients, []),
    // MySQL returns 0/1 for BOOLEAN — coerce
  }
}

function parseJSON<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T } catch { return fallback }
  }
  return val as T
}

export const SKUModel = {
  async findAll(filters: { status?: string; category?: string; search?: string } = {}): Promise<SKU[]> {
    const clauses: string[] = []
    const values: unknown[] = []
    if (filters.status)   { clauses.push('status = ?');    values.push(filters.status) }
    if (filters.category) { clauses.push('category = ?');  values.push(filters.category) }
    if (filters.search) {
      clauses.push('(product_name LIKE ? OR sku_id LIKE ? OR brand LIKE ?)')
      const like = `%${filters.search}%`
      values.push(like, like, like)
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = await query<Row>(`SELECT * FROM skus ${where} ORDER BY created_at DESC`, values)
    return rows.map(parse)
  },

  async findById(id: string): Promise<SKU | null> {
    const rows = await query<Row>('SELECT * FROM skus WHERE id = ?', [id])
    return rows[0] ? parse(rows[0]) : null
  },

  async create(data: Omit<Partial<SKU>, 'id' | 'created_at' | 'updated_at'>): Promise<SKU> {
    const id = crypto.randomUUID()
    await execute(
      `INSERT INTO skus
         (id, sku_id, product_name, brand, category, current_price, product_url, image_url,
          target_marketplace, competitor_urls, min_price, max_price, margin_threshold,
          alert_recipients, status, monitoring_frequency, custom_cron)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        data.sku_id,
        data.product_name,
        data.brand ?? '',
        data.category ?? null,
        Number(data.current_price),
        data.product_url ?? null,
        data.image_url ?? null,
        data.target_marketplace ?? 'UAE',
        JSON.stringify(data.competitor_urls ?? []),
        Number(data.min_price ?? 0),
        Number(data.max_price ?? 0),
        Number(data.margin_threshold ?? 8),
        JSON.stringify(data.alert_recipients ?? []),
        data.status ?? 'active',
        data.monitoring_frequency ?? 'daily',
        data.custom_cron ?? null,
      ]
    )
    return (await this.findById(id))!
  },

  async update(id: string, data: Partial<SKU>): Promise<SKU | null> {
    const fieldMap: Record<string, unknown> = {
      status:               data.status,
      product_name:         data.product_name,
      brand:                data.brand,
      category:             data.category,
      current_price:        data.current_price !== undefined ? Number(data.current_price) : undefined,
      product_url:          data.product_url,
      image_url:            data.image_url,
      target_marketplace:   data.target_marketplace,
      min_price:            data.min_price !== undefined ? Number(data.min_price) : undefined,
      max_price:            data.max_price !== undefined ? Number(data.max_price) : undefined,
      margin_threshold:     data.margin_threshold !== undefined ? Number(data.margin_threshold) : undefined,
      alert_recipients:     data.alert_recipients !== undefined ? JSON.stringify(data.alert_recipients) : undefined,
      competitor_urls:      data.competitor_urls !== undefined ? JSON.stringify(data.competitor_urls) : undefined,
      monitoring_frequency: data.monitoring_frequency,
      custom_cron:          data.custom_cron,
    }

    const sets: string[] = []
    const values: unknown[] = []
    for (const [col, val] of Object.entries(fieldMap)) {
      if (val !== undefined) { sets.push(`${col} = ?`); values.push(val) }
    }
    if (!sets.length) return this.findById(id)

    values.push(id)
    await execute(`UPDATE skus SET ${sets.join(', ')} WHERE id = ?`, values)
    return this.findById(id)
  },

  async delete(id: string): Promise<boolean> {
    const result = await execute('DELETE FROM skus WHERE id = ?', [id])
    return result.affectedRows > 0
  },

  async countActive(): Promise<number> {
    const rows = await query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM skus WHERE status = ?', ['active'])
    return rows[0]?.cnt ?? 0
  },
}
