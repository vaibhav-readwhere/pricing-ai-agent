-- ============================================================
-- PriceWatch AI — MySQL Schema
-- Requires MySQL 8.0.13+ (for DEFAULT (UUID()) and JSON type)
-- Run this in your MySQL client: mysql -u root -p yourdb < mysql/schema.sql
-- ============================================================

-- 1. Users
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  email      VARCHAR(255) NOT NULL UNIQUE,
  name       VARCHAR(255) NOT NULL,
  role       ENUM('admin','pricing_manager','viewer') NOT NULL DEFAULT 'viewer',
  status     ENUM('active','inactive')                NOT NULL DEFAULT 'active',
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. SKUs
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skus (
  id                   CHAR(36)        NOT NULL PRIMARY KEY,
  sku_id               VARCHAR(100)    NOT NULL UNIQUE,
  product_name         VARCHAR(500)    NOT NULL,
  brand                VARCHAR(255)    NOT NULL DEFAULT '',
  category             VARCHAR(255),
  current_price        DECIMAL(10,2)   NOT NULL,
  product_url          TEXT,
  target_marketplace   VARCHAR(100)    NOT NULL DEFAULT 'UAE',
  competitor_urls      JSON,                          -- array of URLs
  min_price            DECIMAL(10,2)   NOT NULL DEFAULT 0,
  max_price            DECIMAL(10,2)   NOT NULL DEFAULT 0,
  margin_threshold     DECIMAL(5,2)    NOT NULL DEFAULT 8.00,
  alert_recipients     JSON,                          -- array of email strings
  status               ENUM('active','inactive','paused') NOT NULL DEFAULT 'active',
  monitoring_frequency ENUM('hourly','daily','weekly','custom') NOT NULL DEFAULT 'daily',
  custom_cron          VARCHAR(100),
  last_checked         TIMESTAMP       NULL,
  created_by           CHAR(36),
  created_at           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_skus_status   (status),
  INDEX idx_skus_brand    (brand),
  INDEX idx_skus_category (category)
);

-- 3. Competitors
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitors (
  id                  CHAR(36)     NOT NULL PRIMARY KEY,
  name                VARCHAR(255) NOT NULL UNIQUE,
  website_url         VARCHAR(500) NOT NULL,
  search_url_pattern  VARCHAR(2000) NOT NULL DEFAULT '',
  logo                VARCHAR(500),
  matching_rules      JSON,
  price_selector      VARCHAR(255),
  screenshot_required BOOLEAN      NOT NULL DEFAULT TRUE,
  status              ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. Agent Runs
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_runs (
  id                   CHAR(36) NOT NULL PRIMARY KEY,
  status               ENUM('pending','running','completed','failed','paused') NOT NULL DEFAULT 'pending',
  triggered_by         ENUM('scheduled','manual') NOT NULL DEFAULT 'manual',
  triggered_by_user    CHAR(36),
  skus_total           INT      NOT NULL DEFAULT 0,
  skus_processed       INT      NOT NULL DEFAULT 0,
  competitors_checked  INT      NOT NULL DEFAULT 0,
  mismatches_found     INT      NOT NULL DEFAULT 0,
  alerts_sent          INT      NOT NULL DEFAULT 0,
  screenshots_captured INT      NOT NULL DEFAULT 0,
  started_at           TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at         TIMESTAMP NULL,
  error_message        TEXT,
  notes                TEXT,
  INDEX idx_agent_runs_status  (status),
  INDEX idx_agent_runs_started (started_at)
);

-- 5. Competitor Checks
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitor_checks (
  id                      CHAR(36)      NOT NULL PRIMARY KEY,
  run_id                  CHAR(36)      NOT NULL,
  sku_id                  CHAR(36)      NOT NULL,
  competitor_id           CHAR(36)      NOT NULL,
  competitor_name         VARCHAR(255)  NOT NULL,
  competitor_price        DECIMAL(10,2),
  competitor_url          TEXT,
  our_price               DECIMAL(10,2) NOT NULL,
  discount                DECIMAL(5,2),
  availability            BOOLEAN       NOT NULL DEFAULT TRUE,
  delivery_fee            DECIMAL(10,2) NOT NULL DEFAULT 0,
  status                  ENUM('price_ok','overpriced','underpriced','competitor_out_of_stock','needs_manual_review','low_confidence','error') NOT NULL,
  match_confidence        DECIMAL(5,4)  NOT NULL DEFAULT 0,
  recommended_price       DECIMAL(10,2),
  recommendation_reason   TEXT,
  screenshot_search_url   TEXT,
  screenshot_product_url  TEXT,
  email_sent              BOOLEAN       NOT NULL DEFAULT FALSE,
  error_message           TEXT,
  agent_notes             TEXT,
  created_at              TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id)         REFERENCES agent_runs(id)  ON DELETE CASCADE,
  FOREIGN KEY (sku_id)         REFERENCES skus(id)        ON DELETE CASCADE,
  FOREIGN KEY (competitor_id)  REFERENCES competitors(id) ON DELETE CASCADE,
  INDEX idx_checks_run_id (run_id),
  INDEX idx_checks_sku_id (sku_id),
  INDEX idx_checks_status (status)
);

