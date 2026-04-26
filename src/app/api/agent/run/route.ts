import { NextResponse } from 'next/server'
import { runPriceMonitoringAgent } from '@/lib/agent/price-monitor'
import { mockSKUs, mockCompetitors } from '@/lib/mock-data'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const sku_ids: string[] | undefined = body.sku_ids
    const max_skus: number = body.max_skus ?? 50

    const skus = sku_ids
      ? mockSKUs.filter(s => sku_ids.includes(s.id))
      : mockSKUs

    const result = await runPriceMonitoringAgent({
      skus,
      competitors: mockCompetitors,
      max_skus_per_run: max_skus,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Agent run error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ready',
    message: 'Price Monitoring Agent API is operational.',
    endpoints: {
      'POST /api/agent/run': 'Trigger a monitoring run',
      'GET /api/skus': 'List all SKUs',
      'POST /api/skus': 'Create a SKU',
      'GET /api/competitors': 'List all competitors',
      'GET /api/monitoring': 'List agent runs',
      'GET /api/alerts': 'List email alerts',
      'GET /api/reports': 'Get report data',
    },
  })
}
