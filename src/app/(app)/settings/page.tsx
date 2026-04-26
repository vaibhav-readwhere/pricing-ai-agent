'use client'
import { useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select, TextArea } from '@/components/ui/input'
import { Mail, Users, Shield, Bell, Database, Camera, Sliders, Save, TestTube, Check, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

const SETTING_TABS = [
  { key: 'email', label: 'Email Provider', icon: Mail },
  { key: 'users', label: 'User Roles', icon: Users },
  { key: 'thresholds', label: 'Price Thresholds', icon: Sliders },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'storage', label: 'Screenshot Storage', icon: Camera },
  { key: 'database', label: 'Database', icon: Database },
]

const MOCK_USERS = [
  { id: 'u1', name: 'Admin User', email: 'admin@company.com', role: 'admin', status: 'active' },
  { id: 'u2', name: 'Sarah Pricing', email: 'sarah@company.com', role: 'pricing_manager', status: 'active' },
  { id: 'u3', name: 'James Viewer', email: 'james@company.com', role: 'viewer', status: 'active' },
  { id: 'u4', name: 'Lisa Manager', email: 'lisa@company.com', role: 'pricing_manager', status: 'inactive' },
]

const ROLE_PERMS = {
  admin: ['View Dashboard', 'Manage SKUs', 'Configure Competitors', 'Run Agent', 'View Logs', 'Send Alerts', 'Edit Settings', 'Manage Users', 'View Reports', 'Apply Recommendations'],
  pricing_manager: ['View Dashboard', 'Manage SKUs', 'Run Agent', 'View Logs', 'View Reports', 'Apply Recommendations'],
  viewer: ['View Dashboard', 'View Logs', 'View Reports'],
}

function EmailSettings() {
  const [provider, setProvider] = useState('smtp')
  const [form, setForm] = useState({ host: '', port: '587', user: '', pass: '', from: 'alerts@pricewatch.ai', fromName: 'PriceWatch AI' })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))
  const [testing, setTesting] = useState(false)

  const testConnection = async () => {
    setTesting(true)
    await new Promise(r => setTimeout(r, 2000))
    setTesting(false)
    toast.error('SMTP connection failed — please check credentials')
  }

  return (
    <div className="space-y-4">
      <Select label="Email Provider" options={[
        { value: 'smtp', label: 'SMTP (Custom)' },
        { value: 'resend', label: 'Resend' },
        { value: 'sendgrid', label: 'SendGrid' },
      ]} value={provider} onChange={e => setProvider(e.target.value)} />

      {provider === 'smtp' && (
        <div className="grid grid-cols-2 gap-4">
          <Input label="SMTP Host" placeholder="smtp.gmail.com" value={form.host} onChange={set('host')} />
          <Input label="SMTP Port" type="number" placeholder="587" value={form.port} onChange={set('port')} />
          <Input label="SMTP Username" placeholder="user@example.com" value={form.user} onChange={set('user')} />
          <Input label="SMTP Password" type="password" placeholder="••••••••" value={form.pass} onChange={set('pass')} />
        </div>
      )}
      {provider === 'resend' && (
        <Input label="Resend API Key" type="password" placeholder="re_xxxxxxxxxxxx" />
      )}
      {provider === 'sendgrid' && (
        <Input label="SendGrid API Key" type="password" placeholder="SG.xxxxxxxxxxxx" />
      )}

      <div className="grid grid-cols-2 gap-4">
        <Input label="From Email Address" value={form.from} onChange={set('from')} />
        <Input label="From Name" value={form.fromName} onChange={set('fromName')} />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={testConnection} loading={testing}>
          <TestTube size={14} /> Test Connection
        </Button>
        <Button onClick={() => toast.success('Email settings saved')}>
          <Save size={14} /> Save Settings
        </Button>
      </div>
    </div>
  )
}

