-- ============================================================
-- PriceWatch AI — Supabase Database Schema
-- ============================================================
-- Run this in the Supabase SQL editor to create all tables.
-- Enable Row Level Security (RLS) and add policies as needed.

-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- for fuzzy text search

-- ─────────────────────────────────────────────────────────────
-- 1. Users (extends Supabase auth.users)
-- ─────────────────────────────────────────────────────────────
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null unique,
  name text not null,
  role text not null default 'viewer' check (role in ('admin', 'pricing_manager', 'viewer')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table public.users enable row level security;
create policy "Users can read their own profile" on public.users for select using (auth.uid() = id);
create policy "Admins can read all users" on public.users for select using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- ─────────────────────────────────────────────────────────────
-- 2. SKUs
-- ─────────────────────────────────────────────────────────────
create table public.skus (
  id uuid primary key default uuid_generate_v4(),
  sku_id text not null unique,
  product_name text not null,
  brand text not null,
  category text,
  current_price numeric(10, 2) not null,
  product_url text,
  target_marketplace text default 'UAE',
  competitor_urls text[] default '{}',
  min_price numeric(10, 2) not null,
  max_price numeric(10, 2) not null,
  margin_threshold numeric(5, 2) default 8.0,
  alert_recipients text[] default '{}',
  status text not null default 'active' check (status in ('active', 'inactive', 'paused')),
  monitoring_frequency text not null default 'daily' check (monitoring_frequency in ('hourly', 'daily', 'weekly', 'custom')),
  custom_cron text,
  last_checked timestamptz,
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.skus enable row level security;
create policy "Authenticated users can read SKUs" on public.skus for select using (auth.role() = 'authenticated');
create policy "Admins and PMs can insert SKUs" on public.skus for insert with check (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'pricing_manager'))
);
create policy "Admins and PMs can update SKUs" on public.skus for update using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'pricing_manager'))
);

create index idx_skus_status on public.skus(status);
create index idx_skus_brand on public.skus(brand);
create index idx_skus_category on public.skus(category);

-- ─────────────────────────────────────────────────────────────
-- 3. Competitors
-- ─────────────────────────────────────────────────────────────
create table public.competitors (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  website_url text not null,
  search_url_pattern text not null,
  logo text,
  matching_rules jsonb default '{"title_similarity_threshold": 0.75, "brand_match_required": true, "model_match_required": false}',
  price_selector text,
  screenshot_required boolean default true,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.competitors enable row level security;
create policy "Authenticated users can read competitors" on public.competitors for select using (auth.role() = 'authenticated');
create policy "Admins can manage competitors" on public.competitors for all using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- ─────────────────────────────────────────────────────────────
-- 4. Agent Runs
-- ─────────────────────────────────────────────────────────────
create table public.agent_runs (
  id uuid primary key default uuid_generate_v4(),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'paused')),
  triggered_by text not null default 'scheduled' check (triggered_by in ('scheduled', 'manual')),
  triggered_by_user uuid references public.users(id),
  skus_total integer default 0,
  skus_processed integer default 0,
  competitors_checked integer default 0,
  mismatches_found integer default 0,
  alerts_sent integer default 0,
  screenshots_captured integer default 0,
  started_at timestamptz default now(),
  completed_at timestamptz,
  error_message text,
  notes text
);

alter table public.agent_runs enable row level security;
create policy "Authenticated users can read runs" on public.agent_runs for select using (auth.role() = 'authenticated');
create policy "System can insert runs" on public.agent_runs for insert with check (true);

create index idx_agent_runs_status on public.agent_runs(status);
create index idx_agent_runs_started on public.agent_runs(started_at desc);

-- ─────────────────────────────────────────────────────────────
-- 5. Competitor Checks
-- ─────────────────────────────────────────────────────────────
create table public.competitor_checks (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid references public.agent_runs(id) on delete cascade,
  sku_id uuid references public.skus(id),
  competitor_id uuid references public.competitors(id),
  competitor_name text not null,
  competitor_price numeric(10, 2),
  competitor_url text,
  our_price numeric(10, 2) not null,
  discount numeric(5, 2),
  availability boolean default true,
  delivery_fee numeric(10, 2) default 0,
  status text not null check (status in ('price_ok', 'overpriced', 'underpriced', 'competitor_out_of_stock', 'needs_manual_review', 'low_confidence', 'error')),
  match_confidence numeric(5, 4) default 0,
  recommended_price numeric(10, 2),
  recommendation_reason text,
  screenshot_search_url text,
  screenshot_product_url text,
  email_sent boolean default false,
  error_message text,
  agent_notes text,
  created_at timestamptz default now()
);

