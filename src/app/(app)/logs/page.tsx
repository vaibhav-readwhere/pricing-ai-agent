'use client'
import { useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { mockAgentLogs, mockCompetitorChecks, mockSKUs, mockAgentRuns } from '@/lib/mock-data'
import { formatDateTime, formatRelativeTime, getStatusColor, getStatusLabel, getLogLevelColor, getLogLevelIcon, formatCurrency } from '@/lib/utils'
import type { AgentLog, CompetitorCheck } from '@/types'
import { Camera, ExternalLink, Search, Filter, ChevronDown, ChevronUp, ImageIcon, Mail, AlertTriangle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

// Mock screenshots data
const mockScreenshots = [
  { id: 'ss-1', check_id: 'check-1', sku: 'Apple iPhone 15 Pro', competitor: 'Noon', type: 'search_page', timestamp: '2026-04-27T06:30:28Z', placeholder_color: 'from-blue-400 to-indigo-500' },
  { id: 'ss-2', check_id: 'check-1', sku: 'Apple iPhone 15 Pro', competitor: 'Noon', type: 'product_page', timestamp: '2026-04-27T06:30:31Z', placeholder_color: 'from-indigo-400 to-violet-500' },
  { id: 'ss-3', check_id: 'check-2', sku: 'Apple iPhone 15 Pro', competitor: 'Amazon UAE', type: 'search_page', timestamp: '2026-04-27T06:37:10Z', placeholder_color: 'from-orange-400 to-amber-500' },
  { id: 'ss-4', check_id: 'check-2', sku: 'Apple iPhone 15 Pro', competitor: 'Amazon UAE', type: 'product_page', timestamp: '2026-04-27T06:37:20Z', placeholder_color: 'from-amber-400 to-yellow-500' },
  { id: 'ss-5', check_id: 'check-3', sku: 'Samsung Galaxy S24', competitor: 'Noon', type: 'search_page', timestamp: '2026-04-27T06:33:15Z', placeholder_color: 'from-emerald-400 to-teal-500' },
  { id: 'ss-6', check_id: 'check-3', sku: 'Samsung Galaxy S24', competitor: 'Noon', type: 'product_page', timestamp: '2026-04-27T06:33:25Z', placeholder_color: 'from-teal-400 to-cyan-500' },
]

function ScreenshotGallery() {
  const [selected, setSelected] = useState<typeof mockScreenshots[0] | null>(null)
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {mockScreenshots.map(ss => (
          <div key={ss.id}
            onClick={() => setSelected(ss)}
            className="cursor-pointer group rounded-xl overflow-hidden border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all">
            <div className={`h-28 bg-gradient-to-br ${ss.placeholder_color} flex items-center justify-center relative`}>
              <Camera size={24} className="text-white/60" />
              <div className="absolute top-2 left-2">
                <Badge className={ss.type === 'search_page' ? 'bg-white/20 text-white text-[10px]' : 'bg-black/30 text-white text-[10px]'}>
                  {ss.type === 'search_page' ? 'Search' : 'Product'}
                </Badge>
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium">View</span>
              </div>
            </div>
            <div className="p-2.5 bg-white">
              <p className="text-xs font-medium text-gray-800 truncate">{ss.sku}</p>
              <p className="text-[10px] text-gray-500">{ss.competitor} · {formatRelativeTime(ss.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title={`Screenshot — ${selected.sku} @ ${selected.competitor}`} size="xl">
          <div className="p-6">
            <div className={`w-full h-80 bg-gradient-to-br ${selected.placeholder_color} rounded-xl flex flex-col items-center justify-center gap-3`}>
              <Camera size={48} className="text-white/60" />
              <p className="text-white/80 text-sm font-medium">Screenshot Preview</p>
              <p className="text-white/50 text-xs">In production, Playwright screenshots are stored here</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500">Competitor</p>
                <p className="text-xs font-semibold">{selected.competitor}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500">Type</p>
                <p className="text-xs font-semibold capitalize">{selected.type.replace('_', ' ')}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500">Captured</p>
                <p className="text-xs font-semibold">{formatDateTime(selected.timestamp)}</p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function LogTimeline({ logs }: { logs: AgentLog[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  return (
    <div className="space-y-1">
      {logs.map((log, i) => {
        const isOpen = expanded.has(log.id)
        const colors = { info: 'bg-blue-100 text-blue-600 border-blue-200', warn: 'bg-amber-100 text-amber-600 border-amber-200', error: 'bg-red-100 text-red-600 border-red-200', success: 'bg-emerald-100 text-emerald-600 border-emerald-200' }
        const color = colors[log.level] || colors.info
        return (
          <div key={log.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${color}`}>
                {getLogLevelIcon(log.level)}
              </div>
              {i < logs.length - 1 && <div className="w-px flex-1 bg-gray-100 my-1" style={{ minHeight: '12px' }} />}
            </div>
            <div className="flex-1 pb-1">
              <button className="w-full text-left" onClick={() => toggle(log.id)}>
                <div className="flex items-start justify-between gap-2 py-1.5 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 leading-snug">{log.message}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400">{formatDateTime(log.timestamp)}</span>
                      {log.sku_id && <Badge className="bg-indigo-50 text-indigo-600 text-[9px]">{mockSKUs.find(s => s.id === log.sku_id)?.sku_id || log.sku_id}</Badge>}
                    </div>
                  </div>
                  {log.details && (isOpen ? <ChevronUp size={12} className="text-gray-400 shrink-0 mt-1" /> : <ChevronDown size={12} className="text-gray-400 shrink-0 mt-1" />)}
                </div>
              </button>
              {isOpen && log.details && (
                <div className="mx-3 mt-1 mb-2 bg-gray-900 rounded-lg p-3">
                  <pre className="text-[10px] text-gray-300 overflow-x-auto">{JSON.stringify(log.details, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function LogsPage() {
  const [tab, setTab] = useState<'logs' | 'screenshots' | 'checks'>('logs')
  const [runFilter, setRunFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [search, setSearch] = useState('')

  const runOptions = [{ value: '', label: 'All Runs' }, ...mockAgentRuns.map(r => ({ value: r.id, label: `Run ${r.id} — ${formatDateTime(r.started_at)}` }))]
  const levelOptions = [{ value: '', label: 'All Levels' }, { value: 'info', label: 'Info' }, { value: 'warn', label: 'Warning' }, { value: 'error', label: 'Error' }, { value: 'success', label: 'Success' }]

  const filteredLogs = mockAgentLogs.filter(l =>
    (!runFilter || l.run_id === runFilter) &&
    (!levelFilter || l.level === levelFilter) &&
    (!search || l.message.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div>
      <Topbar title="Logs & Proof" subtitle="Agent activity logs, competitor checks, and screenshot proof" />
      <div className="p-6 space-y-4">

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {([
            { key: 'logs', label: 'Activity Logs', icon: Filter },
            { key: 'screenshots', label: 'Screenshot Gallery', icon: Camera },
            { key: 'checks', label: 'Competitor Checks', icon: CheckCircle },
          ] as const).map(tab_ => (
            <button key={tab_.key} onClick={() => setTab(tab_.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all ${tab === tab_.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <tab_.icon size={13} /> {tab_.label}
            </button>
          ))}
        </div>

        {tab === 'logs' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Input icon={<Search size={14} />} placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
                <Select options={runOptions} value={runFilter} onChange={e => setRunFilter(e.target.value)} className="w-60" />
                <Select options={levelOptions} value={levelFilter} onChange={e => setLevelFilter(e.target.value)} className="w-32" />
                <span className="text-xs text-gray-400 ml-auto">{filteredLogs.length} entries</span>
              </div>
            </CardHeader>
            <CardContent>
              <LogTimeline logs={filteredLogs} />
            </CardContent>
          </Card>
        )}

        {tab === 'screenshots' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Screenshot Proof Gallery ({mockScreenshots.length} screenshots)</CardTitle>
                <p className="text-xs text-gray-400">Captured by Playwright automation · Stored in Supabase Storage</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  <strong>Demo Mode:</strong> Screenshots shown as gradient placeholders. In production, Playwright captures real screenshots and stores them in Supabase Storage with timestamps and competitor metadata.
                </p>
              </div>
              <ScreenshotGallery />
            </CardContent>
          </Card>
        )}

        {tab === 'checks' && (
          <Card>
            <CardHeader>
              <CardTitle>Competitor Check Records</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {mockCompetitorChecks.map(check => (
                  <div key={check.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-900">{check.competitor_name}</span>
                          <Badge className={getStatusColor(check.status)}>{getStatusLabel(check.status)}</Badge>
                          <Badge className="bg-gray-100 text-gray-600">
                            Confidence: {(check.match_confidence * 100).toFixed(0)}%
                          </Badge>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">{formatDateTime(check.created_at)} · Run {check.run_id}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <div>
                            <p className="text-[10px] text-gray-400">Our Price</p>
                            <p className="text-sm font-bold text-gray-900">{formatCurrency(check.our_price)}</p>
                          </div>
                          <div className="text-gray-300">→</div>
                          <div>
                            <p className="text-[10px] text-gray-400">Competitor Price</p>
                            <p className={`text-sm font-bold ${check.status === 'overpriced' ? 'text-red-600' : 'text-blue-600'}`}>
                              {check.competitor_price ? formatCurrency(check.competitor_price) : 'N/A'}
                            </p>
                          </div>
                          {check.recommended_price && (
                            <>
                              <div className="text-gray-300">→</div>
                              <div>
                                <p className="text-[10px] text-gray-400">Recommended</p>
                                <p className="text-sm font-bold text-indigo-600">{formatCurrency(check.recommended_price)}</p>
                              </div>
                            </>
                          )}
                        </div>
                        {check.recommendation_reason && (
                          <p className="text-xs text-gray-500 mt-2 italic">{check.recommendation_reason}</p>
                        )}
                        {check.error_message && (
                          <p className="text-xs text-red-500 mt-1">{check.error_message}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {check.screenshot_search_url && (
                          <div className="flex items-center gap-1 text-[10px] text-gray-500">
                            <Camera size={10} /> Search screenshot
                          </div>
                        )}
                        {check.screenshot_product_url && (
                          <div className="flex items-center gap-1 text-[10px] text-gray-500">
                            <Camera size={10} /> Product screenshot
                          </div>
                        )}
                        {check.email_sent && (
                          <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                            <Mail size={10} /> Email sent
                          </div>
                        )}
                        {check.competitor_url && (
                          <a href={check.competitor_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] text-indigo-600 hover:underline">
                            <ExternalLink size={10} /> View on site
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
