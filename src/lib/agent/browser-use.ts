/**
 * Browser-Use Cloud API v3 Integration
 * https://browser-use.com
 *
 * Confirmed working against the live API.
 * Base URL  : https://api.browser-use.com/api/v3
 * Auth      : X-Browser-Use-API-Key header
 * Create    : POST /sessions
 * Status    : GET  /sessions/{id}
 * Stop      : POST /sessions/{id}/stop
 * Live view : https://live.browser-use.com/session/{id}
 */

const BASE_URL = 'https://api.browser-use.com/api/v3'

function apiKey() {
  const key = process.env.BROWSER_USE_API_KEY
  if (!key) throw new Error('BROWSER_USE_API_KEY is not set in .env.local')
  return key
}

function headers() {
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
  title: string | null
  stepCount: number
  lastStepSummary: string | null
  isTaskSuccessful: boolean | null
  liveUrl: string
  screenshotUrl: string | null
  totalCostUsd: string
  createdAt: string
  updatedAt: string
}

export interface ScrapedPriceResult {
  found: boolean
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

// ─── Core API Client ──────────────────────────────────────────────────────────

/**
 * Create a Browser-Use session and poll until it completes.
 */
async function runSession(
  task: string,
  options: { timeout_ms?: number; poll_interval_ms?: number } = {}
): Promise<BrowserUseSession> {
  const { timeout_ms = 120_000, poll_interval_ms = 4_000 } = options

  // 1. Create session
  const createRes = await fetch(`${BASE_URL}/sessions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ task }),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Browser-Use session creation failed [${createRes.status}]: ${err}`)
  }

  const session: BrowserUseSession = await createRes.json()
  console.log(`[Browser-Use] Session ${session.id} created — live: ${session.liveUrl}`)

  // 2. Poll until terminal state
  const deadline = Date.now() + timeout_ms
  let current = session

  while (Date.now() < deadline) {
    if (['idle', 'stopped', 'error', 'timed_out'].includes(current.status)) {
      return current
    }

    await new Promise(r => setTimeout(r, poll_interval_ms))

    const statusRes = await fetch(`${BASE_URL}/sessions/${session.id}`, {
      headers: headers(),
    })

    if (statusRes.ok) {
      current = await statusRes.json()
      console.log(`[Browser-Use] ${session.id} — status: ${current.status}, steps: ${current.stepCount}`)
    }
  }

  // Timeout — stop the session to avoid wasting credits
  await fetch(`${BASE_URL}/sessions/${session.id}/stop`, { method: 'POST', headers: headers() })
  throw new Error(`Browser-Use session timed out after ${timeout_ms / 1000}s`)
}

// ─── Price Scraping ────────────────────────────────────────────────────────────

/**
 * Search a competitor site for a product and extract its price.
 * Browser-Use AI navigates the site, finds the matching product,
 * and returns structured JSON — no CSS selectors needed.
 */
