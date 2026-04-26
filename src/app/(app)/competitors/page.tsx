'use client'
import { useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select, TextArea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { mockCompetitors } from '@/lib/mock-data'
import { getStatusColor } from '@/lib/utils'
import type { Competitor } from '@/types'
import { Plus, Edit2, Trash2, Globe, Camera, Check, X, ToggleLeft, ToggleRight, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

const BUILT_IN_COMPETITORS = [
  { name: 'Jumbo', url: 'https://www.jumbo.com', logo: '🛒', country: 'UAE' },
  { name: 'Sharaf DG', url: 'https://www.sharafdg.com', logo: '🔌', country: 'UAE' },
  { name: 'Noon', url: 'https://www.noon.com', logo: '🌙', country: 'UAE' },
  { name: 'Amazon UAE', url: 'https://www.amazon.ae', logo: '📦', country: 'UAE' },
  { name: 'Carrefour UAE', url: 'https://www.carrefouruae.com', logo: '🏪', country: 'UAE' },
  { name: 'Emax', url: 'https://www.emaxuae.com', logo: '⚡', country: 'UAE' },
]

function CompetitorFormModal({ open, onClose, comp }: { open: boolean; onClose: () => void; comp?: Competitor }) {
  const [form, setForm] = useState({
    name: comp?.name || '',
    website_url: comp?.website_url || '',
    search_url_pattern: comp?.search_url_pattern || '',
    price_selector: comp?.price_selector || '',
    title_similarity_threshold: comp?.matching_rules.title_similarity_threshold?.toString() || '0.75',
    brand_match_required: comp?.matching_rules.brand_match_required ? 'true' : 'false',
    screenshot_required: comp?.screenshot_required ? 'true' : 'false',
    status: comp?.status || 'active',
  })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSave = () => {
    if (!form.name || !form.website_url) { toast.error('Name and Website URL are required'); return }
    toast.success(comp ? 'Competitor updated' : 'Competitor added')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={comp ? `Edit — ${comp.name}` : 'Add Competitor'} size="lg">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Competitor Name *" placeholder="e.g. Noon" value={form.name} onChange={set('name')} />
          <Input label="Website URL *" placeholder="https://www.noon.com" value={form.website_url} onChange={set('website_url')} />
        </div>
        <Input label="Search URL Pattern" placeholder="https://www.noon.com/search?q={query}" value={form.search_url_pattern} onChange={set('search_url_pattern')} />
        <p className="text-[10px] text-gray-400 -mt-2">Use {'{query}'} as placeholder for the search term</p>
        <Input label="Price CSS Selector" placeholder=".price-current, [data-qa='product-price']" value={form.price_selector} onChange={set('price_selector')} />
        <div className="grid grid-cols-3 gap-4">
          <Input label="Title Similarity Threshold" type="number" step="0.01" min="0" max="1" placeholder="0.75" value={form.title_similarity_threshold} onChange={set('title_similarity_threshold')} />
          <Select label="Brand Match Required" options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
            value={form.brand_match_required} onChange={set('brand_match_required')} />
          <Select label="Screenshot Required" options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
            value={form.screenshot_required} onChange={set('screenshot_required')} />
        </div>
        <Select label="Status" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
          value={form.status} onChange={set('status')} />

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs font-medium text-amber-800">Scraping Configuration Note</p>
          <p className="text-xs text-amber-700 mt-1">
            The price selector and search pattern are used by the Playwright automation agent at runtime.
            For complex sites, custom scraping rules can be added via the API.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>{comp ? 'Save Changes' : 'Add Competitor'}</Button>
      </div>
    </Modal>
  )
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState(mockCompetitors)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editComp, setEditComp] = useState<Competitor | undefined>()

  const toggleStatus = (id: string) => {
    setCompetitors(prev => prev.map(c => c.id === id
      ? { ...c, status: c.status === 'active' ? 'inactive' : 'active' }
      : c))
    toast.success('Competitor status updated')
  }

  const deleteComp = (id: string) => {
    setCompetitors(prev => prev.filter(c => c.id !== id))
    toast.success('Competitor removed')
  }

  return (
    <div>
      <Topbar title="Competitor Configuration" subtitle={`${competitors.filter(c => c.status === 'active').length} active competitors`} />
      <div className="p-6 space-y-6">

        {/* Quick Add Built-ins */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Quick Add — Pre-configured Competitors</CardTitle>
              <Button size="sm" onClick={() => setShowAddModal(true)}><Plus size={14} /> Custom Competitor</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {BUILT_IN_COMPETITORS.map(bc => {
                const existing = competitors.find(c => c.name === bc.name)
                return (
                  <button
                    key={bc.name}
                    onClick={() => !existing && toast.success(`${bc.name} added to competitors`)}
                    className={`p-4 border-2 rounded-xl text-center transition-all ${existing ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}
                  >
                    <div className="text-2xl mb-2">{bc.logo}</div>
                    <p className="text-xs font-semibold text-gray-800">{bc.name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{bc.country}</p>
                    {existing && (
                      <span className="mt-2 inline-flex items-center gap-1 text-[10px] text-indigo-600 font-medium">
                        <Check size={10} /> Active
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Competitors Table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {competitors.map(comp => (
            <Card key={comp.id} className={comp.status === 'inactive' ? 'opacity-60' : ''}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl shrink-0">{comp.logo || '🌐'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{comp.name}</h3>
                      <Badge className={getStatusColor(comp.status)}>{comp.status}</Badge>
                    </div>
                    <a href={comp.website_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:underline flex items-center gap-1 mt-0.5" onClick={e => e.stopPropagation()}>
                      {comp.website_url} <ExternalLink size={10} />
                    </a>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-[10px] text-gray-400 uppercase font-medium">Search Pattern</p>
                        <p className="text-[10px] text-gray-600 mt-0.5 truncate">{comp.search_url_pattern}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-[10px] text-gray-400 uppercase font-medium">Price Selector</p>
                        <code className="text-[10px] text-gray-600 mt-0.5 truncate block">{comp.price_selector}</code>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${comp.matching_rules.brand_match_required ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                        {comp.matching_rules.brand_match_required ? <Check size={9} /> : <X size={9} />} Brand match
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${comp.screenshot_required ? 'bg-violet-50 text-violet-600' : 'bg-gray-100 text-gray-500'}`}>
                        {comp.screenshot_required ? <Check size={9} /> : <X size={9} />} Screenshots
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        Confidence ≥ {(comp.matching_rules.title_similarity_threshold * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => setEditComp(comp)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"><Edit2 size={14} /></button>
                    <button onClick={() => toggleStatus(comp.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50">
                      {comp.status === 'active' ? <ToggleRight size={14} className="text-emerald-500" /> : <ToggleLeft size={14} />}
                    </button>
                    <button onClick={() => deleteComp(comp.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <CompetitorFormModal open={showAddModal || !!editComp} onClose={() => { setShowAddModal(false); setEditComp(undefined) }} comp={editComp} />
    </div>
  )
}
