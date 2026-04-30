/**
 * Browser-Use Cloud API Integration
 * https://browser-use.com
 *
 * Replaces all Playwright/Puppeteer placeholder functions in price-monitor.ts
 * with real AI-powered browser automation calls.
 */

const BROWSER_USE_API_URL = 'https://api.browser-use.com/api/v1'
const API_KEY = process.env.BROWSER_USE_API_KEY!

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BrowserUseTaskResult {
  success: boolean
  output: string       // natural language summary from the agent
  extracted: unknown   // structured JSON extracted by the agent
  screenshot?: string  // base64 PNG screenshot
  error?: string
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
  screenshot_base64?: string
  raw_output: string
}

// ─── Core Browser-Use API Client ─────────────────────────────────────────────

/**
 * Run a task via Browser-Use Cloud API and poll until complete.
 */
async function runBrowserTask(
  task: string,
  options: {
    max_steps?: number
    timeout_ms?: number
    structured_output_schema?: object
  } = {}
): Promise<BrowserUseTaskResult> {
  const { max_steps = 20, timeout_ms = 60000, structured_output_schema } = options

  // 1. Create the task
  const createRes = await fetch(`${BROWSER_USE_API_URL}/run-task`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      task,
      ...(structured_output_schema && { structured_output_schema }),
    }),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Browser-Use task creation failed: ${createRes.status} — ${err}`)
  }

  const { id: taskId } = await createRes.json()
  console.log(`[Browser-Use] Task created: ${taskId}`)

  // 2. Poll until finished
  const deadline = Date.now() + timeout_ms
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000)) // poll every 3s

    const statusRes = await fetch(`${BROWSER_USE_API_URL}/task/${taskId}`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    })

    if (!statusRes.ok) continue

    const data = await statusRes.json()
    const status: string = data.status

    console.log(`[Browser-Use] Task ${taskId} status: ${status}`)

    if (status === 'finished' || status === 'done') {
      return {
        success: true,
        output: data.output ?? data.result ?? '',
        extracted: data.extracted_content ?? data.output ?? null,
        screenshot: data.screenshot,
      }
    }

    if (status === 'failed' || status === 'error') {
      return {
        success: false,
        output: '',
        extracted: null,
        error: data.error ?? 'Task failed',
      }
    }

    // statuses: 'created', 'running', 'paused' — keep polling
  }

  return { success: false, output: '', extracted: null, error: 'Task timed out' }
}

// ─── Price Scraping via Browser-Use ──────────────────────────────────────────

/**
 * Search for a product on a competitor site and extract price details.
 * Uses Browser-Use AI to find the best matching product automatically —
 * no CSS selectors needed.
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
    product_name,
    brand,
    sku_id,
    competitor_name,
    competitor_url,
    search_url_pattern,
    min_confidence = 0.70,
  } = params

  const searchUrl = search_url_pattern.replace('{query}', encodeURIComponent(`${brand} ${product_name}`))

  const task = `
You are a price monitoring agent. Your job is to find the exact product and its current price on a retail website.

PRODUCT TO FIND:
- Name: ${product_name}
- Brand: ${brand}
- SKU: ${sku_id}

WEBSITE: ${competitor_name} (${competitor_url})

STEPS:
1. Go to this search URL: ${searchUrl}
2. Look at the search results and find the product that best matches "${brand} ${product_name}"
3. The product MUST be from brand "${brand}" — do not return a different brand
4. Click on the best matching product to open its detail page
5. Extract:
   - exact product title as shown on the page
   - current selling price (number only, no currency symbol)
   - whether it is in stock / available (true/false)
   - delivery fee if shown (0 if free delivery)
   - the full product page URL
   - your confidence score (0.0 to 1.0) that this is the correct matching product

Return ONLY a JSON object with these exact keys:
{
  "product_title": "...",
  "price": 0.00,
  "availability": true,
  "delivery_fee": 0.00,
  "product_url": "...",
  "match_confidence": 0.00
}

