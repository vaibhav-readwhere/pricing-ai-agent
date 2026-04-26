'use client'
import { useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Table, Thead, Th, Tbody, Tr, Td } from '@/components/ui/table'
import { mockRecommendations } from '@/lib/mock-data'
import { formatCurrency, formatPercent, formatDateTime, getStatusColor, getStatusLabel } from '@/lib/utils'
import type { Recommendation } from '@/types'
import { TrendingDown, TrendingUp, Minus, CheckCircle, AlertCircle, Eye, ExternalLink, Filter } from 'lucide-react'
import toast from 'react-hot-toast'

const ACTION_FILTER_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'decrease', label: 'Decrease Price' },
  { value: 'increase', label: 'Increase Price' },
  { value: 'maintain', label: 'Maintain Price' },
  { value: 'manual_review', label: 'Manual Review' },
]

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'overpriced', label: 'Overpriced' },
  { value: 'underpriced', label: 'Underpriced' },
  { value: 'price_ok', label: 'Price OK' },
  { value: 'needs_manual_review', label: 'Manual Review' },
]

function ActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    decrease: 'bg-red-100 text-red-700',
    increase: 'bg-blue-100 text-blue-700',
    maintain: 'bg-emerald-100 text-emerald-700',
    manual_review: 'bg-purple-100 text-purple-700',
  }
  const icons: Record<string, React.ReactNode> = {
    decrease: <TrendingDown size={10} />,
    increase: <TrendingUp size={10} />,
    maintain: <Minus size={10} />,
    manual_review: <AlertCircle size={10} />,
  }
  return (
    <Badge className={`${styles[action] || 'bg-gray-100 text-gray-600'} flex items-center gap-1`}>
      {icons[action]} {action.replace('_', ' ')}
    </Badge>
  )
}

