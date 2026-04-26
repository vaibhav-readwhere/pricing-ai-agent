'use client'
import { useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, Thead, Th, Tbody, Tr, Td } from '@/components/ui/table'
import { mockRecommendations, mockAgentRuns, mockEmailAlerts, mockSKUs, mockCompetitors } from '@/lib/mock-data'
import { formatCurrency, formatDateTime, getStatusColor, getStatusLabel } from '@/lib/utils'
import { Download, BarChart3, TrendingDown, TrendingUp, AlertCircle, FileText, Mail, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'
import toast from 'react-hot-toast'

const priceComparisonData = [
  { product: 'iPhone 15 Pro', ours: 4599, min_competitor: 4299, avg_competitor: 4437 },
  { product: 'Galaxy S24', ours: 3299, min_competitor: 3099, avg_competitor: 3193 },
  { product: 'WH-1000XM5', ours: 1349, min_competitor: 1299, avg_competitor: 1373 },
  { product: 'MacBook Air M3', ours: 5299, min_competitor: 5399, avg_competitor: 5566 },
  { product: 'PS5', ours: 2299, min_competitor: 2199, avg_competitor: 2337 },
]

const runHistoryData = [
  { date: '22 Apr', skus: 6, mismatches: 3, alerts: 2 },
  { date: '23 Apr', skus: 6, mismatches: 5, alerts: 4 },
  { date: '24 Apr', skus: 6, mismatches: 2, alerts: 1 },
  { date: '25 Apr', skus: 6, mismatches: 5, alerts: 4 },
  { date: '26 Apr', skus: 6, mismatches: 2, alerts: 0 },
  { date: '27 Apr', skus: 6, mismatches: 4, alerts: 3 },
]

const competitorPricingData = [
  { name: 'Noon', overpriced: 3, underpriced: 1, ok: 2 },
  { name: 'Amazon UAE', overpriced: 2, underpriced: 2, ok: 2 },
  { name: 'Sharaf DG', overpriced: 1, underpriced: 3, ok: 2 },
  { name: 'Jumbo', overpriced: 2, underpriced: 1, ok: 3 },
  { name: 'Carrefour', overpriced: 1, underpriced: 0, ok: 3 },
]

const REPORT_TYPES = [
  { key: 'corrections', label: 'Price Corrections Needed', icon: TrendingDown },
  { key: 'lowest', label: 'Lowest Competitor Prices', icon: BarChart3 },
  { key: 'history', label: 'Price Change History', icon: RefreshCw },
  { key: 'runs', label: 'Agent Run History', icon: FileText },
  { key: 'alerts', label: 'Alert History', icon: Mail },
  { key: 'manual', label: 'Manual Review Items', icon: AlertCircle },
]

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState('corrections')

  const handleExport = (type: string) => {
    toast.success(`Exporting ${type} report as CSV...`)
  }

  return (
    <div>
      <Topbar title="Reports" subtitle="Price analysis, agent history, and export tools" />
      <div className="p-6 space-y-6">

        {/* Report Selector */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {REPORT_TYPES.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveReport(key)}
              className={`p-3 rounded-xl border-2 text-center transition-all ${activeReport === key ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200 bg-white'}`}>
              <Icon size={18} className={`mx-auto mb-1.5 ${activeReport === key ? 'text-indigo-600' : 'text-gray-400'}`} />
              <p className={`text-[10px] font-medium leading-tight ${activeReport === key ? 'text-indigo-700' : 'text-gray-600'}`}>{label}</p>
            </button>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Our Price vs Competitor Prices (AED)</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => handleExport('chart')}><Download size={13} /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={priceComparisonData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="product" tick={{ fontSize: 10 }} tickFormatter={v => v.split(' ')[0]} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => typeof v === 'number' ? `AED ${v.toLocaleString()}` : v} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="ours" name="Our Price" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="min_competitor" name="Min Competitor" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="avg_competitor" name="Avg Competitor" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Agent Run Trends — Last 7 Days</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => handleExport('trends')}><Download size={13} /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={runHistoryData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="mismatches" name="Mismatches" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="alerts" name="Alerts Sent" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="skus" name="SKUs Checked" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Competitor price distribution chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Competitor Analysis — Overpriced vs Underpriced vs OK</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => handleExport('competitor')}><Download size={13} /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={competitorPricingData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="overpriced" name="We're Overpriced" stackId="a" fill="#f43f5e" />
                <Bar dataKey="underpriced" name="We're Underpriced" stackId="a" fill="#3b82f6" />
                <Bar dataKey="ok" name="Price OK" stackId="a" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Report Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {REPORT_TYPES.find(r => r.key === activeReport)?.label}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => handleExport(activeReport)}>
                <Download size={13} /> Export CSV
              </Button>
            </div>
          </CardHeader>

          {activeReport === 'corrections' && (
            <Table>
              <Thead><tr><Th>Product</Th><Th>Brand</Th><Th>Current Price</Th><Th>Recommended</Th><Th>Difference</Th><Th>Status</Th><Th>Applied</Th></tr></Thead>
              <Tbody>
                {mockRecommendations.filter(r => r.action !== 'maintain').map(rec => (
                  <Tr key={rec.id}>
                    <Td><p className="text-xs font-medium max-w-[160px] truncate">{rec.sku_name}</p></Td>
                    <Td><span className="text-xs text-gray-500">{rec.sku_brand}</span></Td>
                    <Td><span className="text-sm font-medium">{formatCurrency(rec.current_price)}</span></Td>
                    <Td><span className="text-sm font-bold text-indigo-600">{formatCurrency(rec.recommended_price)}</span></Td>
                    <Td>
                      <span className={`text-xs font-semibold ${rec.price_diff < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {rec.price_diff > 0 ? '+' : ''}{formatCurrency(rec.price_diff)}
                      </span>
                    </Td>
                    <Td><Badge className={getStatusColor(rec.status)}>{getStatusLabel(rec.status)}</Badge></Td>
                    <Td>{rec.applied ? <Badge className="bg-emerald-100 text-emerald-700">Applied</Badge> : <Badge className="bg-gray-100 text-gray-600">Pending</Badge>}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

          {activeReport === 'lowest' && (
            <Table>
              <Thead><tr><Th>Competitor</Th><Th>SKU</Th><Th>Their Price</Th><Th>Our Price</Th><Th>Difference</Th></tr></Thead>
              <Tbody>
                {mockRecommendations.flatMap(rec => rec.competitor_data.map(c => ({ ...c, sku: rec.sku_name, our: rec.current_price }))).sort((a, b) => a.price - b.price).slice(0, 10).map((item, i) => (
                  <Tr key={i}>
                    <Td><span className="text-xs font-medium">{item.competitor_name}</span></Td>
                    <Td><p className="text-xs text-gray-600 max-w-[200px] truncate">{item.sku}</p></Td>
                    <Td><span className="text-sm font-bold text-red-600">{formatCurrency(item.price)}</span></Td>
                    <Td><span className="text-sm font-medium">{formatCurrency(item.our)}</span></Td>
                    <Td>
                      <span className={`text-xs font-semibold ${item.price < item.our ? 'text-red-600' : 'text-blue-600'}`}>
                        {item.price < item.our ? '-' : '+'}{formatCurrency(Math.abs(item.price - item.our))}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

          {activeReport === 'runs' && (
            <Table>
              <Thead><tr><Th>Run ID</Th><Th>Started</Th><Th>Status</Th><Th>SKUs</Th><Th>Mismatches</Th><Th>Alerts</Th><Th>Screenshots</Th></tr></Thead>
              <Tbody>
                {mockAgentRuns.map(run => (
                  <Tr key={run.id}>
                    <Td><code className="text-[10px] bg-gray-100 px-1.5 rounded">{run.id}</code></Td>
                    <Td><span className="text-xs">{formatDateTime(run.started_at)}</span></Td>
                    <Td><Badge className={getStatusColor(run.status)}>{run.status}</Badge></Td>
                    <Td><span className="text-xs">{run.skus_processed}/{run.skus_total}</span></Td>
                    <Td><span className={`text-xs font-semibold ${run.mismatches_found > 0 ? 'text-red-600' : 'text-gray-500'}`}>{run.mismatches_found}</span></Td>
                    <Td><span className="text-xs">{run.alerts_sent}</span></Td>
                    <Td><span className="text-xs">{run.screenshots_captured}</span></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

          {activeReport === 'alerts' && (
            <Table>
              <Thead><tr><Th>Product</Th><Th>Recipient</Th><Th>Competitor</Th><Th>Our Price</Th><Th>Their Price</Th><Th>Status</Th></tr></Thead>
              <Tbody>
                {mockEmailAlerts.map(a => (
                  <Tr key={a.id}>
                    <Td><p className="text-xs font-medium max-w-[160px] truncate">{a.sku_name}</p></Td>
                    <Td><span className="text-xs text-gray-600">{a.recipient}</span></Td>
                    <Td><span className="text-xs">{a.preview_data.competitor_name}</span></Td>
                    <Td><span className="text-xs">{formatCurrency(a.preview_data.our_price)}</span></Td>
                    <Td><span className="text-xs font-medium text-red-600">{formatCurrency(a.preview_data.competitor_price)}</span></Td>
                    <Td><Badge className={a.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{a.status}</Badge></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

          {activeReport === 'manual' && (
            <Table>
              <Thead><tr><Th>Product</Th><Th>Status</Th><Th>Current Price</Th><Th>Recommended</Th><Th>Notes</Th></tr></Thead>
              <Tbody>
                {mockRecommendations.filter(r => r.action === 'manual_review').map(rec => (
                  <Tr key={rec.id}>
                    <Td><p className="text-xs font-medium">{rec.sku_name}</p></Td>
                    <Td><Badge className={getStatusColor(rec.status)}>{getStatusLabel(rec.status)}</Badge></Td>
                    <Td><span className="text-sm font-medium">{formatCurrency(rec.current_price)}</span></Td>
                    <Td><span className="text-sm font-bold text-indigo-600">{formatCurrency(rec.recommended_price)}</span></Td>
                    <Td><span className="text-xs text-gray-500">Requires human decision</span></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

          {(activeReport === 'history') && (
            <CardContent>
              <div className="py-8 text-center text-sm text-gray-400">
                <RefreshCw size={24} className="mx-auto mb-2 text-gray-200" />
                Price change history requires database integration with Supabase.
                Connect Supabase to track historical price snapshots.
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
