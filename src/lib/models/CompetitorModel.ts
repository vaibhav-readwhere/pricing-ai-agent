import crypto from 'crypto'
import { query, execute } from '@/lib/db/connection'
import type { Competitor } from '@/types'

type Row = Record<string, unknown>

const DEFAULT_RULES = { title_similarity_threshold: 0.75, brand_match_required: true, model_match_required: false }

function parseJSON<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T } catch { return fallback }
  }
  return val as T
}

function parse(row: Row): Competitor {
  return {
    ...(row as unknown as Competitor),
    screenshot_required: Boolean(row.screenshot_required),
    matching_rules: parseJSON(row.matching_rules, DEFAULT_RULES),
  }
}

export const CompetitorModel = {
  async findAll(): Promise<Competitor[]> {
    const rows = await query<Row>('SELECT * FROM competitors ORDER BY created_at DESC')
    return rows.map(parse)
  },

  async findById(id: string): Promise<Competitor | null> {
    const rows = await query<Row>('SELECT * FROM competitors WHERE id = ?', [id])
    return rows[0] ? parse(rows[0]) : null
  },

  async create(data: Omit<Partial<Competitor>, 'id' | 'created_at' | 'updated_at'>): Promise<Competitor> {
    const id = crypto.randomUUID()
    const rules = {
      title_similarity_threshold: Number(data.matching_rules?.title_similarity_threshold ?? 0.75),
      brand_match_required:       Boolean(data.matching_rules?.brand_match_required ?? true),
      model_match_required:       Boolean(data.matching_rules?.model_match_required ?? false),
    }
    await execute(
      `INSERT INTO competitors
         (id, name, website_url, search_url_pattern, logo, matching_rules,
          price_selector, screenshot_required, status)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        id,
        data.name,
        data.website_url,
        data.search_url_pattern ?? '',
        data.logo ?? null,
        JSON.stringify(rules),
        data.price_selector ?? null,
        data.screenshot_required ?? true ? 1 : 0,
        data.status ?? 'active',
      ]
    )
    return (await this.findById(id))!
  },

  async update(id: string, data: Partial<Competitor> & {
    title_similarity_threshold?: number
    brand_match_required?: boolean
  }): Promise<Competitor | null> {
    const sets: string[] = []
    const values: unknown[] = []

    const simple: Record<string, unknown> = {
      name:                data.name,
      website_url:         data.website_url,
      search_url_pattern:  data.search_url_pattern,
      logo:                data.logo,
      price_selector:      data.price_selector,
      status:              data.status,
      screenshot_required: data.screenshot_required !== undefined ? (data.screenshot_required ? 1 : 0) : undefined,
    }
    for (const [col, val] of Object.entries(simple)) {
      if (val !== undefined) { sets.push(`${col} = ?`); values.push(val) }
    }

    // Partial merge of matching_rules
    if (data.title_similarity_threshold !== undefined || data.brand_match_required !== undefined || data.matching_rules) {
      const existing = await this.findById(id)
      const currentRules = existing?.matching_rules ?? DEFAULT_RULES
      const merged = {
        ...currentRules,
        ...(data.matching_rules ?? {}),
        ...(data.title_similarity_threshold !== undefined ? { title_similarity_threshold: Number(data.title_similarity_threshold) } : {}),
        ...(data.brand_match_required !== undefined ? { brand_match_required: Boolean(data.brand_match_required) } : {}),
      }
      sets.push('matching_rules = ?')
      values.push(JSON.stringify(merged))
    }

    if (!sets.length) return this.findById(id)
    values.push(id)
    await execute(`UPDATE competitors SET ${sets.join(', ')} WHERE id = ?`, values)
    return this.findById(id)
  },

  async delete(id: string): Promise<boolean> {
    const result = await execute('DELETE FROM competitors WHERE id = ?', [id])
    return result.affectedRows > 0
  },

  async countActive(): Promise<number> {
    const rows = await query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM competitors WHERE status = ?', ['active'])
    return rows[0]?.cnt ?? 0
  },
}
