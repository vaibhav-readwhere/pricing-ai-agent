'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Table, Thead, Th, Tbody, Tr, Td } from '@/components/ui/table'
import { formatCurrency, formatRelativeTime, getStatusColor } from '@/lib/utils'
import type { SKU, Competitor } from '@/types'
import {
  Upload, Plus, Search, Edit2, Trash2, Eye,
  Download, Package, CheckCircle, PauseCircle, Clock, Loader2, ImagePlus, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import Papa from 'papaparse'

const FREQ_OPTIONS = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom Cron' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'inactive', label: 'Inactive' },
]

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'Smartphones', label: 'Smartphones' },
  { value: 'Laptops', label: 'Laptops' },
  { value: 'Audio', label: 'Audio' },
  { value: 'Gaming', label: 'Gaming' },
  { value: 'Televisions', label: 'Televisions' },
]

function SKUFormModal({
  open, onClose, sku, competitors, onSave,
}: {
  open: boolean
  onClose: () => void
  sku?: SKU
  competitors: Competitor[]
  onSave: (saved: SKU) => void
}) {
  const [saving, setSaving] = useState(false)
  const [imageUrl, setImageUrl] = useState(sku?.image_url || '')
  const [imagePreview, setImagePreview] = useState(sku?.image_url || '')
  const [uploadingImage, setUploadingImage] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    sku_id: sku?.sku_id || '',
    product_name: sku?.product_name || '',
    brand: sku?.brand || '',
    category: sku?.category || '',
    current_price: sku?.current_price?.toString() || '',
    product_url: sku?.product_url || '',
    target_marketplace: sku?.target_marketplace || 'UAE',
    min_price: sku?.min_price?.toString() || '',
    max_price: sku?.max_price?.toString() || '',
    margin_threshold: sku?.margin_threshold?.toString() || '8',
    alert_recipients: sku?.alert_recipients?.join(', ') || '',
    monitoring_frequency: sku?.monitoring_frequency || 'daily',
  })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleImagePick = async (file: File) => {
    setImagePreview(URL.createObjectURL(file))
    setUploadingImage(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/skus/upload-image', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Upload failed'); setImagePreview(imageUrl); return }
      setImageUrl(json.url)
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSave = async () => {
    if (!form.sku_id || !form.product_name) {
      toast.error('SKU ID and Product Name are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        current_price: Number(form.current_price),
        min_price: Number(form.min_price),
        max_price: Number(form.max_price),
        margin_threshold: Number(form.margin_threshold),
        alert_recipients: form.alert_recipients.split(',').map(e => e.trim()).filter(Boolean),
        image_url: imageUrl || null,
      }
      const url = sku ? `/api/skus/${sku.id}` : '/api/skus'
      const method = sku ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Failed to save'); return }
      onSave(json.data)
      toast.success(sku ? 'SKU updated' : 'SKU added')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={sku ? 'Edit SKU' : 'Add New SKU'} size="xl">
      <div className="p-6 space-y-4">

        {/* Product Image */}
        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">Product Image</p>
          <div className="flex items-start gap-4">
            <div
              className="relative w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-colors overflow-hidden shrink-0"
              onClick={() => imageInputRef.current?.click()}
            >
              {imagePreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="product" className="w-full h-full object-cover" />
                  {uploadingImage && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                      <Loader2 size={16} className="animate-spin text-indigo-500" />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center">
                  {uploadingImage
                    ? <Loader2 size={20} className="mx-auto text-indigo-400 animate-spin" />
                    : <ImagePlus size={20} className="mx-auto text-gray-300" />}
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Click the box to upload a product image</p>
              <p className="text-[10px] text-gray-400 mt-0.5">JPG, PNG, WebP — max 5 MB</p>
              {imagePreview && (
                <button
                  type="button"
                  onClick={() => { setImageUrl(''); setImagePreview('') }}
                  className="mt-2 flex items-center gap-1 text-[10px] text-red-500 hover:text-red-700"
                >
                  <X size={10} /> Remove image
                </button>
              )}
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImagePick(f) }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="SKU ID *" placeholder="APPL-IP15P-256-BLK" value={form.sku_id} onChange={set('sku_id')} />
          <Input label="Product Name *" placeholder="Apple iPhone 15 Pro 256GB" value={form.product_name} onChange={set('product_name')} />
          <Input label="Brand" placeholder="Apple" value={form.brand} onChange={set('brand')} />
          <Input label="Category" placeholder="Smartphones" value={form.category} onChange={set('category')} />
          <Input label="Current Selling Price (AED)" type="number" placeholder="4599" value={form.current_price} onChange={set('current_price')} />
          <Input label="Target Marketplace" placeholder="UAE" value={form.target_marketplace} onChange={set('target_marketplace')} />
          <Input label="Minimum Allowed Price (AED)" type="number" placeholder="4200" value={form.min_price} onChange={set('min_price')} />
          <Input label="Maximum Allowed Price (AED)" type="number" placeholder="5200" value={form.max_price} onChange={set('max_price')} />
          <Input label="Margin Threshold (%)" type="number" placeholder="8" value={form.margin_threshold} onChange={set('margin_threshold')} />
          <Select label="Monitoring Frequency" options={FREQ_OPTIONS} value={form.monitoring_frequency}
            onChange={e => setForm(f => ({ ...f, monitoring_frequency: e.target.value as SKU['monitoring_frequency'] }))} />
        </div>
        <Input label="Product URL (optional)" placeholder="https://yourstore.com/product" value={form.product_url} onChange={set('product_url')} />
        <Input label="Alert Recipients (comma-separated emails)" placeholder="pricing@company.com, manager@company.com" value={form.alert_recipients} onChange={set('alert_recipients')} />
        {competitors.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-700 mb-2">Active Competitors</p>
            <div className="grid grid-cols-3 gap-2">
              {competitors.map(c => (
                <div key={c.id} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg bg-gray-50">
                  <span className="text-xs text-gray-700">{c.logo} {c.name}</span>
                  <Badge className={`ml-auto text-[9px] ${getStatusColor(c.status)}`}>{c.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          {sku ? 'Save Changes' : 'Add SKU'}
        </Button>
      </div>
    </Modal>
  )
}

function CSVUploadModal({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<Record<string, string>[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)

  const handleFile = (file: File) => {
    setFileName(file.name)
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => setPreview((results.data as Record<string, string>[]).slice(0, 5))
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleImport = async () => {
    if (!preview.length) return
    setImporting(true)
    let successCount = 0
    for (const row of preview) {
      try {
        const res = await fetch('/api/skus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...row,
            current_price: Number(row.current_price),
            min_price: Number(row.min_price),
            max_price: Number(row.max_price),
            margin_threshold: Number(row.margin_threshold) || 8,
            alert_recipients: row.alert_recipients ? row.alert_recipients.split(',').map((e: string) => e.trim()) : [],
          }),
        })
        if (res.ok) successCount++
      } catch { /* skip bad rows */ }
    }
    setImporting(false)
    toast.success(`${successCount} SKUs imported`)
    onImport()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Upload SKU List" size="lg">
      <div className="p-6 space-y-4">
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <Upload size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-700">Drag & drop your CSV or XLSX file here</p>
          <p className="text-xs text-gray-400 mt-1">Supports .csv formats up to 10MB</p>
          <button onClick={() => fileRef.current?.click()}
            className="mt-3 px-4 py-2 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50">
            Browse File
          </button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          {fileName && <p className="mt-2 text-xs text-gray-600 font-medium">✓ {fileName}</p>}
        </div>

        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-700 mb-2">Expected CSV Columns:</p>
          <div className="flex flex-wrap gap-1.5">
            {['sku_id', 'product_name', 'brand', 'category', 'current_price', 'product_url', 'target_marketplace', 'min_price', 'max_price', 'margin_threshold', 'alert_recipients', 'monitoring_frequency'].map(col => (
              <code key={col} className="bg-white border border-gray-200 rounded px-2 py-0.5 text-[10px] text-gray-600">{col}</code>
            ))}
          </div>
          <button className="mt-3 flex items-center gap-1 text-xs text-indigo-600 hover:underline">
            <Download size={12} /> Download sample CSV template
          </button>
        </div>

        {preview.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">Preview ({preview.length} rows)</p>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="text-[10px] w-full">
                <thead className="bg-gray-50">
                  <tr>{Object.keys(preview[0]).map(k => <th key={k} className="px-2 py-1.5 text-left text-gray-500 font-medium">{k}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.map((row, i) => (
                    <tr key={i}>{Object.values(row).map((v, j) => <td key={j} className="px-2 py-1 text-gray-600 truncate max-w-30">{v}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleImport} disabled={!fileName || importing}>
          {importing && <Loader2 size={14} className="animate-spin" />}
          Import SKUs
        </Button>
      </div>
    </Modal>
  )
}

export default function SKUsPage() {
  const [skus, setSkus] = useState<SKU[]>([])
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [editSKU, setEditSKU] = useState<SKU | undefined>()
  const [viewSKU, setViewSKU] = useState<SKU | undefined>()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (categoryFilter) params.set('category', categoryFilter)
      if (search) params.set('search', search)

      const [skuRes, compRes] = await Promise.all([
        fetch(`/api/skus?${params}`),
        fetch('/api/competitors'),
      ])
      const [skuJson, compJson] = await Promise.all([skuRes.json(), compRes.json()])
      setSkus(skuJson.data ?? [])
      setCompetitors(compJson.data ?? [])
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, categoryFilter])

  useEffect(() => { loadData() }, [loadData])

  const handleSaved = (saved: SKU) => {
    setSkus(prev => {
      const idx = prev.findIndex(s => s.id === saved.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
      return [saved, ...prev]
    })
  }

  const toggleStatus = async (sku: SKU) => {
    const newStatus = sku.status === 'active' ? 'paused' : 'active'
    const res = await fetch(`/api/skus/${sku.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) { toast.error('Failed to update status'); return }
    setSkus(prev => prev.map(s => s.id === sku.id ? { ...s, status: newStatus } : s))
    toast.success('Status updated')
  }

  const deleteSKU = async (id: string) => {
    const res = await fetch(`/api/skus/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete'); return }
    setSkus(prev => prev.filter(s => s.id !== id))
    toast.success('SKU removed')
  }

  const statusCounts = {
    active: skus.filter(s => s.status === 'active').length,
    paused: skus.filter(s => s.status === 'paused').length,
  }

  return (
    <div>
      <Topbar title="SKU Management" subtitle={`${skus.length} SKUs total · ${statusCounts.active} active`} />
      <div className="p-6 space-y-4">

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg"><CheckCircle size={18} className="text-emerald-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{statusCounts.active}</p><p className="text-xs text-gray-500">Active SKUs</p></div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg"><PauseCircle size={18} className="text-amber-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{statusCounts.paused}</p><p className="text-xs text-gray-500">Paused SKUs</p></div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg"><Clock size={18} className="text-indigo-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{skus.filter(s => s.last_checked).length}</p><p className="text-xs text-gray-500">Checked Today</p></div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex gap-2">
                <Input icon={<Search size={14} />} placeholder="Search by name, SKU ID, brand..." value={search} onChange={e => setSearch(e.target.value)} />
                <Select options={STATUS_OPTIONS} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-36" />
                <Select options={CATEGORY_OPTIONS} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-44" />
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setShowUploadModal(true)}><Upload size={14} /> Import CSV</Button>
                <Button size="sm" onClick={() => setShowAddModal(true)}><Plus size={14} /> Add SKU</Button>
              </div>
            </div>
          </CardHeader>
          <Table>
            <Thead>
              <tr>
                <Th>{' '}</Th>
                <Th>SKU</Th>
                <Th>Product</Th>
                <Th>Brand</Th>
                <Th>Category</Th>
                <Th>Current Price</Th>
                <Th>Price Range</Th>
                <Th>Frequency</Th>
                <Th>Last Checked</Th>
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
                      <p className="text-sm text-gray-400">Loading SKUs…</p>
                    </div>
                  </Td>
                </Tr>
              ) : skus.length === 0 ? (
                <Tr>
                  <Td colSpan={11}>
                    <div className="py-12 text-center">
                      <Package size={32} className="mx-auto text-gray-200 mb-2" />
                      <p className="text-sm text-gray-400">No SKUs found — add your first SKU</p>
                    </div>
                  </Td>
                </Tr>
              ) : skus.map(sku => (
                <Tr key={sku.id}>
                  <Td>
                    {sku.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sku.image_url} alt={sku.product_name} className="w-9 h-9 rounded-lg object-cover border border-gray-100" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Package size={14} className="text-gray-300" />
                      </div>
                    )}
                  </Td>
                  <Td><code className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{sku.sku_id}</code></Td>
                  <Td>
                    <div className="max-w-50">
                      <p className="text-xs font-medium text-gray-900 truncate">{sku.product_name}</p>
                    </div>
                  </Td>
                  <Td><span className="text-xs text-gray-600">{sku.brand}</span></Td>
                  <Td><Badge className="bg-gray-100 text-gray-600">{sku.category}</Badge></Td>
                  <Td><span className="text-sm font-semibold text-gray-900">{formatCurrency(sku.current_price)}</span></Td>
                  <Td>
                    <div className="text-[10px] text-gray-500">
                      <span className="text-emerald-600">{formatCurrency(sku.min_price)}</span> — <span className="text-blue-600">{formatCurrency(sku.max_price)}</span>
                    </div>
                  </Td>
                  <Td><Badge className="bg-indigo-50 text-indigo-700">{sku.monitoring_frequency}</Badge></Td>
                  <Td>
                    {sku.last_checked
                      ? <span className="text-xs text-gray-500">{formatRelativeTime(sku.last_checked)}</span>
                      : <span className="text-xs text-gray-300">Never</span>}
                  </Td>
                  <Td><Badge className={getStatusColor(sku.status)}>{sku.status}</Badge></Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <button title="View" onClick={() => setViewSKU(sku)} className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"><Eye size={14} /></button>
                      <button title="Edit" onClick={() => setEditSKU(sku)} className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"><Edit2 size={14} /></button>
                      <button title={sku.status === 'active' ? 'Pause' : 'Resume'} onClick={() => toggleStatus(sku)} className="p-1 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50">
                        {sku.status === 'active' ? <PauseCircle size={14} /> : <CheckCircle size={14} />}
                      </button>
                      <button title="Delete" onClick={() => deleteSKU(sku.id)} className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Card>
      </div>

      <SKUFormModal
        key={editSKU?.id ?? 'new'}
        open={showAddModal || !!editSKU}
        onClose={() => { setShowAddModal(false); setEditSKU(undefined) }}
        sku={editSKU}
        competitors={competitors}
        onSave={handleSaved}
      />
      <CSVUploadModal open={showUploadModal} onClose={() => setShowUploadModal(false)} onImport={loadData} />

      {viewSKU && (
        <Modal open={!!viewSKU} onClose={() => setViewSKU(undefined)} title="SKU Details" size="lg">
          <div className="p-6 space-y-4">
            {viewSKU.image_url && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={viewSKU.image_url} alt={viewSKU.product_name}
                  className="h-40 w-auto max-w-full rounded-xl border border-gray-100 object-contain bg-gray-50" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {[
                ['SKU ID', viewSKU.sku_id],
                ['Product Name', viewSKU.product_name],
                ['Brand', viewSKU.brand],
                ['Category', viewSKU.category],
                ['Current Price', formatCurrency(viewSKU.current_price)],
                ['Min Price', formatCurrency(viewSKU.min_price)],
                ['Max Price', formatCurrency(viewSKU.max_price)],
                ['Margin Threshold', `${viewSKU.margin_threshold}%`],
                ['Frequency', viewSKU.monitoring_frequency],
                ['Status', viewSKU.status],
                ['Last Checked', viewSKU.last_checked ? formatRelativeTime(viewSKU.last_checked) : 'Never'],
                ['Alert Recipients', viewSKU.alert_recipients?.join(', ') || '—'],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 uppercase font-medium">{label}</p>
                  <p className="text-sm text-gray-900 font-medium mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
            <Button variant="outline" onClick={() => setViewSKU(undefined)}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
