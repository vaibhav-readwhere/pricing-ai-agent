'use client'
import { useState, useEffect, useCallback } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { formatDateTime, formatRelativeTime, getStatusColor, getStatusLabel, getLogLevelColor, getLogLevelIcon, formatCurrency } from '@/lib/utils'
import { Camera, ExternalLink, Search, Filter, ChevronDown, ChevronUp, Mail, AlertTriangle, CheckCircle, Loader2, ImageOff } from 'lucide-react'
import toast from 'react-hot-toast'

type LogRow = {
  id: string
  run_id: string | null
  sku_id: string | null
  sku_code: string | null
  competitor_id: string | null
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
  details: Record<string, unknown> | null
  timestamp: string
}

type ScreenshotRow = {
  id: string
  check_id: string
  sku_name: string
  sku_code: string
  competitor_name: string
  type: 'search_page' | 'product_page'
  storage_path: string
  file_size_bytes: number
  width: number
  height: number
  timestamp: string
}

type CheckRow = {
  id: string
  run_id: string
  sku_code: string
  sku_name: string
  competitor_name: string
  our_price: number
  competitor_price: number | null
  match_confidence: number
  status: string
  recommended_price: number | null
  recommendation_reason: string | null
  screenshot_search_url: string | null
  screenshot_product_url: string | null
  competitor_url: string | null
  email_sent: boolean
  error_message: string | null
  created_at: string
}

type RunOption = { id: string; started_at: string }

