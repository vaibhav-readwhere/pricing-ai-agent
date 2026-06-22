'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Table, Thead, Th, Tbody, Tr, Td } from '@/components/ui/table'
import { formatDateTime, formatRelativeTime, formatCurrency, getStatusColor, getStatusLabel, getLogLevelColor, getLogLevelIcon } from '@/lib/utils'
import type { AgentRun } from '@/types'
import {
  Play, XCircle, Camera, Mail,
  Calendar, Zap, Settings, Loader2, Info, AlertTriangle, CheckCircle2, Terminal
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Live run log stream ──────────────────────────────────────────────────────

interface LiveLog {
  id: string
  level: string
  message: string
  timestamp: string
}

interface DonePayload {
  status: string
  run: {
    skus_processed: number
    skus_total: number
    competitors_checked: number
    mismatches_found: number
    screenshots_captured: number
    alerts_sent: number
    error_message?: string
  }
}

function levelIcon(level: string) {
  if (level === 'error')   return <XCircle     size={12} className="text-red-500   shrink-0 mt-0.5" />
  if (level === 'warn')    return <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
  if (level === 'success') return <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5" />
  return                          <Info         size={12} className="text-blue-400  shrink-0 mt-0.5" />
}

function levelText(level: string) {
  if (level === 'error')   return 'text-red-700'
  if (level === 'warn')    return 'text-amber-700'
  if (level === 'success') return 'text-emerald-700'
  return 'text-gray-700'
}

function fmtTime(ts: string) {
  try { return new Date(ts).toLocaleTimeString('en-US', { hour12: false }) } catch { return ts }
}

function LiveRunModal({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [logs, setLogs]       = useState<LiveLog[]>([])
  const [done, setDone]       = useState(false)
  const [payload, setPayload] = useState<DonePayload | null>(null)
  const bottomRef             = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const es = new EventSource(`/api/agent/run/stream?run_id=${runId}`)
    es.onmessage = e => {
      const data = JSON.parse(e.data as string)
      if (data.type === 'log') {
        setLogs(prev => [...prev, data as LiveLog])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30)
      } else if (data.type === 'done') {
        setPayload(data as DonePayload)
        setDone(true)
        es.close()
      }
    }
    es.onerror = () => es.close()
    return () => es.close()
  }, [runId])

  const statsItems = payload ? [
    { label: 'SKUs', value: `${payload.run.skus_processed}/${payload.run.skus_total}` },
    { label: 'Checks', value: payload.run.competitors_checked },
    { label: 'Mismatches', value: payload.run.mismatches_found },
    { label: 'Screenshots', value: payload.run.screenshots_captured },
    { label: 'Alerts', value: payload.run.alerts_sent },
  ] : []

  return (
    <Modal open={true} onClose={done ? onClose : () => {}} title="" size="xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <Terminal size={16} className="text-indigo-500" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Live Agent Run</p>
          <p className="text-[10px] text-gray-400 font-mono">{runId}</p>
        </div>
        {done ? (
          <Badge className={payload?.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}>
            {payload?.status === 'completed' ? 'Completed' : 'Failed'}
          </Badge>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-500">Running…</span>
          </div>
        )}
      </div>

      {/* Log feed */}
      <div className="bg-gray-950 rounded-none overflow-y-auto" style={{ height: '380px' }}>
        <div className="p-4 space-y-1.5 font-mono text-xs">
          {logs.length === 0 && !done && (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 size={12} className="animate-spin" />
              <span>Waiting for agent to start…</span>
            </div>
          )}
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-2">
              <span className="text-gray-600 shrink-0 w-20 text-[10px] mt-px">{fmtTime(log.timestamp)}</span>
              <span className="shrink-0">{levelIcon(log.level)}</span>
              <span className={`${levelText(log.level)} leading-relaxed`}>{log.message}</span>
            </div>
          ))}
          {done && (
            <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-2 text-gray-500">
              <span>━━ run complete ━━</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Stats footer */}
      {done && payload && (
        <div className="px-6 py-4 border-t border-gray-100">
          <div className="grid grid-cols-5 gap-3 mb-4">
            {statsItems.map(s => (
              <div key={s.label} className="bg-gray-50 rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-gray-500 uppercase">{s.label}</p>
                <p className="text-base font-bold text-gray-900 mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
          {payload.run.error_message && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
              {payload.run.error_message}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end px-6 py-3 border-t border-gray-100">
        <Button variant="outline" onClick={onClose} disabled={!done}>
          {done ? 'Close' : 'Running…'}
        </Button>
      </div>
    </Modal>
  )
}

function RunDetailModal({ run, onClose }: { run: AgentRun; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<{ id: string; level: string; message: string; timestamp: string; skus?: { sku_id: string } | null }[]>([])
  const [checks, setChecks] = useState<{ id: string; competitor_name: string; our_price: number; competitor_price: number | null; match_confidence: number; status: string; email_sent: boolean; skus?: { sku_id: string } | null }[]>([])
  const [tab, setTab] = useState<'logs' | 'checks'>('logs')

  useEffect(() => {
    fetch(`/api/monitoring/${run.id}`)
      .then(r => r.json())
      .then(json => { setLogs(json.logs ?? []); setChecks(json.checks ?? []) })
      .catch(() => toast.error('Failed to load run details'))
      .finally(() => setLoading(false))
  }, [run.id])

  return (
    <Modal open={true} onClose={onClose} title={`Run Details — ${formatDateTime(run.started_at)}`} size="xl">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Status', value: run.status, isStatus: true },
            { label: 'SKUs Processed', value: `${run.skus_processed}/${run.skus_total}` },
            { label: 'Mismatches', value: run.mismatches_found },
            { label: 'Screenshots', value: run.screenshots_captured },
          ].map(item => (
            <div key={item.label} className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-gray-500 uppercase">{item.label}</p>
              {item.isStatus
                ? <Badge className={`mt-1 ${getStatusColor(item.value as string)}`}>{item.value}</Badge>
                : <p className="text-lg font-bold text-gray-900 mt-1">{item.value}</p>}
            </div>
          ))}
        </div>
        {run.error_message && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
            <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700">{run.error_message}</p>
          </div>
        )}

        <div className="flex border-b border-gray-200">
          {(['logs', 'checks'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t === 'logs' ? `Activity Logs (${logs.length})` : `Competitor Checks (${checks.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-10 text-center"><Loader2 size={20} className="mx-auto text-gray-300 animate-spin" /></div>
        ) : tab === 'logs' ? (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {logs.length > 0 ? logs.map(log => (
              <div key={log.id} className="flex gap-3">
                <div className={`text-[11px] font-bold mt-0.5 ${getLogLevelColor(log.level as 'info' | 'warn' | 'error' | 'success')}`}>
                  {getLogLevelIcon(log.level as 'info' | 'warn' | 'error' | 'success')}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-xs text-gray-800">{log.message}</p>
                    <span className="text-[10px] text-gray-400 shrink-0">{formatRelativeTime(log.timestamp)}</span>
                  </div>
                  {log.skus?.sku_id && <p className="text-[10px] text-gray-400 mt-0.5">SKU: {log.skus.sku_id}</p>}
                </div>
              </div>
            )) : (
              <div className="py-8 text-center text-xs text-gray-400">No logs found for this run</div>
            )}
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {checks.length > 0 ? (
              <Table>
                <Thead>
                  <tr><Th>SKU</Th><Th>Competitor</Th><Th>Our Price</Th><Th>Their Price</Th><Th>Confidence</Th><Th>Status</Th><Th>Email</Th></tr>
                </Thead>
                <Tbody>
                  {checks.map(c => (
                    <Tr key={c.id}>
                      <Td><code className="text-[10px] bg-gray-100 px-1 rounded">{c.skus?.sku_id ?? '—'}</code></Td>
                      <Td><span className="text-xs">{c.competitor_name}</span></Td>
                      <Td><span className="text-xs font-medium">{formatCurrency(c.our_price)}</span></Td>
                      <Td><span className="text-xs font-medium text-red-600">{c.competitor_price ? formatCurrency(c.competitor_price) : 'N/A'}</span></Td>
                      <Td><span className="text-xs">{(c.match_confidence * 100).toFixed(0)}%</span></Td>
                      <Td><Badge className={getStatusColor(c.status as import('@/types').CompetitorCheckStatus)}>{getStatusLabel(c.status as import('@/types').CompetitorCheckStatus)}</Badge></Td>
                      <Td>{c.email_sent ? <Mail size={12} className="text-emerald-500" /> : <span className="text-[10px] text-gray-400">—</span>}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            ) : (
              <div className="py-8 text-center text-xs text-gray-400">No competitor check data for this run</div>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-end px-6 py-4 border-t border-gray-100">
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  )
}

function ScheduleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [freq, setFreq] = useState('daily')
  const [time, setTime] = useState('06:30')
  const [maxSKUs, setMaxSKUs] = useState('50')
  const [paused, setPaused] = useState(false)

  return (
    <Modal open={open} onClose={onClose} title="Agent Schedule Configuration" size="md">
      <div className="p-6 space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">Monitoring Frequency</p>
          <div className="grid grid-cols-4 gap-2">
            {['hourly', 'daily', 'weekly', 'custom'].map(f => (
              <button key={f} onClick={() => setFreq(f)}
                className={`p-2.5 text-xs font-medium rounded-lg border-2 capitalize transition-colors ${freq === f ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
        {freq !== 'custom' && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Run Time</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        )}
        {freq === 'custom' && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cron Expression</label>
            <input placeholder="0 6 * * *" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <p className="text-[10px] text-gray-400 mt-1">Example: <code>0 6 * * *</code> = daily at 6:00 AM</p>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Max SKUs per Run</label>
          <input type="number" value={maxSKUs} onChange={e => setMaxSKUs(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs font-medium text-gray-700">Pause Agent</p>
            <p className="text-[10px] text-gray-400">Temporarily suspend all scheduled runs</p>
          </div>
          <button onClick={() => setPaused(p => !p)}
            className={`w-10 h-5 rounded-full transition-colors relative ${paused ? 'bg-amber-400' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${paused ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
      </div>
      <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { toast.success('Schedule saved'); onClose() }}>Save Schedule</Button>
      </div>
    </Modal>
  )
}

export default function MonitoringPage() {
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRun, setSelectedRun] = useState<AgentRun | undefined>()
  const [showSchedule, setShowSchedule] = useState(false)
  const [running, setRunning] = useState(false)
  const [liveRunId, setLiveRunId] = useState<string | null>(null)

  const loadRuns = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/monitoring')
      const json = await res.json()
      setRuns(json.data ?? [])
    } catch {
      toast.error('Failed to load runs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadRuns() }, [loadRuns])

  const handleManualRun = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggered_by: 'manual' }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Failed to start agent'); return }
      setLiveRunId(json.runId)
    } finally {
      setRunning(false)
    }
  }

  const handleLiveRunClose = () => {
    setLiveRunId(null)
    loadRuns()
  }

  return (
    <div>
      <Topbar title="Monitoring Runs" subtitle="AI agent execution history and control" />
      <div className="p-6 space-y-4">

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-medium text-gray-700">Agent Status: <span className="text-emerald-600">Active</span></span>
            </div>
            <div className="w-px h-5 bg-gray-200" />
            <span className="text-xs text-gray-500">Schedule: <strong className="text-gray-700">Configure below</strong></span>
            <div className="w-px h-5 bg-gray-200" />
            <span className="text-xs text-gray-500">Total runs: <strong className="text-gray-700">{runs.length}</strong></span>
          </div>
          <Button variant="outline" onClick={() => setShowSchedule(true)}><Settings size={14} /> Configure</Button>
          <Button onClick={handleManualRun} disabled={running}>
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {running ? 'Agent Running…' : 'Run Now'}
          </Button>
        </div>

        {/* Run History */}
        <Card>
          <CardHeader>
            <CardTitle>Run History ({runs.length})</CardTitle>
          </CardHeader>
          <Table>
            <Thead>
              <tr>
                <Th>Run ID</Th>
                <Th>Started</Th>
                <Th>Duration</Th>
                <Th>Triggered</Th>
                <Th>SKUs</Th>
                <Th>Checks</Th>
                <Th>Mismatches</Th>
                <Th>Alerts</Th>
                <Th>Screenshots</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </Thead>
            <Tbody>
              {loading ? (
                <Tr>
                  <Td colSpan={11}>
                    <div className="py-12 text-center">
                      <Loader2 size={24} className="mx-auto text-gray-300 animate-spin mb-2" />
                      <p className="text-sm text-gray-400">Loading runs…</p>
                    </div>
                  </Td>
                </Tr>
              ) : runs.length === 0 ? (
                <Tr>
                  <Td colSpan={11}>
                    <div className="py-12 text-center">
                      <p className="text-sm text-gray-400">No runs yet — click Run Now to start.</p>
                    </div>
                  </Td>
                </Tr>
              ) : runs.map(run => {
                const duration = run.completed_at
                  ? Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 60000)
                  : null
                return (
                  <Tr key={run.id} onClick={() => setSelectedRun(run)}>
                    <Td><code className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">{run.id.slice(0, 8)}</code></Td>
                    <Td>
                      <div>
                        <p className="text-xs font-medium text-gray-900">{formatDateTime(run.started_at)}</p>
                        <p className="text-[10px] text-gray-400">{formatRelativeTime(run.started_at)}</p>
                      </div>
                    </Td>
                    <Td><span className="text-xs text-gray-600">{duration !== null ? `${duration}m` : '—'}</span></Td>
                    <Td>
                      <Badge className={run.triggered_by === 'manual' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'}>
                        {run.triggered_by === 'manual' ? <Zap size={9} className="mr-1" /> : <Calendar size={9} className="mr-1" />}
                        {run.triggered_by}
                      </Badge>
                    </Td>
                    <Td>
                      <span className="text-xs">{run.skus_processed}/{run.skus_total}</span>
                      {run.skus_total > 0 && (
                        <div className="w-16 bg-gray-100 rounded-full h-1 mt-1">
                          <div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${(run.skus_processed / run.skus_total) * 100}%` }} />
                        </div>
                      )}
                    </Td>
                    <Td><span className="text-xs">{run.competitors_checked}</span></Td>
                    <Td>
                      <span className={`text-xs font-semibold ${run.mismatches_found > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        {run.mismatches_found}
                      </span>
                    </Td>
                    <Td>
                      <span className={`text-xs font-semibold ${run.alerts_sent > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                        {run.alerts_sent}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Camera size={12} className="text-gray-400" /> {run.screenshots_captured}
                      </div>
                    </Td>
                    <Td><Badge className={getStatusColor(run.status)}>{run.status}</Badge></Td>
                    <Td>
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setSelectedRun(run) }}>Details</Button>
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        </Card>
      </div>

      {selectedRun && <RunDetailModal run={selectedRun} onClose={() => setSelectedRun(undefined)} />}
      {liveRunId  && <LiveRunModal runId={liveRunId} onClose={handleLiveRunClose} />}
      <ScheduleModal open={showSchedule} onClose={() => setShowSchedule(false)} />
    </div>
  )
}