function RecommendationDetailModal({ rec, onClose }: { rec: Recommendation; onClose: () => void }) {
  return (
    <Modal open={true} onClose={onClose} title="Recommendation Detail" size="xl">
      <div className="p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900">{rec.sku_name}</h3>
            <p className="text-sm text-gray-500">{rec.sku_brand} · SKU {rec.sku_id}</p>
          </div>
          <div className="flex gap-2">
            <Badge className={getStatusColor(rec.status)}>{getStatusLabel(rec.status)}</Badge>
            <ActionBadge action={rec.action} />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Our Current Price', value: formatCurrency(rec.current_price), color: 'text-gray-900' },
            { label: 'Recommended Price', value: formatCurrency(rec.recommended_price), color: 'text-indigo-600' },
            { label: 'Lowest Competitor', value: formatCurrency(rec.lowest_competitor_price), color: 'text-red-600' },
            { label: 'Market Average', value: formatCurrency(rec.avg_competitor_price), color: 'text-gray-700' },
          ].map(item => (
            <div key={item.label} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500 uppercase">{item.label}</p>
              <p className={`text-lg font-bold mt-1 ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Price diff indicator */}
        <div className={`flex items-center gap-3 p-3 rounded-xl ${rec.price_diff < 0 ? 'bg-red-50 border border-red-100' : rec.price_diff > 0 ? 'bg-blue-50 border border-blue-100' : 'bg-emerald-50 border border-emerald-100'}`}>
          {rec.price_diff < 0 ? <TrendingDown size={18} className="text-red-500" /> : rec.price_diff > 0 ? <TrendingUp size={18} className="text-blue-500" /> : <Minus size={18} className="text-emerald-500" />}
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {rec.price_diff === 0 ? 'Price is competitive' : `${rec.price_diff > 0 ? 'Opportunity to increase' : 'Needs price reduction'} by ${formatCurrency(Math.abs(rec.price_diff))} (${formatPercent(Math.abs(rec.price_diff_pct))})`}
            </p>
            <p className="text-xs text-gray-500">Based on {rec.competitor_data.length} competitor prices</p>
          </div>
        </div>

        {/* Competitor breakdown */}
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-3">Competitor Price Breakdown</p>
          <div className="space-y-2">
            {rec.competitor_data.map((c, i) => {
              const diff = c.price - rec.current_price
              const pct = (diff / rec.current_price) * 100
              return (
                <div key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                  <div className="w-28 shrink-0">
                    <p className="text-xs font-medium text-gray-700">{c.competitor_name}</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${diff > 0 ? 'bg-blue-400' : diff < 0 ? 'bg-red-400' : 'bg-emerald-400'}`}
                        style={{ width: `${Math.min(100, (c.price / rec.highest_competitor_price) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right w-24 shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(c.price)}</p>
                    <p className={`text-[10px] ${diff > 0 ? 'text-blue-600' : diff < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {diff > 0 ? '+' : ''}{formatCurrency(diff)} ({formatPercent(pct)})
                    </p>
                  </div>
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                      <ExternalLink size={12} className="text-gray-400 hover:text-indigo-600" />
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="flex justify-between px-6 py-4 border-t border-gray-100">
        <Button variant="outline" onClick={onClose}>Close</Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { toast.success('Marked for manual review'); onClose() }}>
            <AlertCircle size={14} /> Manual Review
          </Button>
          <Button onClick={() => { toast.success('Recommendation applied!'); onClose() }}>
            <CheckCircle size={14} /> Apply Recommendation
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function RecommendationsPage() {
  const [recs, setRecs] = useState(mockRecommendations)
  const [actionFilter, setActionFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewRec, setViewRec] = useState<Recommendation | undefined>()

  const filtered = recs.filter(r =>
    (!actionFilter || r.action === actionFilter) &&
    (!statusFilter || r.status === statusFilter)
  )

  const applyRec = (id: string) => {
    setRecs(prev => prev.map(r => r.id === id ? { ...r, applied: true, reviewed: true } : r))
    toast.success('Recommendation applied!')
  }

  const dismissRec = (id: string) => {
    setRecs(prev => prev.map(r => r.id === id ? { ...r, reviewed: true } : r))
    toast.success('Marked as reviewed')
  }

  const summaryStats = {
    decrease: recs.filter(r => r.action === 'decrease').length,
    increase: recs.filter(r => r.action === 'increase').length,
    maintain: recs.filter(r => r.action === 'maintain').length,
    manual: recs.filter(r => r.action === 'manual_review').length,
  }

  return (
    <div>
      <Topbar title="Price Recommendations" subtitle="AI-generated pricing actions from last monitoring run" />
      <div className="p-6 space-y-4">

        {/* Summary */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Decrease Price', count: summaryStats.decrease, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
            { label: 'Increase Price', count: summaryStats.increase, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
            { label: 'Price OK', count: summaryStats.maintain, icon: Minus, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
            { label: 'Manual Review', count: summaryStats.manual, icon: AlertCircle, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
          ].map(item => (
            <div key={item.label} className={`bg-white border ${item.border} rounded-xl p-4 flex items-center gap-3`}>
              <div className={`p-2 ${item.bg} rounded-lg`}><item.icon size={18} className={item.color} /></div>
              <div><p className="text-2xl font-bold text-gray-900">{item.count}</p><p className="text-xs text-gray-500">{item.label}</p></div>
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recommendations ({filtered.length})</CardTitle>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-gray-400" />
                <Select options={ACTION_FILTER_OPTIONS} value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="w-40" />
                <Select options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-40" />
              </div>
            </div>
          </CardHeader>
          <Table>
            <Thead>
              <tr>
                <Th>Product</Th>
                <Th>Status</Th>
                <Th>Action</Th>
                <Th>Current Price</Th>
                <Th>Recommended</Th>
                <Th>Difference</Th>
                <Th>Competitors</Th>
                <Th>Reviewed</Th>
                <Th>Applied</Th>
                <Th>Actions</Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map(rec => (
                <Tr key={rec.id} onClick={() => setViewRec(rec)}>
                  <Td>
                    <div>
                      <p className="text-xs font-medium text-gray-900 truncate max-w-[160px]">{rec.sku_name}</p>
                      <p className="text-[10px] text-gray-400">{rec.sku_brand}</p>
                    </div>
                  </Td>
                  <Td><Badge className={getStatusColor(rec.status)}>{getStatusLabel(rec.status)}</Badge></Td>
                  <Td><ActionBadge action={rec.action} /></Td>
                  <Td><span className="text-sm font-medium text-gray-700">{formatCurrency(rec.current_price)}</span></Td>
                  <Td><span className="text-sm font-bold text-indigo-700">{formatCurrency(rec.recommended_price)}</span></Td>
                  <Td>
                    <span className={`text-xs font-semibold ${rec.price_diff < 0 ? 'text-red-600' : rec.price_diff > 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                      {rec.price_diff > 0 ? '+' : ''}{formatCurrency(rec.price_diff)}
                    </span>
                    <p className="text-[10px] text-gray-400">{rec.price_diff > 0 ? '+' : ''}{rec.price_diff_pct.toFixed(1)}%</p>
                  </Td>
                  <Td>
                    <div className="flex -space-x-1">
                      {rec.competitor_data.slice(0, 4).map((c, i) => (
                        <div key={i} title={`${c.competitor_name}: ${formatCurrency(c.price)}`}
                          className="w-5 h-5 rounded-full bg-indigo-100 border border-white flex items-center justify-center text-[8px] font-bold text-indigo-700">
                          {c.competitor_name[0]}
                        </div>
                      ))}
                      {rec.competitor_data.length > 4 && <span className="text-[10px] text-gray-400 ml-1">+{rec.competitor_data.length - 4}</span>}
                    </div>
                  </Td>
                  <Td>{rec.reviewed ? <CheckCircle size={14} className="text-emerald-500" /> : <span className="text-[10px] text-gray-300">—</span>}</Td>
                  <Td>{rec.applied ? <CheckCircle size={14} className="text-indigo-500" /> : <span className="text-[10px] text-gray-300">—</span>}</Td>
                  <Td>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button title="View" onClick={() => setViewRec(rec)} className="p-1 rounded text-gray-400 hover:text-indigo-600"><Eye size={12} /></button>
                      {!rec.applied && (
                        <button title="Apply" onClick={() => applyRec(rec.id)} className="p-1 rounded text-gray-400 hover:text-emerald-600"><CheckCircle size={12} /></button>
                      )}
                      {!rec.reviewed && (
                        <button title="Dismiss" onClick={() => dismissRec(rec.id)} className="p-1 rounded text-gray-400 hover:text-gray-600"><Minus size={12} /></button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Card>
      </div>
      {viewRec && <RecommendationDetailModal rec={viewRec} onClose={() => setViewRec(undefined)} />}
    </div>
  )
}