function screenshotUrl(storagePath: string): string {
  return '/' + storagePath.replace(/^public\//, '')
}

function ScreenshotGallery({ screenshots, loading }: { screenshots: ScreenshotRow[]; loading: boolean }) {
  const [selected, setSelected] = useState<ScreenshotRow | null>(null)
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set())

  if (loading) return <div className="py-12 text-center"><Loader2 size={20} className="mx-auto text-gray-300 animate-spin mb-2" /><p className="text-sm text-gray-400">Loading screenshots…</p></div>
  if (!screenshots.length) return <div className="py-12 text-center"><Camera size={28} className="mx-auto text-gray-200 mb-2" /><p className="text-sm text-gray-400">No screenshots yet — run the agent to capture proof.</p></div>

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {screenshots.map(ss => {
          const url = screenshotUrl(ss.storage_path)
          const hasError = imgErrors.has(ss.id)
          return (
            <div key={ss.id} onClick={() => setSelected(ss)}
              className="cursor-pointer group rounded-xl overflow-hidden border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all">
              <div className="h-28 bg-gray-100 relative overflow-hidden">
                {hasError ? (
                  <div className="h-full flex flex-col items-center justify-center gap-1 text-gray-300">
                    <ImageOff size={20} />
                    <span className="text-[10px]">Not found</span>
                  </div>
                ) : (
                  <img src={url} alt={`${ss.competitor_name} ${ss.type}`}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform"
                    onError={() => setImgErrors(prev => new Set([...prev, ss.id]))} />
                )}
                <div className="absolute top-2 left-2">
                  <Badge className={ss.type === 'search_page' ? 'bg-white/90 text-gray-700 text-[10px]' : 'bg-indigo-600/90 text-white text-[10px]'}>
                    {ss.type === 'search_page' ? 'Search' : 'Product'}
                  </Badge>
                </div>
              </div>
              <div className="p-2.5 bg-white">
                <p className="text-xs font-medium text-gray-800 truncate">{ss.sku_name || ss.sku_code}</p>
                <p className="text-[10px] text-gray-500">{ss.competitor_name} · {formatRelativeTime(ss.timestamp)}</p>
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title={`Screenshot — ${selected.sku_name} @ ${selected.competitor_name}`} size="xl">
          <div className="p-6">
            <div className="w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center" style={{ minHeight: 320 }}>
              {imgErrors.has(selected.id) ? (
                <div className="py-16 flex flex-col items-center gap-2 text-gray-300">
                  <ImageOff size={36} />
                  <p className="text-sm">Image file not found</p>
                  <p className="text-xs text-gray-400">{screenshotUrl(selected.storage_path)}</p>
                </div>
              ) : (
                <img src={screenshotUrl(selected.storage_path)} alt="screenshot"
                  className="max-w-full max-h-150 object-contain"
                  onError={() => setImgErrors(prev => new Set([...prev, selected.id]))} />
              )}
            </div>
            <div className="mt-4 grid grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-[10px] text-gray-500">Competitor</p><p className="text-xs font-semibold">{selected.competitor_name}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-[10px] text-gray-500">Type</p><p className="text-xs font-semibold capitalize">{selected.type.replace('_', ' ')}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-[10px] text-gray-500">Captured</p><p className="text-xs font-semibold">{formatDateTime(selected.timestamp)}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-[10px] text-gray-500">Size</p><p className="text-xs font-semibold">{selected.width}×{selected.height} · {(selected.file_size_bytes / 1024).toFixed(0)}KB</p></div>
            </div>
          </div>
          <div className="flex justify-end px-6 py-4 border-t border-gray-100">
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function LogTimeline({ logs, loading }: { logs: LogRow[]; loading: boolean }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  if (loading) return <div className="py-12 text-center"><Loader2 size={20} className="mx-auto text-gray-300 animate-spin mb-2" /><p className="text-sm text-gray-400">Loading logs…</p></div>
  if (!logs.length) return <div className="py-8 text-center text-sm text-gray-400">No logs found.</div>

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
              {i < logs.length - 1 && <div className="w-px flex-1 bg-gray-100 my-1" style={{ minHeight: 12 }} />}
            </div>
            <div className="flex-1 pb-1">
              <button className="w-full text-left" onClick={() => toggle(log.id)}>
                <div className="flex items-start justify-between gap-2 py-1.5 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 leading-snug">{log.message}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400">{formatDateTime(log.timestamp)}</span>
                      {log.sku_code && <Badge className="bg-indigo-50 text-indigo-600 text-[9px]">{log.sku_code}</Badge>}
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
  const [runs, setRuns] = useState<RunOption[]>([])
  const [logs, setLogs] = useState<LogRow[]>([])
  const [screenshots, setScreenshots] = useState<ScreenshotRow[]>([])
  const [checks, setChecks] = useState<CheckRow[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [loadingShots, setLoadingShots] = useState(false)
  const [loadingChecks, setLoadingChecks] = useState(false)
  const [runFilter, setRunFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [search, setSearch] = useState('')

  // Load runs for filter dropdown
  useEffect(() => {
    fetch('/api/monitoring').then(r => r.json()).then(json => setRuns(json.data ?? [])).catch(() => {})
  }, [])

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const p = new URLSearchParams()
      if (runFilter)   p.set('run_id', runFilter)
      if (levelFilter) p.set('level', levelFilter)
      if (search)      p.set('search', search)
      const json = await fetch(`/api/logs?${p}`).then(r => r.json())
      setLogs(json.data ?? [])
    } catch { toast.error('Failed to load logs') }
    finally { setLoadingLogs(false) }
  }, [runFilter, levelFilter, search])

  const loadScreenshots = useCallback(async () => {
    setLoadingShots(true)
    try {
      const p = new URLSearchParams()
      if (runFilter) p.set('run_id', runFilter)
      const json = await fetch(`/api/screenshots?${p}`).then(r => r.json())
      setScreenshots(json.data ?? [])
    } catch { toast.error('Failed to load screenshots') }
    finally { setLoadingShots(false) }
  }, [runFilter])

  const loadChecks = useCallback(async () => {
    setLoadingChecks(true)
    try {
      const p = new URLSearchParams()
      if (runFilter) p.set('run_id', runFilter)
      const json = await fetch(`/api/checks?${p}`).then(r => r.json())
      setChecks(json.data ?? [])
    } catch { toast.error('Failed to load checks') }
    finally { setLoadingChecks(false) }
  }, [runFilter])

  useEffect(() => { if (tab === 'logs')        loadLogs() },        [tab, loadLogs])
  useEffect(() => { if (tab === 'screenshots') loadScreenshots() }, [tab, loadScreenshots])
  useEffect(() => { if (tab === 'checks')      loadChecks() },      [tab, loadChecks])

  const runOptions = [
    { value: '', label: 'All Runs' },
    ...runs.map(r => ({ value: r.id, label: `Run ${r.id.slice(0, 8)} — ${formatDateTime(r.started_at)}` })),
  ]
  const levelOptions = [
    { value: '', label: 'All Levels' },
    { value: 'info', label: 'Info' },
    { value: 'warn', label: 'Warning' },
    { value: 'error', label: 'Error' },
    { value: 'success', label: 'Success' },
  ]

  return (
    <div>
      <Topbar title="Logs & Proof" subtitle="Agent activity logs, competitor checks, and screenshot proof" />
      <div className="p-6 space-y-4">

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {([
            { key: 'logs',        label: 'Activity Logs',       icon: Filter },
            { key: 'screenshots', label: 'Screenshot Gallery',  icon: Camera },
            { key: 'checks',      label: 'Competitor Checks',   icon: CheckCircle },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        {/* Run filter shared across tabs */}
        <div className="flex items-center gap-2">
          <Select options={runOptions} value={runFilter} onChange={e => setRunFilter(e.target.value)} className="w-72" />
          {tab === 'logs' && (
            <>
              <Select options={levelOptions} value={levelFilter} onChange={e => setLevelFilter(e.target.value)} className="w-32" />
              <Input icon={<Search size={14} />} placeholder="Search messages…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
            </>
          )}
          <span className="text-xs text-gray-400 ml-auto">
            {tab === 'logs' && `${logs.length} entries`}
            {tab === 'screenshots' && `${screenshots.length} screenshots`}
            {tab === 'checks' && `${checks.length} checks`}
          </span>
        </div>

        {tab === 'logs' && (
          <Card>
            <CardContent className="pt-4">
              <LogTimeline logs={logs} loading={loadingLogs} />
            </CardContent>
          </Card>
        )}

        {tab === 'screenshots' && (
          <Card>
            <CardHeader>
              <CardTitle>Screenshot Proof Gallery ({screenshots.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScreenshotGallery screenshots={screenshots} loading={loadingShots} />
            </CardContent>
          </Card>
        )}

        {tab === 'checks' && (
          <Card>
            <CardHeader>
              <CardTitle>Competitor Check Records ({checks.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingChecks ? (
                <div className="py-12 text-center"><Loader2 size={20} className="mx-auto text-gray-300 animate-spin mb-2" /><p className="text-sm text-gray-400">Loading…</p></div>
              ) : checks.length === 0 ? (
                <div className="py-12 text-center"><AlertTriangle size={24} className="mx-auto text-gray-200 mb-2" /><p className="text-sm text-gray-400">No competitor checks yet.</p></div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {checks.map(check => (
                    <div key={check.id} className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-gray-900">{check.competitor_name}</span>
                            <Badge className={getStatusColor(check.status as Parameters<typeof getStatusColor>[0])}>{getStatusLabel(check.status as Parameters<typeof getStatusLabel>[0])}</Badge>
                            <Badge className="bg-gray-100 text-gray-600">Confidence: {(Number(check.match_confidence) * 100).toFixed(0)}%</Badge>
                            {check.sku_code && <Badge className="bg-indigo-50 text-indigo-600">{check.sku_code}</Badge>}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5">{formatDateTime(check.created_at)}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <div>
                              <p className="text-[10px] text-gray-400">Our Price</p>
                              <p className="text-sm font-bold text-gray-900">{formatCurrency(Number(check.our_price))}</p>
                            </div>
                            <div className="text-gray-300">→</div>
                            <div>
                              <p className="text-[10px] text-gray-400">Competitor Price</p>
                              <p className={`text-sm font-bold ${check.status === 'overpriced' ? 'text-red-600' : 'text-blue-600'}`}>
                                {check.competitor_price != null ? formatCurrency(Number(check.competitor_price)) : 'N/A'}
                              </p>
                            </div>
                            {check.recommended_price != null && (
                              <>
                                <div className="text-gray-300">→</div>
                                <div>
                                  <p className="text-[10px] text-gray-400">Recommended</p>
                                  <p className="text-sm font-bold text-indigo-600">{formatCurrency(Number(check.recommended_price))}</p>
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
                        <div className="flex flex-col gap-1.5 shrink-0 text-right">
                          {check.screenshot_search_url && (
                            <span className="flex items-center justify-end gap-1 text-[10px] text-gray-500"><Camera size={10} /> Search URL</span>
                          )}
                          {check.screenshot_product_url && (
                            <span className="flex items-center justify-end gap-1 text-[10px] text-gray-500"><Camera size={10} /> Product URL</span>
                          )}
                          {check.email_sent && (
                            <span className="flex items-center justify-end gap-1 text-[10px] text-emerald-600"><Mail size={10} /> Email sent</span>
                          )}
                          {check.competitor_url && (
                            <a href={check.competitor_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center justify-end gap-1 text-[10px] text-indigo-600 hover:underline">
                              <ExternalLink size={10} /> View on site
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
