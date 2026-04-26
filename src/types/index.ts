export type UserRole = 'admin' | 'pricing_manager' | 'viewer'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  created_at: string
}

export interface SKU {
  id: string
  sku_id: string
  product_name: string
  brand: string
  category: string
  current_price: number
  product_url?: string
  target_marketplace?: string
  competitor_urls?: string[]
  min_price: number
  max_price: number
  margin_threshold: number
  alert_recipients: string[]
  status: 'active' | 'inactive' | 'paused'
  monitoring_frequency: 'hourly' | 'daily' | 'weekly' | 'custom'
  custom_cron?: string
  last_checked?: string
  created_at: string
  updated_at: string
}

export interface Competitor {
  id: string
  name: string
  website_url: string
  search_url_pattern: string
  logo?: string
  matching_rules: {
    title_similarity_threshold: number
    brand_match_required: boolean
    model_match_required: boolean
  }
  price_selector: string
  screenshot_required: boolean
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export type CompetitorCheckStatus =
  | 'price_ok'
  | 'overpriced'
  | 'underpriced'
  | 'competitor_out_of_stock'
  | 'needs_manual_review'
  | 'low_confidence'
  | 'error'

export interface CompetitorCheck {
  id: string
  run_id: string
  sku_id: string
  competitor_id: string
  competitor_name: string
  competitor_price: number | null
  competitor_url?: string
  our_price: number
  discount?: number
  availability: boolean
  delivery_fee?: number
  status: CompetitorCheckStatus
  match_confidence: number
  recommended_price?: number
  recommendation_reason?: string
  screenshot_search_url?: string
  screenshot_product_url?: string
  email_sent: boolean
  error_message?: string
  agent_notes?: string
  created_at: string
}

export interface PriceSnapshot {
  id: string
  sku_id: string
  competitor_id: string
  price: number
  availability: boolean
  delivery_fee?: number
  snapshot_url?: string
  captured_at: string
}

export interface Screenshot {
  id: string
  check_id: string
  sku_id: string
  competitor_id: string
  type: 'search_page' | 'product_page'
  storage_url: string
  timestamp: string
  competitor_name: string
}

export type AgentRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused'

export interface AgentRun {
  id: string
  status: AgentRunStatus
  triggered_by: 'scheduled' | 'manual'
  skus_total: number
  skus_processed: number
  competitors_checked: number
  mismatches_found: number
  alerts_sent: number
  screenshots_captured: number
  started_at: string
  completed_at?: string
  error_message?: string
  notes?: string
}

export interface Recommendation {
  id: string
  run_id: string
  sku_id: string
  sku_name: string
  sku_brand: string
  current_price: number
  recommended_price: number
  lowest_competitor_price: number
  highest_competitor_price: number
  avg_competitor_price: number
  status: CompetitorCheckStatus
  action: 'increase' | 'decrease' | 'maintain' | 'manual_review'
  price_diff: number
  price_diff_pct: number
  competitor_data: {
    competitor_name: string
    price: number
    url?: string
  }[]
  reviewed: boolean
  applied: boolean
  created_at: string
}

export interface EmailAlert {
  id: string
  run_id: string
  sku_id: string
  sku_name: string
  check_id: string
  recipient: string
  subject: string
  status: 'sent' | 'failed' | 'pending'
  sent_at?: string
  error_message?: string
  preview_data: {
    our_price: number
    competitor_price: number
    competitor_name: string
    recommended_price: number
    reason: string
  }
}

export interface AgentLog {
  id: string
  run_id: string
  sku_id?: string
  competitor_id?: string
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
  details?: Record<string, unknown>
  timestamp: string
}

export interface NotificationSetting {
  id: string
  name: string
  email_provider: 'smtp' | 'resend' | 'sendgrid'
  smtp_host?: string
  smtp_port?: number
  smtp_user?: string
  from_email: string
  from_name: string
  alert_on_overpriced: boolean
  alert_on_underpriced: boolean
  alert_threshold_pct: number
  recipients: string[]
}

export interface DashboardStats {
  total_skus: number
  active_competitors: number
  price_mismatches: number
  alerts_sent: number
  last_run?: AgentRun
  next_run?: string
  recent_activity: AgentLog[]
  recent_recommendations: Recommendation[]
}
