import { NextResponse } from 'next/server'
import { runPriceMonitoringAgent } from '@/lib/agent/price-monitor'
import { getCacheStats, clearCache } from '@/lib/agent/browser-use'
import { mockSKUs, mockCompetitors } from '@/lib/mock-data'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const sku_ids: string[] | undefined = body.sku_ids
    const max_skus: number = body.max_skus ?? 50
    const clear_cache: boolean = body.clear_cache ?? false

    if (clear_cache) clearCache()

    const skus = sku_ids
      ? mockSKUs.filter(s => sku_ids.includes(s.id))
      : mockSKUs

    const result = await runPriceMonitoringAgent({
      skus,
      competitors: mockCompetitors,
      max_skus_per_run: max_skus,
    })

    return NextResponse.json({
      success: true,
      run_id: result.run_id,
      summary: {
        skus_processed: skus.length,
        checks_completed: result.checks.length,
        recommendations: result.recommendations.length,
        alerts_sent: result.alerts_sent,
        total_cost_usd: result.total_cost_usd,
        estimated_savings_pct: result.total_cost_usd > 0 ? '~72% vs per-SKU sessions' : 'N/A (cached)',
        cache_stats: result.cache_stats,
        errors: result.errors,
      },
      checks: result.checks,
      recommendations: result.recommendations,
    })
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
    cache_stats: getCacheStats(),
    optimisation: {
      strategy: 'Batch all SKUs per competitor into 1 Browser-Use session',
      sessions_per_run: 'N competitors (not N×M)',
      estimated_cost_per_run: '~$2.00 (vs ~$7.20 unoptimised)',
      savings: '~72%',
      cache: 'In-memory TTL cache per monitoring frequency (hourly/daily/weekly)',
    },
    endpoints: {
      'POST /api/agent/run': 'Trigger a monitoring run',
      'POST /api/agent/run { clear_cache: true }': 'Force fresh scrape (bypass cache)',
      'POST /api/agent/run { sku_ids: [...] }': 'Run for specific SKUs only',
      'GET  /api/skus': 'List all SKUs',
      'GET  /api/competitors': 'List all competitors',
    },
  })
}
