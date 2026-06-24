import { execute } from '@/lib/db/connection'
import { initGemini, parseGeminiJSON, imageToBase64 } from '@/lib/agent/utils/gemini'
import type { SKU, Competitor, CompetitorCheckStatus } from '@/types'

export interface ExtractedDetail {
  title: string
  confidence: number
  price: number
  currency: string
  originalPrice?: number
  discount?: number
  rating?: number
  reviewCount?: number
  availability: string
  variants?: { label: string; price: number }[]
}

export interface GeminiDetailResult {
  extracted: ExtractedDetail | null
  status: CompetitorCheckStatus
}

export async function extractDetail({
  checkId,
  sku,
  competitor,
  detailScreenshotPath,
  detailUrl,
  searchName,
}: {
  checkId: string
  sku: SKU
  competitor: Competitor
  detailScreenshotPath: string
  detailUrl: string
  searchName?: string
}): Promise<GeminiDetailResult> {
  let extracted: ExtractedDetail | null = null

  const target = searchName ?? sku.product_name
  const storageMatch = target.match(/\b(\d+\s*(?:TB|GB))\b/i)
  const variantHint = storageMatch
    ? ` Target storage variant: ${storageMatch[0].toUpperCase()}. If a different storage is currently selected, find and return the price shown for the ${storageMatch[0].toUpperCase()} variant in the variant selector (do not guess).`
    : ''

  try {
    const model = initGemini()
    const base64 = imageToBase64(detailScreenshotPath)

    const prompt =
      `Extract product details from this e-commerce product page. I am looking for: '${target}'.${variantHint}` +
      ` Return raw JSON only, no markdown:` +
      ` {"title":"...","confidence":0.9,"price":299.99,"currency":"AED","originalPrice":349.99,` +
      `"discount":14.3,"rating":4.5,"reviewCount":123,"availability":"in stock",` +
      `"variants":[{"label":"2 TB","price":7999.00}]}`

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType: 'image/png', data: base64 } },
    ])

    extracted = parseGeminiJSON<ExtractedDetail>(result.response.text())
  } catch {
    extracted = null
  }

  // Determine status
  let status: CompetitorCheckStatus
  if (!extracted || extracted.confidence < 0.6) {
    status = 'low_confidence'
  } else if (!extracted.price) {
    status = 'error'
  } else if (sku.current_price > extracted.price * 1.05) {
    status = 'overpriced'
  } else if (sku.current_price < extracted.price * 0.95) {
    status = 'underpriced'
  } else {
    status = 'price_ok'
  }

  const availability = extracted?.availability?.toLowerCase() === 'in stock'

  await execute(
    `UPDATE competitor_checks
     SET competitor_price = ?,
         competitor_url = ?,
         discount = ?,
         availability = ?,
         status = ?,
         match_confidence = ?,
         agent_notes = ?
     WHERE id = ?`,
    [
      extracted?.price ?? null,
      detailUrl,
      extracted?.discount ?? null,
      availability ? 1 : 0,
      status,
      extracted?.confidence ?? 0,
      extracted ? JSON.stringify({ title: extracted.title, variants: extracted.variants ?? [] }) : null,
      checkId,
    ]
  )

  if (extracted?.price) {
    const snapshotId = crypto.randomUUID()
    await execute(
      `INSERT INTO price_snapshots (id, sku_id, competitor_id, price, availability, snapshot_url, captured_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [snapshotId, sku.id, competitor.id, extracted.price, availability ? 1 : 0, detailUrl]
    )
  }

  return { extracted, status }
}
