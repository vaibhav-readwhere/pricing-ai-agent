import { NextResponse } from 'next/server'
import { AgentRunModel } from '@/lib/models/AgentRunModel'
import { SKUModel } from '@/lib/models/SKUModel'

export const AgentRunController = {
  async list() {
    try {
      const runs = await AgentRunModel.findAll()
      return NextResponse.json({
        data:  runs,
        total: runs.length,
        stats: {
          total_runs:        runs.length,
          successful:        runs.filter(r => r.status === 'completed').length,
          failed:            runs.filter(r => r.status === 'failed').length,
          total_alerts_sent: runs.reduce((s, r) => s + (r.alerts_sent ?? 0), 0),
        },
      })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  },

  async create(request: Request) {
    try {
      const body = await request.json().catch(() => ({}))
      const skusTotal = await SKUModel.countActive()
      const data = await AgentRunModel.create({
        triggered_by: body.triggered_by ?? 'manual',
        skus_total:   skusTotal,
      })
      return NextResponse.json({ data }, { status: 201 })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 400 })
    }
  },

  async getDetail(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
      const { id } = await params
      const [run, logs, checks] = await Promise.all([
        AgentRunModel.findById(id),
        AgentRunModel.getLogsForRun(id),
        AgentRunModel.getChecksForRun(id),
      ])
      if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ data: run, logs, checks })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  },
}