alter table public.competitor_checks enable row level security;
create policy "Authenticated users can read checks" on public.competitor_checks for select using (auth.role() = 'authenticated');
create policy "System can insert checks" on public.competitor_checks for insert with check (true);

create index idx_checks_run_id on public.competitor_checks(run_id);
create index idx_checks_sku_id on public.competitor_checks(sku_id);
create index idx_checks_status on public.competitor_checks(status);
create index idx_checks_created on public.competitor_checks(created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 6. Price Snapshots (historical price tracking)
-- ─────────────────────────────────────────────────────────────
create table public.price_snapshots (
  id uuid primary key default uuid_generate_v4(),
  sku_id uuid references public.skus(id),
  competitor_id uuid references public.competitors(id),
  price numeric(10, 2) not null,
  availability boolean default true,
  delivery_fee numeric(10, 2) default 0,
  snapshot_url text,
  captured_at timestamptz default now()
);

alter table public.price_snapshots enable row level security;
create policy "Authenticated users can read snapshots" on public.price_snapshots for select using (auth.role() = 'authenticated');

create index idx_snapshots_sku_id on public.price_snapshots(sku_id);
create index idx_snapshots_competitor_id on public.price_snapshots(competitor_id);
create index idx_snapshots_captured on public.price_snapshots(captured_at desc);

-- ─────────────────────────────────────────────────────────────
-- 7. Screenshots
-- ─────────────────────────────────────────────────────────────
create table public.screenshots (
  id uuid primary key default uuid_generate_v4(),
  check_id uuid references public.competitor_checks(id) on delete cascade,
  sku_id uuid references public.skus(id),
  competitor_id uuid references public.competitors(id),
  type text not null check (type in ('search_page', 'product_page')),
  storage_path text not null, -- Supabase Storage path
  storage_url text,           -- Public URL
  file_size_bytes integer,
  width integer,
  height integer,
  competitor_name text,
  timestamp timestamptz default now()
);

alter table public.screenshots enable row level security;
create policy "Authenticated users can read screenshots" on public.screenshots for select using (auth.role() = 'authenticated');

create index idx_screenshots_sku_id on public.screenshots(sku_id);
create index idx_screenshots_check_id on public.screenshots(check_id);

-- ─────────────────────────────────────────────────────────────
-- 8. Recommendations
-- ─────────────────────────────────────────────────────────────
create table public.recommendations (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid references public.agent_runs(id),
  sku_id uuid references public.skus(id),
  sku_name text not null,
  sku_brand text,
  current_price numeric(10, 2) not null,
  recommended_price numeric(10, 2) not null,
  lowest_competitor_price numeric(10, 2),
  highest_competitor_price numeric(10, 2),
  avg_competitor_price numeric(10, 2),
  status text not null check (status in ('price_ok', 'overpriced', 'underpriced', 'competitor_out_of_stock', 'needs_manual_review', 'low_confidence', 'error')),
  action text not null check (action in ('increase', 'decrease', 'maintain', 'manual_review')),
  price_diff numeric(10, 2) default 0,
  price_diff_pct numeric(8, 4) default 0,
  competitor_data jsonb default '[]',
  reviewed boolean default false,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  applied boolean default false,
  applied_at timestamptz,
  created_at timestamptz default now()
);

alter table public.recommendations enable row level security;
create policy "Authenticated users can read recommendations" on public.recommendations for select using (auth.role() = 'authenticated');
create policy "PMs and Admins can update recommendations" on public.recommendations for update using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'pricing_manager'))
);

create index idx_recs_run_id on public.recommendations(run_id);
create index idx_recs_sku_id on public.recommendations(sku_id);
create index idx_recs_status on public.recommendations(status);
create index idx_recs_reviewed on public.recommendations(reviewed);

-- ─────────────────────────────────────────────────────────────
-- 9. Email Alerts
-- ─────────────────────────────────────────────────────────────
create table public.email_alerts (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid references public.agent_runs(id),
  sku_id uuid references public.skus(id),
  sku_name text not null,
  check_id uuid references public.competitor_checks(id),
  recipient text not null,
  subject text not null,
  body_html text,
  status text not null default 'pending' check (status in ('sent', 'failed', 'pending')),
  provider_message_id text,
  sent_at timestamptz,
  error_message text,
  preview_data jsonb,
  created_at timestamptz default now()
);

