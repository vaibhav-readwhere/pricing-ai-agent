import { NextResponse } from 'next/server'
import { runPricingAgent } from '@/lib/agent/index'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const runId = crypto.randomUUID()

    // Fire and forget — client polls via SSE stream
    runPricingAgent({
      runId,
      triggeredBy: body.triggered_by ?? 'manual',
      userId: body.user_id,
      skuIds: body.sku_ids,
    }).catch(err => console.error('[agent] run error:', err))

    return NextResponse.json({ success: true, runId, status: 'started' })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ready' })
}
