import { NextResponse } from 'next/server'
import { mockAgentRuns } from '@/lib/mock-data'

export async function GET() {
  return NextResponse.json({
    data: mockAgentRuns,
    total: mockAgentRuns.length,
    stats: {
      total_runs: mockAgentRuns.length,
      successful: mockAgentRuns.filter(r => r.status === 'completed').length,
      failed: mockAgentRuns.filter(r => r.status === 'failed').length,
      total_alerts_sent: mockAgentRuns.reduce((s, r) => s + r.alerts_sent, 0),
    },
  })
}
