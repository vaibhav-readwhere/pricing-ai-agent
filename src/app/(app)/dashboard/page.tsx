'use client'
import { Topbar } from '@/components/layout/topbar'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { mockDashboardStats, mockAgentRuns, mockRecommendations } from '@/lib/mock-data'
import { formatCurrency, formatDateTime, formatRelativeTime, getStatusColor, getStatusLabel, getLogLevelColor, getLogLevelIcon } from '@/lib/utils'
import { Package, Store, AlertTriangle, Bell, Clock, Calendar, ChevronRight, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import Link from 'next/link'

const actionIcon = (action: string) => {
  if (action === 'decrease') return <TrendingDown size={14} className="text-red-500" />
  if (action === 'increase') return <TrendingUp size={14} className="text-blue-500" />
  return <Minus size={14} className="text-gray-400" />
}

export default function DashboardPage() {
  const stats = mockDashboardStats
  const lastRun = mockAgentRuns[0]

  return (
    <div>
      <Topbar title="Dashboard" subtitle="AI-powered competitor price monitoring overview" />
      <div className="p-6 space-y-6">

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total SKUs" value={stats.total_skus} subtitle="5 active, 1 paused" icon={Package} iconColor="text-indigo-600" iconBg="bg-indigo-50" />
          <StatCard title="Competitors Tracked" value={stats.active_competitors} subtitle="5 active sites" icon={Store} iconColor="text-violet-600" iconBg="bg-violet-50" />
          <StatCard title="Price Mismatches" value={stats.price_mismatches} subtitle="Found in last run" icon={AlertTriangle} iconColor="text-red-500" iconBg="bg-red-50" />
          <StatCard title="Alerts Sent" value={stats.alerts_sent} subtitle="Today" icon={Bell} iconColor="text-amber-600" iconBg="bg-amber-50" />
        </div>

        {/* Agent Run Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Agent Runs</CardTitle>
                <Link href="/monitoring"><Button variant="ghost" size="sm">View all <ChevronRight size={14} /></Button></Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {mockAgentRuns.map(run => (
                  <div key={run.id} className="flex items-center gap-4 px-6 py-3.5">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${run.status === 'completed' ? 'bg-emerald-400' : run.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-900">{formatDateTime(run.started_at)}</span>
                        <Badge className={getStatusColor(run.status)}>{run.status}</Badge>
                        {run.triggered_by === 'manual' && <Badge className="bg-blue-50 text-blue-600">Manual</Badge>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {run.skus_processed}/{run.skus_total} SKUs · {run.competitors_checked} checks · {run.mismatches_found} mismatches · {run.alerts_sent} alerts
                      </p>
                      {run.error_message && <p className="text-xs text-red-500 mt-0.5 truncate">{run.error_message}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {run.completed_at && (
                        <p className="text-xs text-gray-400">
                          {Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 60000)}m
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-gray-100 rounded-lg"><Clock size={16} className="text-gray-600" /></div>
                  <div>
                    <p className="text-xs text-gray-500">Last Run</p>
                    <p className="text-sm font-semibold text-gray-900">{formatRelativeTime(lastRun.started_at)}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{formatDateTime(lastRun.started_at)}</p>
                <div className="mt-2 flex gap-2">
                  <div className="flex-1 bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-gray-900">{lastRun.skus_processed}</p>
                    <p className="text-[10px] text-gray-500">SKUs</p>
                  </div>
                  <div className="flex-1 bg-red-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-red-600">{lastRun.mismatches_found}</p>
                    <p className="text-[10px] text-gray-500">Mismatches</p>
                  </div>
                  <div className="flex-1 bg-amber-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-amber-600">{lastRun.alerts_sent}</p>
                    <p className="text-[10px] text-gray-500">Alerts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg"><Calendar size={16} className="text-indigo-600" /></div>
                  <div>
                    <p className="text-xs text-gray-500">Next Scheduled Run</p>
                    <p className="text-sm font-semibold text-gray-900">28 Apr 2026, 06:30</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: '65%' }} />
                  </div>
                  <span className="text-[10px] text-gray-500">~14h away</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recommendations Preview + Activity Log */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Latest Recommendations</CardTitle>
                <Link href="/recommendations"><Button variant="ghost" size="sm">View all <ChevronRight size={14} /></Button></Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {mockRecommendations.map(rec => (
                  <div key={rec.id} className="flex items-center gap-4 px-6 py-3.5">
                    <div className="shrink-0">{actionIcon(rec.action)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{rec.sku_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className={getStatusColor(rec.status)}>{getStatusLabel(rec.status)}</Badge>
                        <span className="text-[10px] text-gray-400">{rec.competitor_data.length} competitors checked</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(rec.recommended_price)}</p>
                      <p className="text-[10px] text-gray-400 line-through">{formatCurrency(rec.current_price)}</p>
                    </div>
                    <div className={`text-xs font-semibold ${rec.price_diff > 0 ? 'text-blue-600' : rec.price_diff < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                      {rec.price_diff > 0 ? '+' : ''}{formatCurrency(rec.price_diff)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Activity Log</CardTitle>
                <Link href="/logs"><Button variant="ghost" size="sm">All logs</Button></Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="px-4 py-2 space-y-3">
                {stats.recent_activity.map((log, i) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${log.level === 'error' ? 'bg-red-100 text-red-600' : log.level === 'warn' ? 'bg-amber-100 text-amber-600' : log.level === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                        {getLogLevelIcon(log.level)}
                      </div>
                      {i < stats.recent_activity.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
                    </div>
                    <div className="pb-3 flex-1 min-w-0">
                      <p className="text-xs text-gray-700 leading-snug">{log.message}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{formatRelativeTime(log.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Price Summary Chart Placeholder */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Price Comparison Overview — Last 7 Days</CardTitle>
              <span className="text-xs text-gray-400">Updated: {formatRelativeTime('2026-04-27T06:48:00Z')}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-3">
              {mockRecommendations.map(rec => (
                <div key={rec.id} className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-[10px] text-gray-500 truncate">{rec.sku_brand}</p>
                  <p className="text-xs font-medium text-gray-700 truncate mt-0.5" title={rec.sku_name}>
                    {rec.sku_name.split(' ').slice(0, 3).join(' ')}
                  </p>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-400">Ours</span>
                      <span className="font-semibold text-gray-800">{formatCurrency(rec.current_price)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-400">Min</span>
                      <span className="text-red-600 font-medium">{formatCurrency(rec.lowest_competitor_price)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-400">Avg</span>
                      <span className="text-gray-600">{formatCurrency(rec.avg_competitor_price)}</span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Badge className={getStatusColor(rec.status)}>{getStatusLabel(rec.status)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