-- 6. Price Snapshots
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_snapshots (
  id             CHAR(36)      NOT NULL PRIMARY KEY,
  sku_id         CHAR(36)      NOT NULL,
  competitor_id  CHAR(36)      NOT NULL,
  price          DECIMAL(10,2) NOT NULL,
  availability   BOOLEAN       NOT NULL DEFAULT TRUE,
  delivery_fee   DECIMAL(10,2) NOT NULL DEFAULT 0,
  snapshot_url   TEXT,
  captured_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sku_id)        REFERENCES skus(id)        ON DELETE CASCADE,
  FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE,
  INDEX idx_snapshots_sku_id        (sku_id),
  INDEX idx_snapshots_competitor_id (competitor_id),
  INDEX idx_snapshots_captured      (captured_at)
);

-- 7. Screenshots
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS screenshots (
  id               CHAR(36)     NOT NULL PRIMARY KEY,
  check_id         CHAR(36)     NOT NULL,
  sku_id           CHAR(36)     NOT NULL,
  competitor_id    CHAR(36)     NOT NULL,
  type             ENUM('search_page','product_page') NOT NULL,
  storage_path     TEXT         NOT NULL,
  storage_url      TEXT,
  file_size_bytes  INT,
  width            INT,
  height           INT,
  competitor_name  VARCHAR(255),
  timestamp        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (check_id)       REFERENCES competitor_checks(id) ON DELETE CASCADE,
  FOREIGN KEY (sku_id)         REFERENCES skus(id)              ON DELETE CASCADE,
  FOREIGN KEY (competitor_id)  REFERENCES competitors(id)       ON DELETE CASCADE,
  INDEX idx_screenshots_sku_id   (sku_id),
  INDEX idx_screenshots_check_id (check_id)
);

-- 8. Recommendations
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recommendations (
  id                       CHAR(36)      NOT NULL PRIMARY KEY,
  run_id                   CHAR(36)      NOT NULL,
  sku_id                   CHAR(36)      NOT NULL,
  sku_name                 VARCHAR(500)  NOT NULL,
  sku_brand                VARCHAR(255),
  current_price            DECIMAL(10,2) NOT NULL,
  recommended_price        DECIMAL(10,2) NOT NULL,
  lowest_competitor_price  DECIMAL(10,2),
  highest_competitor_price DECIMAL(10,2),
  avg_competitor_price     DECIMAL(10,2),
  status                   ENUM('price_ok','overpriced','underpriced','competitor_out_of_stock','needs_manual_review','low_confidence','error') NOT NULL,
  action                   ENUM('increase','decrease','maintain','manual_review') NOT NULL,
  price_diff               DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_diff_pct           DECIMAL(8,4)  NOT NULL DEFAULT 0,
  competitor_data          JSON,           -- array of { competitor_name, price, url }
  reviewed                 BOOLEAN       NOT NULL DEFAULT FALSE,
  reviewed_by              CHAR(36),
  reviewed_at              TIMESTAMP     NULL,
  applied                  BOOLEAN       NOT NULL DEFAULT FALSE,
  applied_at               TIMESTAMP     NULL,
  created_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id)  REFERENCES agent_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (sku_id)  REFERENCES skus(id)       ON DELETE CASCADE,
  INDEX idx_recs_run_id   (run_id),
  INDEX idx_recs_sku_id   (sku_id),
  INDEX idx_recs_status   (status),
  INDEX idx_recs_reviewed (reviewed)
);

