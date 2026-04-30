/**
 * Browser-Use Cloud API v3 — Cost-Optimised Integration
 *
 * Key optimisation: Batch all SKUs per competitor into ONE session.
 * Before: 6 SKUs × 5 competitors = 30 sessions (~$7.20/run)
 * After:  5 competitor sessions  =  5 sessions (~$2.00/run) → 72% savings
 *
 * Additional savings:
 * - Result cache (TTL per monitoring frequency) → skip unchanged products
 * - Parallel competitor sessions → faster + no extra cost
 * - Early exit when confidence threshold not met
 */

const BASE_URL = 'https://api.browser-use.com/api/v3'

function apiKey() {
  const key = process.env.BROWSER_USE_API_KEY
  if (!key) throw new Error('BROWSER_USE_API_KEY is not set in .env.local')
  return key
}

function authHeaders() {
  return {
    'X-Browser-Use-API-Key': apiKey(),
    'Content-Type': 'application/json',
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrowserUseSession {
  id: string
  status: 'running' | 'idle' | 'stopped' | 'error' | 'timed_out'
  output: string | null
  stepCount: number
  isTaskSuccessful: boolean | null
  liveUrl: string
  screenshotUrl: string | null
  totalCostUsd: string
}

export interface ScrapedPriceResult {
  found: boolean
  sku_id: string
  product_title: string
  price: number
  currency: string
  availability: boolean
  delivery_fee: number
  product_url: string
  match_confidence: number
  screenshot_url?: string
  live_url?: string
  raw_output: string
}

export interface BatchScrapeResult {
  competitor_name: string
  results: ScrapedPriceResult[]
  session_id: string
  live_url: string
  cost_usd: number
  duration_ms: number
}

// ─── In-memory Result Cache ───────────────────────────────────────────────────
// Prevents re-scraping the same SKU+competitor within the TTL window.
// In production replace with Redis or Supabase for persistence across restarts.

interface CacheEntry {
  result: ScrapedPriceResult
  cached_at: number          // epoch ms
  ttl_ms: number
}

const cache = new Map<string, CacheEntry>()

const FREQUENCY_TTL: Record<string, number> = {
  hourly:  55 * 60 * 1000,       // 55 min
  daily:   23 * 60 * 60 * 1000,  // 23 hr
  weekly:   6 * 24 * 60 * 60 * 1000, // 6 days
}

function cacheKey(sku_id: string, competitor_name: string) {
  return `${sku_id}::${competitor_name}`
}

function getCached(sku_id: string, competitor_name: string): ScrapedPriceResult | null {
  const entry = cache.get(cacheKey(sku_id, competitor_name))
  if (!entry) return null
  if (Date.now() - entry.cached_at > entry.ttl_ms) {
    cache.delete(cacheKey(sku_id, competitor_name))
    return null
  }
  return entry.result
}

function setCached(
  sku_id: string,
  competitor_name: string,
  result: ScrapedPriceResult,
  frequency = 'daily'
) {
  cache.set(cacheKey(sku_id, competitor_name), {
    result,
    cached_at: Date.now(),
    ttl_ms: FREQUENCY_TTL[frequency] ?? FREQUENCY_TTL.daily,
  })
}

export function getCacheStats() {
  const now = Date.now()
  let valid = 0, expired = 0
  cache.forEach((entry) => {
    if (now - entry.cached_at < entry.ttl_ms) valid++
    else expired++
  })
  return { total: cache.size, valid, expired }
}

export function clearCache() {
  cache.clear()
}

// ─── Core API Client ──────────────────────────────────────────────────────────

async function runSession(
  task: string,
  options: { timeout_ms?: number; poll_interval_ms?: number } = {}
): Promise<BrowserUseSession> {
  const { timeout_ms = 180_000, poll_interval_ms = 5_000 } = options

  const createRes = await fetch(`${BASE_URL}/sessions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ task }),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Session creation failed [${createRes.status}]: ${err}`)
  }

  const session: BrowserUseSession = await createRes.json()
  console.log(`[Browser-Use] Session ${session.id} started — ${session.liveUrl}`)

  const deadline = Date.now() + timeout_ms
  let current = session

  while (Date.now() < deadline) {
    if (['idle', 'stopped', 'error', 'timed_out'].includes(current.status)) break

    await new Promise(r => setTimeout(r, poll_interval_ms))

    const res = await fetch(`${BASE_URL}/sessions/${session.id}`, {
      headers: authHeaders(),
    })
    if (res.ok) {
      current = await res.json()
      console.log(`[Browser-Use] ${session.id} — ${current.status} (${current.stepCount} steps)`)
    }
  }

  // Timed out — stop to avoid billing for idle browser time
  if (!['idle', 'stopped', 'error', 'timed_out'].includes(current.status)) {
    await fetch(`${BASE_URL}/sessions/${session.id}/stop`, {
      method: 'POST', headers: authHeaders(),
    })
    throw new Error(`Session timed out after ${timeout_ms / 1000}s`)
  }

  return current
}

// ─── BATCHED Scraping (main optimised function) ───────────────────────────────

/**
 * Check ALL SKUs on a single competitor in ONE Browser-Use session.
 *
 * The AI agent visits the competitor site once, searches for each product
 * sequentially, and returns a JSON array with all results.
 *
 * Cost: 1 session per competitor (not 1 per SKU).
 */
export async function batchScrapeCompetitor(params: {
  competitor_name: string
  competitor_url: string
  search_url_pattern: string
  skus: Array<{
    sku_id: string
    product_name: string
    brand: string
    monitoring_frequency?: string
    min_confidence?: number
  }>
}): Promise<BatchScrapeResult> {
  const { competitor_name, competitor_url, search_url_pattern, skus } = params
  const startTime = Date.now()

  // ── 1. Check cache — filter to only stale/uncached SKUs ──
  const toFetch: typeof skus = []
  const cachedResults: ScrapedPriceResult[] = []

  for (const sku of skus) {
    const cached = getCached(sku.sku_id, competitor_name)
    if (cached) {
      console.log(`[Cache HIT] ${sku.sku_id} @ ${competitor_name}`)
      cachedResults.push(cached)
    } else {
      toFetch.push(sku)
    }
  }

  // All SKUs are cached — return immediately, zero cost
  if (toFetch.length === 0) {
    console.log(`[Browser-Use] All ${skus.length} SKUs cached for ${competitor_name} — skipping session`)
    return {
      competitor_name,
      results: cachedResults,
      session_id: 'cached',
      live_url: '',
      cost_usd: 0,
      duration_ms: Date.now() - startTime,
    }
  }

  // ── 2. Build the batch task prompt ──
  const skuList = toFetch.map((s, i) =>
    `${i + 1}. SKU: ${s.sku_id} | Product: "${s.brand} ${s.product_name}" | Brand: ${s.brand}`
  ).join('\n')

  const task = `
You are a retail price monitoring agent. Visit ${competitor_name} and find the current price for each product listed below. Check them one by one.

COMPETITOR WEBSITE: ${competitor_url}

PRODUCTS TO FIND (${toFetch.length} items):
${skuList}

INSTRUCTIONS FOR EACH PRODUCT:
1. Go to: ${search_url_pattern.replace('{query}', '{brand + product name}')}
   Replace {brand + product name} with the actual brand and product name
2. Find the best matching product — it MUST match the brand exactly
3. Click on it to open the product page
4. Extract: title, price (number only), availability (true/false), delivery fee (0 if free), product URL
5. Rate your match confidence from 0.0 to 1.0

After checking all products, return ONLY a valid JSON array — no markdown, no explanation:

[
  {
    "sku_id": "SKU_ID_HERE",
    "product_title": "exact title on page",
    "price": 0.00,
    "availability": true,
    "delivery_fee": 0.00,
    "product_url": "https://...",
    "match_confidence": 0.00,
    "found": true
  }
]

If a product is not found or confidence < 0.70, set "found": false and "price": 0.
Return an entry for EVERY product in the list, even if not found.
Return ONLY the JSON array. Nothing else.
`.trim()

  // ── 3. Run ONE session for this competitor ──
  let session: BrowserUseSession
  try {
    session = await runSession(task, { timeout_ms: 180_000 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Browser-Use] Session failed for ${competitor_name}: ${msg}`)
    // Return not-found for all uncached SKUs
    const errorResults = toFetch.map(s => notFound(s.sku_id, msg))
    return {
      competitor_name, results: [...cachedResults, ...errorResults],
      session_id: 'error', live_url: '', cost_usd: 0,
      duration_ms: Date.now() - startTime,
    }
  }

  // ── 4. Parse the batch JSON response ──
  const parsed = parseJsonArray(session.output ?? '')
  const freshResults: ScrapedPriceResult[] = []

  for (const sku of toFetch) {
    const match = parsed.find(p => String(p.sku_id) === sku.sku_id)

    if (!match || match.found === false || Number(match.price ?? 0) === 0) {
      const result = notFound(sku.sku_id, match ? 'Product not found or low confidence' : 'Missing from agent response')
      freshResults.push(result)
      continue
    }

    const confidence = Number(match.match_confidence ?? 0)
    const minConf = sku.min_confidence ?? 0.70

    if (confidence < minConf) {
      freshResults.push(notFound(sku.sku_id, `Confidence too low: ${(confidence * 100).toFixed(0)}%`))
      continue
    }

    const result: ScrapedPriceResult = {
      found: true,
      sku_id: sku.sku_id,
      product_title: String(match.product_title ?? ''),
      price: Number(match.price),
      currency: 'AED',
      availability: Boolean(match.availability ?? true),
      delivery_fee: Number(match.delivery_fee ?? 0),
      product_url: String(match.product_url ?? competitor_url),
      match_confidence: confidence,
      screenshot_url: session.screenshotUrl ?? undefined,
      live_url: session.liveUrl,
      raw_output: session.output ?? '',
    }

    // Cache the result
    setCached(sku.sku_id, competitor_name, result, sku.monitoring_frequency ?? 'daily')
    freshResults.push(result)

    console.log(`[Browser-Use] ✓ ${competitor_name} / ${sku.sku_id}: AED ${result.price} (${(confidence * 100).toFixed(0)}% confidence)`)
  }

  const costUsd = parseFloat(session.totalCostUsd ?? '0')
  console.log(`[Browser-Use] ${competitor_name} batch complete — ${toFetch.length} SKUs, $${costUsd.toFixed(4)}, ${Math.round((Date.now() - startTime) / 1000)}s`)

  return {
    competitor_name,
    results: [...cachedResults, ...freshResults],
    session_id: session.id,
    live_url: session.liveUrl,
    cost_usd: costUsd,
    duration_ms: Date.now() - startTime,
  }
}

// ─── Screenshot Storage ────────────────────────────────────────────────────────

export async function saveScreenshotToSupabase(
  screenshotUrl: string,
  fileName: string,
  bucket = 'screenshots'
): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.warn('[Screenshot] Supabase not configured — skipping upload')
    return screenshotUrl // return original URL as fallback
  }
  try {
    const imgRes = await fetch(screenshotUrl)
    if (!imgRes.ok) return null
    const buffer = await imgRes.arrayBuffer()
    const uploadRes = await fetch(
      `${supabaseUrl}/storage/v1/object/${bucket}/${fileName}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'image/png',
          'x-upsert': 'true',
        },
        body: buffer,
      }
    )
    if (!uploadRes.ok) return null
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${fileName}`
  } catch {
    return null
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function notFound(sku_id: string, reason: string): ScrapedPriceResult {
  return {
    found: false, sku_id, product_title: '', price: 0, currency: 'AED',
    availability: false, delivery_fee: 0, product_url: '',
    match_confidence: 0, raw_output: reason,
  }
}

function parseJsonArray(text: string): Record<string, unknown>[] {
  if (!text) return []
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) return []
    return JSON.parse(match[0])
  } catch {
    return []
  }
}
