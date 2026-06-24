import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { CompetitorCheckStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'AED') {
  return `${currency} ${amount.toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function formatPercent(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(date: string) {
  return new Date(date).toLocaleString('en-AE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatRelativeTime(date: string) {
  const now = new Date()
  const then = new Date(date)
  const diff = now.getTime() - then.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export function getStatusLabel(status: CompetitorCheckStatus): string {
  const labels: Record<CompetitorCheckStatus, string> = {
    price_ok: 'Price OK',
    overpriced: 'Overpriced',
    underpriced: 'Underpriced',
    competitor_out_of_stock: 'Competitor OOS',
    needs_manual_review: 'Manual Review',
    low_confidence: 'Low Confidence',
    error: 'Error',
  }
  return labels[status]
}

export function getStatusColor(status: CompetitorCheckStatus | string): string {
  const colors: Record<string, string> = {
    price_ok: 'bg-emerald-100 text-emerald-700',
    overpriced: 'bg-red-100 text-red-700',
    underpriced: 'bg-blue-100 text-blue-700',
    competitor_out_of_stock: 'bg-gray-100 text-gray-600',
    needs_manual_review: 'bg-amber-100 text-amber-700',
    low_confidence: 'bg-purple-100 text-purple-700',
    error: 'bg-red-100 text-red-700',
    active: 'bg-emerald-100 text-emerald-700',
    inactive: 'bg-gray-100 text-gray-600',
    paused: 'bg-amber-100 text-amber-700',
    completed: 'bg-emerald-100 text-emerald-700',
    running: 'bg-blue-100 text-blue-700',
    failed: 'bg-red-100 text-red-700',
    pending: 'bg-gray-100 text-gray-600',
    sent: 'bg-emerald-100 text-emerald-700',
    failed_alert: 'bg-red-100 text-red-700',
    increase: 'bg-blue-100 text-blue-700',
    decrease: 'bg-amber-100 text-amber-700',
    maintain: 'bg-emerald-100 text-emerald-700',
    manual_review: 'bg-purple-100 text-purple-700',
  }
  return colors[status] || 'bg-gray-100 text-gray-600'
}

export function getLogLevelColor(level: string): string {
  const colors: Record<string, string> = {
    info: 'text-blue-600',
    warn: 'text-amber-600',
    error: 'text-red-600',
    success: 'text-emerald-600',
  }
  return colors[level] || 'text-gray-600'
}

export function getLogLevelIcon(level: string): string {
  const icons: Record<string, string> = {
    info: 'ℹ',
    warn: '⚠',
    error: '✕',
    success: '✓',
  }
  return icons[level] || '•'
}