alter table public.email_alerts enable row level security;
create policy "Authenticated users can read alerts" on public.email_alerts for select using (auth.role() = 'authenticated');

create index idx_alerts_run_id on public.email_alerts(run_id);
create index idx_alerts_sku_id on public.email_alerts(sku_id);
create index idx_alerts_status on public.email_alerts(status);

-- ─────────────────────────────────────────────────────────────
-- 10. Notification Settings
-- ─────────────────────────────────────────────────────────────
create table public.notification_settings (
  id uuid primary key default uuid_generate_v4(),
  name text not null default 'Default',
  email_provider text not null default 'smtp' check (email_provider in ('smtp', 'resend', 'sendgrid')),
  smtp_host text,
  smtp_port integer default 587,
  smtp_user text,
  smtp_password_encrypted text, -- store encrypted
  resend_api_key_encrypted text,
  sendgrid_api_key_encrypted text,
  from_email text default 'alerts@pricewatch.ai',
  from_name text default 'PriceWatch AI',
  alert_on_overpriced boolean default true,
  alert_on_underpriced boolean default true,
  alert_threshold_pct numeric(5, 2) default 5.0,
  default_recipients text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.notification_settings enable row level security;
create policy "Admins can manage notification settings" on public.notification_settings for all using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- ─────────────────────────────────────────────────────────────
-- 11. Audit Logs
-- ─────────────────────────────────────────────────────────────
create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid references public.agent_runs(id),
  sku_id uuid references public.skus(id),
  competitor_id uuid references public.competitors(id),
  user_id uuid references public.users(id),
  level text not null check (level in ('info', 'warn', 'error', 'success')),
  message text not null,
  details jsonb,
  timestamp timestamptz default now()
);

alter table public.audit_logs enable row level security;
create policy "Authenticated users can read audit logs" on public.audit_logs for select using (auth.role() = 'authenticated');
create policy "System can insert audit logs" on public.audit_logs for insert with check (true);

create index idx_audit_run_id on public.audit_logs(run_id);
create index idx_audit_sku_id on public.audit_logs(sku_id);
create index idx_audit_timestamp on public.audit_logs(timestamp desc);

-- ─────────────────────────────────────────────────────────────
-- Utility: updated_at trigger
-- ─────────────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger skus_updated_at before update on public.skus for each row execute function update_updated_at();
create trigger competitors_updated_at before update on public.competitors for each row execute function update_updated_at();
create trigger notification_settings_updated_at before update on public.notification_settings for each row execute function update_updated_at();
create trigger users_updated_at before update on public.users for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Demo Seed Data
-- ─────────────────────────────────────────────────────────────
insert into public.competitors (name, website_url, search_url_pattern, logo, price_selector, screenshot_required, status) values
  ('Jumbo', 'https://www.jumbo.com', 'https://www.jumbo.com/en/search?q={query}', '🛒', '.product-price .price', true, 'active'),
  ('Sharaf DG', 'https://www.sharafdg.com', 'https://www.sharafdg.com/search?q={query}', '🔌', '.price-current', true, 'active'),
  ('Noon', 'https://www.noon.com', 'https://www.noon.com/uae-en/search?q={query}', '🌙', '[data-qa="product-price"]', true, 'active'),
  ('Amazon UAE', 'https://www.amazon.ae', 'https://www.amazon.ae/s?k={query}', '📦', '.a-price .a-offscreen', true, 'active'),
  ('Carrefour UAE', 'https://www.carrefouruae.com', 'https://www.carrefouruae.com/mafuae/en/search?keyword={query}', '🏪', '.css-price .value', false, 'active'),
  ('Emax', 'https://www.emaxuae.com', 'https://www.emaxuae.com/search?q={query}', '⚡', '.product-price', true, 'inactive');

-- ─────────────────────────────────────────────────────────────
-- Storage Bucket (run separately in Supabase dashboard or via API)
-- ─────────────────────────────────────────────────────────────
-- insert into storage.buckets (id, name, public) values ('screenshots', 'screenshots', false);
-- create policy "Authenticated users can view screenshots" on storage.objects for select
--   using (bucket_id = 'screenshots' and auth.role() = 'authenticated');
-- create policy "Agent can upload screenshots" on storage.objects for insert
--   with check (bucket_id = 'screenshots');
