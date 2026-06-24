'use client'
import { useState, useEffect } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, TextArea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Table, Thead, Th, Tbody, Tr, Td } from '@/components/ui/table'
import { formatCurrency, formatDateTime, formatRelativeTime, getStatusColor } from '@/lib/utils'
import type { EmailAlert } from '@/types'
import { Mail, CheckCircle, XCircle, Clock, Eye, Send, Edit2, AlertTriangle, TrendingDown, TrendingUp, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

function AlertPreviewModal({ alert, onClose }: { alert: EmailAlert; onClose: () => void }) {
  const diff = alert.preview_data.competitor_price - alert.preview_data.our_price
  const isOverpriced = diff < 0
  return (
    <Modal open={true} onClose={onClose} title="Email Preview" size="lg">
      <div className="p-6">
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex gap-2"><span className="text-gray-400 w-12">From:</span><span>PriceWatch AI &lt;alerts@pricewatch.ai&gt;</span></div>
              <div className="flex gap-2"><span className="text-gray-400 w-12">To:</span><span>{alert.recipient}</span></div>
              <div className="flex gap-2"><span className="text-gray-400 w-12">Subject:</span><span className="font-medium">{alert.subject}</span></div>
              {alert.sent_at && <div className="flex gap-2"><span className="text-gray-400 w-12">Sent:</span><span>{formatDateTime(alert.sent_at)}</span></div>}
            </div>
          </div>
          <div className="bg-white p-6">
            <div className={`border-l-4 ${isOverpriced ? 'border-red-400' : 'border-blue-400'} pl-4 mb-5`}>
              <p className={`text-base font-bold ${isOverpriced ? 'text-red-700' : 'text-blue-700'}`}>
                {isOverpriced ? '⚠️ Price Alert — We Are Overpriced' : '📈 Opportunity — We Can Increase Price'}
              </p>
              <p className="text-sm text-gray-600 mt-1">{alert.sku_name}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-400 uppercase font-medium">Our Price</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(alert.preview_data.our_price)}</p>
              </div>
              <div className={`${isOverpriced ? 'bg-red-50' : 'bg-blue-50'} rounded-lg p-3 text-center`}>
                <p className="text-[10px] text-gray-400 uppercase font-medium">{alert.preview_data.competitor_name}</p>
                <p className={`text-xl font-bold mt-1 ${isOverpriced ? 'text-red-700' : 'text-blue-700'}`}>{formatCurrency(alert.preview_data.competitor_price)}</p>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-400 uppercase font-medium">Recommended</p>
                <p className="text-xl font-bold text-indigo-700 mt-1">{formatCurrency(alert.preview_data.recommended_price)}</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-xs font-semibold text-gray-700 mb-1">Reason for Alert</p>
              <p className="text-sm text-gray-600">{alert.preview_data.reason}</p>
            </div>
            <div className="flex gap-3">
              <button className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg text-center">Review Recommendation</button>
              <button className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg text-center">View Full Report</button>
            </div>
            <p className="text-[10px] text-gray-400 mt-4 text-center">
              PriceWatch AI · Automated at {alert.sent_at ? formatDateTime(alert.sent_at) : 'Pending'} · Unsubscribe
            </p>
          </div>
        </div>
      </div>
      <div className="flex justify-end px-6 py-4 border-t border-gray-100">
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  )
}

function EmailTemplateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [subject, setSubject] = useState('⚠️ Price Alert: {{product_name}} — {{action}} vs {{competitor_name}}')
  const [body, setBody] = useState(`Hi Team,

Our AI pricing agent has detected a price {{action}} for the following product:

Product: {{product_name}}
SKU: {{sku_id}}
Our Price: AED {{our_price}}
{{competitor_name}} Price: AED {{competitor_price}}
Recommended Price: AED {{recommended_price}}

Reason: {{reason}}

Screenshot evidence: {{screenshot_link}}

Please review and take action in the PriceWatch dashboard.

— PriceWatch AI Agent`)

  return (
    <Modal open={open} onClose={onClose} title="Email Template Editor" size="xl">
      <div className="p-6 space-y-4">
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-indigo-800 mb-2">Available Template Variables</p>
          <div className="flex flex-wrap gap-1.5">
            {['{{product_name}}', '{{sku_id}}', '{{our_price}}', '{{competitor_name}}', '{{competitor_price}}', '{{recommended_price}}', '{{reason}}', '{{action}}', '{{screenshot_link}}', '{{timestamp}}', '{{competitor_url}}'].map(v => (
              <code key={v} className="bg-white border border-indigo-200 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded">{v}</code>
            ))}
          </div>
        </div>
        <Input label="Email Subject Template" value={subject} onChange={e => setSubject(e.target.value)} />
        <TextArea label="Email Body Template" value={body} onChange={e => setBody(e.target.value)} rows={14} className="font-mono text-xs" />
      </div>
      <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { toast.success('Email template saved'); onClose() }}>Save Template</Button>
      </div>
    </Modal>
  )
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<EmailAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ sent: 0, failed: 0, pending: 0 })
  const [previewAlert, setPreviewAlert] = useState<EmailAlert | undefined>()
  const [showTemplate, setShowTemplate] = useState(false)

  useEffect(() => {
    fetch('/api/alerts')
      .then(r => r.json())
      .then(json => {
        setAlerts(json.data ?? [])
        setStats(json.stats ?? { sent: 0, failed: 0, pending: 0 })
      })
      .catch(() => toast.error('Failed to load alerts'))
      .finally(() => setLoading(false))
  }, [])

  const resend = async (id: string) => {
    toast.loading('Resending...', { id: 'resend' })
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: 'POST' })
      if (!res.ok) { toast.error('Failed to resend', { id: 'resend' }); return }
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'pending' as const, error_message: undefined, sent_at: undefined } : a))
      setStats(prev => ({ ...prev, failed: prev.failed - 1, pending: prev.pending + 1 }))
      toast.success('Alert queued for resend', { id: 'resend' })
    } catch {
      toast.error('Failed to resend', { id: 'resend' })
    }
  }

  return (
    <div>
      <Topbar title="Email Alerts" subtitle="Price mismatch notifications and delivery status" />
      <div className="p-6 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg"><CheckCircle size={18} className="text-emerald-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{stats.sent}</p><p className="text-xs text-gray-500">Sent Successfully</p></div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg"><XCircle size={18} className="text-red-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{stats.failed}</p><p className="text-xs text-gray-500">Failed</p></div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg"><Clock size={18} className="text-amber-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{stats.pending}</p><p className="text-xs text-gray-500">Pending</p></div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Alert History ({alerts.length})</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowTemplate(true)}>
                <Edit2 size={14} /> Edit Template
              </Button>
            </div>
          </CardHeader>
          <Table>
            <Thead>
              <tr>
                <Th>Product</Th>
                <Th>Alert Type</Th>
                <Th>Recipient</Th>
                <Th>Our Price</Th>
                <Th>Competitor</Th>
                <Th>Their Price</Th>
                <Th>Recommended</Th>
                <Th>Status</Th>
                <Th>Sent At</Th>
                <Th>Actions</Th>
              </tr>
            </Thead>
            <Tbody>
              {loading ? (
                <Tr><Td colSpan={10}><div className="py-12 text-center"><Loader2 size={20} className="mx-auto text-gray-300 animate-spin mb-2" /><p className="text-sm text-gray-400">Loading alerts…</p></div></Td></Tr>
              ) : alerts.length === 0 ? (
                <Tr><Td colSpan={10}><div className="py-12 text-center"><Mail size={28} className="mx-auto text-gray-200 mb-2" /><p className="text-sm text-gray-400">No alerts yet — they appear after the agent runs and detects price mismatches.</p></div></Td></Tr>
              ) : alerts.map(alert => {
                const isOverpriced = alert.preview_data?.competitor_price < alert.preview_data?.our_price
                return (
                  <Tr key={alert.id}>
                    <Td>
                      <div className="max-w-36">
                        <p className="text-xs font-medium text-gray-900 truncate">{alert.sku_name}</p>
                      </div>
                    </Td>
                    <Td>
                      <div className={`flex items-center gap-1 text-[10px] font-medium ${isOverpriced ? 'text-red-600' : 'text-blue-600'}`}>
                        {isOverpriced ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                        {isOverpriced ? 'Overpriced' : 'Underpriced'}
                      </div>
                    </Td>
                    <Td><span className="text-xs text-gray-600">{alert.recipient}</span></Td>
                    <Td><span className="text-xs font-medium">{formatCurrency(alert.preview_data?.our_price)}</span></Td>
                    <Td><span className="text-xs text-gray-600">{alert.preview_data?.competitor_name}</span></Td>
                    <Td>
                      <span className={`text-xs font-semibold ${isOverpriced ? 'text-red-600' : 'text-blue-600'}`}>
                        {formatCurrency(alert.preview_data?.competitor_price)}
                      </span>
                    </Td>
                    <Td><span className="text-xs font-semibold text-indigo-600">{formatCurrency(alert.preview_data?.recommended_price)}</span></Td>
                    <Td>
                      <Badge className={alert.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : alert.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}>
                        {alert.status === 'sent' ? <CheckCircle size={9} className="mr-1" /> : alert.status === 'failed' ? <XCircle size={9} className="mr-1" /> : null}
                        {alert.status}
                      </Badge>
                    </Td>
                    <Td>
                      {alert.sent_at
                        ? <span className="text-xs text-gray-500">{formatRelativeTime(alert.sent_at)}</span>
                        : alert.error_message
                          ? <span className="text-[10px] text-red-500 truncate max-w-25 block">{alert.error_message}</span>
                          : <span className="text-xs text-gray-400">—</span>}
                    </Td>
                    <Td>
                      <div className="flex gap-1">
                        <button title="Preview" onClick={() => setPreviewAlert(alert)} className="p-1 rounded text-gray-400 hover:text-indigo-600"><Eye size={13} /></button>
                        {alert.status === 'failed' && (
                          <button title="Resend" onClick={() => resend(alert.id)} className="p-1 rounded text-gray-400 hover:text-emerald-600"><Send size={13} /></button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        </Card>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-gray-700">Email Provider Not Configured</p>
            <p className="text-xs text-gray-500 mt-1">Configure your SMTP or email API credentials in Settings → Email Provider to enable real email delivery.</p>
            <Button variant="outline" size="sm" className="mt-2">Go to Settings</Button>
          </div>
        </div>
      </div>

      {previewAlert && <AlertPreviewModal alert={previewAlert} onClose={() => setPreviewAlert(undefined)} />}
      <EmailTemplateModal open={showTemplate} onClose={() => setShowTemplate(false)} />
    </div>
  )
}