export async function scrapeCompetitorPriceViaBrowserUse(params: {
  product_name: string
  brand: string
  sku_id: string
  competitor_name: string
  competitor_url: string
  search_url_pattern: string
  min_confidence?: number
}): Promise<ScrapedPriceResult> {
  const {
    product_name, brand, sku_id,
    competitor_name, competitor_url,
    search_url_pattern, min_confidence = 0.70,
  } = params

  const searchUrl = search_url_pattern.replace('{query}', encodeURIComponent(`${brand} ${product_name}`))

  const task = `
You are a retail price monitoring agent. Find the exact product listed below on a competitor website and return its current price as structured JSON.

PRODUCT TO FIND:
- Name: ${product_name}
- Brand: ${brand}
- SKU: ${sku_id}

WEBSITE: ${competitor_name}
START URL: ${searchUrl}

INSTRUCTIONS:
1. Go to the start URL above
2. Look at the search results
3. Find the product that best matches "${brand} ${product_name}" — it MUST be the same brand
4. Click on the best matching product to open the product detail page
5. Extract the following and return ONLY a valid JSON object (no markdown, no explanation):

{
  "product_title": "<exact title shown on the page>",
  "price": <number, current selling price, no currency symbol>,
  "availability": <true if in stock, false if out of stock>,
  "delivery_fee": <number, 0 if free delivery or not shown>,
  "product_url": "<full URL of the product page>",
  "match_confidence": <number between 0.0 and 1.0 — how confident you are this is the right product>
}

If you cannot find the product or confidence is below ${min_confidence}, return:
{ "found": false, "reason": "<brief reason>" }

Return ONLY the JSON. No other text.
`.trim()

  try {
    const session = await runSession(task, { timeout_ms: 120_000 })

    if (session.status === 'error' || session.isTaskSuccessful === false) {
      return notFound(`Session ${session.status}: ${session.output ?? 'unknown error'}`)
    }

    const raw = session.output ?? ''
    const parsed = parseJsonOutput(raw)

    if (!parsed) {
      return notFound(`Could not parse JSON from output: ${raw.slice(0, 200)}`)
    }

    if (parsed.found === false) {
      console.log(`[Browser-Use] Not found on ${competitor_name}: ${parsed.reason}`)
      return notFound(String(parsed.reason ?? 'Product not found'))
    }

    const confidence = Number(parsed.match_confidence ?? 0)
    if (confidence < min_confidence) {
      return notFound(`Confidence too low (${(confidence * 100).toFixed(0)}%) for ${competitor_name}`)
    }

    console.log(`[Browser-Use] ✓ ${competitor_name}: AED ${parsed.price} — "${parsed.product_title}" (${(confidence * 100).toFixed(0)}% confidence)`)

    return {
      found: true,
      product_title: String(parsed.product_title ?? ''),
      price: Number(parsed.price ?? 0),
      currency: 'AED',
      availability: Boolean(parsed.availability ?? true),
      delivery_fee: Number(parsed.delivery_fee ?? 0),
      product_url: String(parsed.product_url ?? competitor_url),
      match_confidence: confidence,
      screenshot_url: session.screenshotUrl ?? undefined,
      live_url: session.liveUrl,
      raw_output: raw,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[Browser-Use] Error scraping ${competitor_name}:`, msg)
    return notFound(msg)
  }
}

// ─── Screenshot Storage ────────────────────────────────────────────────────────

/**
 * Download a screenshot from Browser-Use and upload it to Supabase Storage.
 * Returns the public URL or null if Supabase is not configured.
 */
export async function saveScreenshotToSupabase(
  screenshotUrl: string,
  fileName: string,
  bucket = 'screenshots'
): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.warn('[Screenshot] Supabase not configured — screenshot not saved')
    return null
  }

  try {
    // Download from Browser-Use CDN
    const imgRes = await fetch(screenshotUrl)
    if (!imgRes.ok) return null
    const buffer = await imgRes.arrayBuffer()

    // Upload to Supabase Storage
    const uploadRes = await fetch(
      `${supabaseUrl}/storage/v1/object/${bucket}/${fileName}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'image/png',
          'x-upsert': 'true',
        },
        body: buffer,
      }
    )

    if (!uploadRes.ok) {
      console.error('[Screenshot] Upload failed:', await uploadRes.text())
      return null
    }

    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${fileName}`
  } catch (err) {
    console.error('[Screenshot] Error:', err)
    return null
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function notFound(reason: string): ScrapedPriceResult {
  return {
    found: false, product_title: '', price: 0, currency: 'AED',
    availability: false, delivery_fee: 0, product_url: '',
    match_confidence: 0, raw_output: reason,
  }
}

function parseJsonOutput(text: string): Record<string, unknown> | null {
  if (!text) return null
  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    // Extract first JSON object
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0])
  } catch {
    return null
  }
}
