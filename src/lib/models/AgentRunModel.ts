import crypto from 'crypto'
import { query, execute } from '@/lib/db/connection'
import type { AgentRun, AgentLog, CompetitorCheck } from '@/types'

type Row = Record<string, unknown>

function parseJSON<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T } catch { return fallback }
  }
  return val as T
}

function parseRun(row: Row): AgentRun {
  return row as unknown as AgentRun
}

function parseLog(row: Row): AgentLog & { sku_sku_id?: string } {
  return {
    ...(row as unknown as AgentLog),
    details: parseJSON(row.details, undefined),
  }
}

function parseCheck(row: Row): CompetitorCheck & { sku_sku_id?: string; sku_product_name?: string } {
  return row as unknown as CompetitorCheck
}

export const AgentRunModel = {
  async findAll(): Promise<AgentRun[]> {
    const rows = await query<Row>('SELECT * FROM agent_runs ORDER BY started_at DESC')
    return rows.map(parseRun)
  },

  async findById(id: string): Promise<AgentRun | null> {
    const rows = await query<Row>('SELECT * FROM agent_runs WHERE id = ?', [id])
    return rows[0] ? parseRun(rows[0]) : null
  },

  async create(data: {
    triggered_by?: string
    skus_total?: number
  }): Promise<AgentRun> {
    const id = crypto.randomUUID()
    await execute(
      `INSERT INTO agent_runs
         (id, status, triggered_by, skus_total, skus_processed, competitors_checked,
          mismatches_found, alerts_sent, screenshots_captured)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, 'pending', data.triggered_by ?? 'manual', data.skus_total ?? 0, 0, 0, 0, 0, 0]
    )
    return (await this.findById(id))!
  },

  async getLogsForRun(runId: string): Promise<(AgentLog & { sku_sku_id?: string })[]> {
    const rows = await query<Row>(
      `SELECT al.*, s.sku_id AS sku_sku_id
       FROM audit_logs al
       LEFT JOIN skus s ON al.sku_id = s.id
       WHERE al.run_id = ?
       ORDER BY al.timestamp ASC`,
      [runId]
    )
    return rows.map(parseLog)
  },

  async getChecksForRun(runId: string): Promise<(CompetitorCheck & { sku_sku_id?: string; sku_product_name?: string; competitor_name_joined?: string })[]> {
    const rows = await query<Row>(
      `SELECT cc.*, s.sku_id AS sku_sku_id, s.product_name AS sku_product_name, c.name AS competitor_name_joined
       FROM competitor_checks cc
       LEFT JOIN skus s       ON cc.sku_id = s.id
       LEFT JOIN competitors c ON cc.competitor_id = c.id
       WHERE cc.run_id = ?
       ORDER BY cc.created_at ASC`,
      [runId]
    )
    return rows.map(parseCheck)
  },
}