-- 9. Email Alerts
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_alerts (
  id                  CHAR(36)     NOT NULL PRIMARY KEY,
  run_id              CHAR(36)     NOT NULL,
  sku_id              CHAR(36)     NOT NULL,
  sku_name            VARCHAR(500) NOT NULL,
  check_id            CHAR(36),
  recipient           VARCHAR(255) NOT NULL,
  subject             VARCHAR(500) NOT NULL,
  body_html           LONGTEXT,
  status              ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
  provider_message_id VARCHAR(255),
  sent_at             TIMESTAMP    NULL,
  error_message       TEXT,
  preview_data        JSON,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id)  REFERENCES agent_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (sku_id)  REFERENCES skus(id)       ON DELETE CASCADE,
  INDEX idx_alerts_run_id (run_id),
  INDEX idx_alerts_sku_id (sku_id),
  INDEX idx_alerts_status (status)
);

-- 10. Notification Settings
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_settings (
  id                        CHAR(36)     NOT NULL PRIMARY KEY,
  name                      VARCHAR(255) NOT NULL DEFAULT 'Default',
  email_provider            ENUM('smtp','resend','sendgrid') NOT NULL DEFAULT 'smtp',
  smtp_host                 VARCHAR(255),
  smtp_port                 INT          NOT NULL DEFAULT 587,
  smtp_user                 VARCHAR(255),
  smtp_password_encrypted   TEXT,
  resend_api_key_encrypted  TEXT,
  sendgrid_api_key_encrypted TEXT,
  from_email                VARCHAR(255) NOT NULL DEFAULT 'alerts@pricewatch.ai',
  from_name                 VARCHAR(255) NOT NULL DEFAULT 'PriceWatch AI',
  alert_on_overpriced       BOOLEAN      NOT NULL DEFAULT TRUE,
  alert_on_underpriced      BOOLEAN      NOT NULL DEFAULT TRUE,
  alert_threshold_pct       DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  default_recipients        JSON,
  created_at                TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 11. Audit Logs
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id            CHAR(36)  NOT NULL PRIMARY KEY,
  run_id        CHAR(36),
  sku_id        CHAR(36),
  competitor_id CHAR(36),
  user_id       CHAR(36),
  level         ENUM('info','warn','error','success') NOT NULL DEFAULT 'info',
  message       TEXT      NOT NULL,
  details       JSON,
  timestamp     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Nullable FKs: NULL values never violate FK constraints in MySQL
  FOREIGN KEY (run_id)        REFERENCES agent_runs(id)  ON DELETE SET NULL,
  FOREIGN KEY (sku_id)        REFERENCES skus(id)        ON DELETE SET NULL,
  FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE SET NULL,
  INDEX idx_audit_run_id    (run_id),
  INDEX idx_audit_sku_id    (sku_id),
  INDEX idx_audit_timestamp (timestamp)
);

-- ─────────────────────────────────────────────────────────────
-- Seed Data — Built-in Competitors
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO competitors (id, name, website_url, search_url_pattern, logo, price_selector, screenshot_required, status, matching_rules) VALUES
  (UUID(), 'Jumbo',        'https://www.jumbo.com',          'https://www.jumbo.com/en/search?q={query}',                      '🛒', '.product-price .price',         TRUE,  'active',   '{"title_similarity_threshold":0.75,"brand_match_required":true,"model_match_required":false}'),
  (UUID(), 'Sharaf DG',    'https://www.sharafdg.com',        'https://www.sharafdg.com/search?q={query}',                      '🔌', '.price-current',                TRUE,  'active',   '{"title_similarity_threshold":0.75,"brand_match_required":true,"model_match_required":false}'),
  (UUID(), 'Noon',         'https://www.noon.com',            'https://www.noon.com/uae-en/search?q={query}',                   '🌙', '[data-qa="product-price"]',     TRUE,  'active',   '{"title_similarity_threshold":0.75,"brand_match_required":true,"model_match_required":false}'),
  (UUID(), 'Amazon UAE',   'https://www.amazon.ae',           'https://www.amazon.ae/s?k={query}',                              '📦', '.a-price .a-offscreen',         TRUE,  'active',   '{"title_similarity_threshold":0.75,"brand_match_required":true,"model_match_required":false}'),
  (UUID(), 'Carrefour UAE','https://www.carrefouruae.com',    'https://www.carrefouruae.com/mafuae/en/search?keyword={query}',  '🏪', '.css-price .value',            FALSE, 'active',   '{"title_similarity_threshold":0.75,"brand_match_required":true,"model_match_required":false}'),
  (UUID(), 'Emax',         'https://www.emaxuae.com',         'https://www.emaxuae.com/search?q={query}',                       '⚡', '.product-price',               TRUE,  'inactive', '{"title_similarity_threshold":0.75,"brand_match_required":true,"model_match_required":false}');