If you cannot find the product or are less than ${min_confidence * 100}% confident it is a match, return:
{ "found": false, "reason": "..." }
`.trim()

  try {
    const result = await runBrowserTask(task, {
      max_steps: 15,
      timeout_ms: 90000,
      structured_output_schema: {
        type: 'object',
        properties: {
          product_title: { type: 'string' },
          price: { type: 'number' },
          availability: { type: 'boolean' },
          delivery_fee: { type: 'number' },
          product_url: { type: 'string' },
          match_confidence: { type: 'number' },
          found: { type: 'boolean' },
          reason: { type: 'string' },
        },
      },
    })

    if (!result.success) {
      return {
        found: false,
        product_title: '',
        price: 0,
        currency: 'AED',
        availability: false,
        delivery_fee: 0,
        product_url: '',
        match_confidence: 0,
        raw_output: result.error ?? 'Browser-Use task failed',
      }
    }

    // Parse the extracted JSON
    let extracted: Record<string, unknown> = {}
    if (typeof result.extracted === 'string') {
      try {
        // Browser-Use sometimes wraps JSON in markdown
        const cleaned = result.extracted.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        extracted = JSON.parse(cleaned)
      } catch {
        // Try parsing from natural language output as fallback
        extracted = parseNaturalLanguagePrice(result.output)
      }
    } else if (result.extracted && typeof result.extracted === 'object') {
      extracted = result.extracted as Record<string, unknown>
    }

    // Check if not found
    if (extracted.found === false) {
      console.log(`[Browser-Use] Product not found on ${competitor_name}: ${extracted.reason}`)
      return {
        found: false,
        product_title: '',
        price: 0,
        currency: 'AED',
        availability: false,
        delivery_fee: 0,
        product_url: '',
        match_confidence: 0,
        raw_output: String(extracted.reason ?? result.output),
      }
    }

    const confidence = Number(extracted.match_confidence ?? 0)
    if (confidence < min_confidence) {
      console.log(`[Browser-Use] Low confidence (${confidence}) on ${competitor_name} — skipping`)
      return {
        found: false,
        product_title: String(extracted.product_title ?? ''),
        price: 0,
        currency: 'AED',
        availability: false,
        delivery_fee: 0,
        product_url: '',
        match_confidence: confidence,
        raw_output: result.output,
      }
    }

    return {
      found: true,
      product_title: String(extracted.product_title ?? ''),
      price: Number(extracted.price ?? 0),
      currency: 'AED',
      availability: Boolean(extracted.availability ?? true),
      delivery_fee: Number(extracted.delivery_fee ?? 0),
      product_url: String(extracted.product_url ?? competitor_url),
      match_confidence: confidence,
      screenshot_base64: result.screenshot,
      raw_output: result.output,
    }
  } catch (error) {
    console.error(`[Browser-Use] Error scraping ${competitor_name}:`, error)
    return {
      found: false,
      product_title: '',
      price: 0,
      currency: 'AED',
      availability: false,
      delivery_fee: 0,
      product_url: '',
      match_confidence: 0,
      raw_output: error instanceof Error ? error.message : String(error),
    }
  }
}

// ─── Screenshot Storage ───────────────────────────────────────────────────────

/**
 * Save a base64 screenshot from Browser-Use to Supabase Storage.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */
export async function saveScreenshotToSupabase(
  base64Image: string,
  fileName: string,
  bucket = 'screenshots'
): Promise<string | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      console.warn('[Screenshot] Supabase not configured — screenshot not saved')
      return null
    }

    // Strip base64 prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

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

    // Return public URL
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${fileName}`
  } catch (err) {
    console.error('[Screenshot] Error:', err)
    return null
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fallback: try to extract price info from natural language output
 * when JSON parsing fails.
 */
function parseNaturalLanguagePrice(text: string): Record<string, unknown> {
  const priceMatch = text.match(/(?:price|AED|cost)[:\s]+(?:AED\s*)?(\d[\d,]*(?:\.\d+)?)/i)
  const availMatch = text.match(/\b(in stock|available|out of stock|unavailable)\b/i)
  const urlMatch = text.match(/https?:\/\/[^\s"']+/i)

  return {
    price: priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0,
    availability: availMatch ? !availMatch[1].toLowerCase().includes('out') : true,
    product_url: urlMatch ? urlMatch[0] : '',
    match_confidence: 0.5,
    product_title: '',
    delivery_fee: 0,
  }
}