function UserSettings() {
  const [users, setUsers] = useState(MOCK_USERS)
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{users.length} users configured</p>
        <Button size="sm" onClick={() => toast.success('Invite sent (demo)')}>+ Invite User</Button>
      </div>
      <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
        {users.map(u => (
          <div key={u.id} className="flex items-center gap-4 p-4 bg-white hover:bg-gray-50">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">
              {u.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{u.name}</p>
              <p className="text-xs text-gray-400">{u.email}</p>
            </div>
            <select
              defaultValue={u.role}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              onChange={() => toast.success('Role updated')}
            >
              <option value="admin">Admin</option>
              <option value="pricing_manager">Pricing Manager</option>
              <option value="viewer">Viewer</option>
            </select>
            <Badge className={u.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}>
              {u.status}
            </Badge>
            <button className="text-xs text-red-500 hover:underline" onClick={() => toast.success('User removed (demo)')}>Remove</button>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-700 mb-3">Role Permissions</p>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(ROLE_PERMS).map(([role, perms]) => (
            <div key={role}>
              <Badge className={role === 'admin' ? 'bg-red-100 text-red-700' : role === 'pricing_manager' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}>
                {role.replace('_', ' ')}
              </Badge>
              <ul className="mt-2 space-y-1">
                {perms.map(p => (
                  <li key={p} className="flex items-center gap-1.5 text-[10px] text-gray-600">
                    <Check size={9} className="text-emerald-500" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ThresholdSettings() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Default Alert Threshold (%)" type="number" placeholder="5" defaultValue="5"
          className="col-span-2 md:col-span-1" />
        <Input label="Minimum Margin Threshold (%)" type="number" placeholder="8" defaultValue="8" />
        <Input label="Price Floor Buffer (AED)" type="number" placeholder="50" defaultValue="50" />
        <Input label="Price Ceiling Buffer (AED)" type="number" placeholder="200" defaultValue="200" />
        <Input label="Match Confidence Minimum (%)" type="number" placeholder="70" defaultValue="70" />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-700">Alert Rules</p>
        {[
          { label: 'Alert when we are overpriced vs competitor', checked: true },
          { label: 'Alert when we are underpriced vs competitor', checked: true },
          { label: 'Alert when competitor is out of stock', checked: false },
          { label: 'Alert when match confidence is low', checked: true },
          { label: 'Send summary digest email daily', checked: false },
        ].map(rule => (
          <label key={rule.label} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg cursor-pointer hover:bg-gray-50">
            <input type="checkbox" defaultChecked={rule.checked} className="rounded text-indigo-600" />
            <span className="text-xs text-gray-700">{rule.label}</span>
          </label>
        ))}
      </div>
      <Button onClick={() => toast.success('Threshold settings saved')}><Save size={14} /> Save Settings</Button>
    </div>
  )
}

function StorageSettings() {
  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-indigo-800">Supabase Storage</p>
        <p className="text-xs text-indigo-700 mt-1">Screenshots are automatically stored in your configured Supabase Storage bucket. Configure the bucket name and access policies below.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Supabase URL" placeholder="https://xxxx.supabase.co" />
        <Input label="Supabase Anon Key" type="password" placeholder="eyJhbGci..." />
        <Input label="Storage Bucket Name" placeholder="screenshots" defaultValue="screenshots" />
        <Input label="Screenshot Retention (days)" type="number" placeholder="90" defaultValue="90" />
      </div>
      <Button onClick={() => toast.success('Storage settings saved')}><Save size={14} /> Save Settings</Button>
    </div>
  )
}

function DatabaseSettings() {
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-amber-800">Connect Supabase Database</p>
          <p className="text-xs text-amber-700 mt-1">
            The app uses Supabase as the primary database. Add your connection details to enable live data persistence.
            Currently running in demo mode with mock data.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Supabase Project URL" placeholder="https://xxxx.supabase.co" />
        <Input label="Supabase Service Role Key" type="password" placeholder="eyJhbGci..." />
      </div>
      <div className="bg-gray-900 rounded-xl p-4">
        <p className="text-[10px] text-gray-400 mb-2 font-mono">Database Tables Required:</p>
        <div className="space-y-1">
          {['users', 'skus', 'competitors', 'competitor_checks', 'price_snapshots', 'screenshots', 'agent_runs', 'recommendations', 'email_alerts', 'notification_settings', 'audit_logs'].map(t => (
            <div key={t} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <code className="text-[10px] text-gray-300">{t}</code>
            </div>
          ))}
        </div>
      </div>
      <Button onClick={() => toast.success('Database settings saved')}><Save size={14} /> Save & Test Connection</Button>
    </div>
  )
}

function NotificationSettings() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-gray-700 mb-2">Default Alert Recipients</p>
        <TextArea placeholder="pricing@company.com&#10;manager@company.com&#10;director@company.com" rows={4}
          defaultValue="pricing@company.com&#13;manager@company.com" />
        <p className="text-[10px] text-gray-400 mt-1">One email per line. These receive all price alerts unless overridden at SKU level.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Alert Frequency Limit (alerts/hour)" type="number" defaultValue="10" />
        <Input label="Digest Email Time" type="time" defaultValue="08:00" />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-700">Notification Channels</p>
        {[
          { label: 'Email Alerts', desc: 'Send email notifications for price mismatches', enabled: true },
          { label: 'Slack Webhook', desc: 'Post alerts to a Slack channel', enabled: false },
          { label: 'MS Teams Webhook', desc: 'Post alerts to a Teams channel', enabled: false },
        ].map(ch => (
          <div key={ch.label} className="flex items-start justify-between p-3 border border-gray-200 rounded-xl">
            <div>
              <p className="text-xs font-medium text-gray-800">{ch.label}</p>
              <p className="text-[10px] text-gray-400">{ch.desc}</p>
            </div>
            <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${ch.enabled ? 'bg-indigo-500' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${ch.enabled ? 'left-5' : 'left-0.5'}`} />
            </div>
          </div>
        ))}
      </div>
      <Button onClick={() => toast.success('Notification settings saved')}><Save size={14} /> Save Settings</Button>
    </div>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState('email')
  return (
    <div>
      <Topbar title="Settings" subtitle="Configure email, users, thresholds, and integrations" />
      <div className="p-6">
        <div className="flex gap-6">
          {/* Sidebar nav */}
          <div className="w-48 shrink-0">
            <nav className="space-y-0.5">
              {SETTING_TABS.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${tab === key ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            <Card>
              <CardHeader>
                <CardTitle>{SETTING_TABS.find(t => t.key === tab)?.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {tab === 'email' && <EmailSettings />}
                {tab === 'users' && <UserSettings />}
                {tab === 'thresholds' && <ThresholdSettings />}
                {tab === 'notifications' && <NotificationSettings />}
                {tab === 'storage' && <StorageSettings />}
                {tab === 'database' && <DatabaseSettings />}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
