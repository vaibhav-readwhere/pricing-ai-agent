import { initGemini, parseGeminiJSON, imageToBase64 } from '@/lib/agent/utils/gemini'

export interface ListingCandidate {
  rank: number
  title: string
  confidence: number
  price: number
  position: { x: number; y: number }
}

export async function analyzeListing({
  screenshotPath,
  targetProduct,
}: {
  screenshotPath: string
  targetProduct: string
}): Promise<ListingCandidate[]> {
  try {
    const model = initGemini()
    const base64 = imageToBase64(screenshotPath)

    const prompt =
      `You are a price monitoring assistant. Find products matching: '${targetProduct}'.` +
      ` Look at this e-commerce search results page screenshot.` +
      ` Return ONLY a raw JSON array (no markdown, no code block, no explanation):` +
      ` [{"rank":1,"title":"exact title as shown","confidence":0.9,"price":299.99,"position":{"x":720,"y":300}}]` +
      ` Rules:` +
      ` - Up to 5 best matches, sorted by confidence descending.` +
      ` - confidence (0.0-1.0): 0.9+ same model and variant, 0.7-0.9 same model different storage/color, 0.5-0.7 possibly same product family.` +
      ` - price: numeric price only (no currency symbols, no commas).` +
      ` - position: approximate center X,Y of the product card in pixels.` +
      ` - title: exact text of the product title as displayed.` +
      ` - If the page shows a CAPTCHA, consent popup, or no products, return [].` +
      ` - Do NOT penalise for storage/memory filter UI elements — match on brand and model name.`

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType: 'image/png', data: base64 } },
    ])

    const text = result.response.text()
    const parsed = parseGeminiJSON<ListingCandidate[]>(text)

    if (!Array.isArray(parsed)) return []
    return parsed.slice(0, 5)
  } catch (err) {
    console.error('[geminiListing] error:', err instanceof Error ? err.message : String(err))
    return []
  }
}
