import { initGemini } from '@/lib/agent/utils/gemini'

/**
 * Asks Gemini to strip retailer-specific phrasing and return a short,
 * cross-platform search query that will match the same product on Amazon,
 * Noon, Jumbo, etc.
 *
 * Example:
 *   in:  "Apple iPhone 17 Pro Max (2TB) – Deep Blue Middle East Version with FaceTime"
 *   out: "Apple iPhone 17 Pro Max 2TB Deep Blue"
 */
export async function extractGenericSearchName(productName: string): Promise<string> {
  try {
    const model = initGemini()

    const prompt = `You are a product search expert.

Given this retailer-specific product name, extract a short, generic search query that will find the EXACT SAME variant (same model, storage, colour) on any e-commerce site like Amazon, Noon, or Jumbo.

Rules:
- Keep: brand, model, variant (storage size, colour, screen size, RAM, etc.)
- Remove: retailer slogans, region tags ("Middle East Version"), "with FaceTime", bundle descriptions, dashes, parentheses
- Output ONLY the search query — no explanation, no quotes, no punctuation at the start or end
- Max 10 words

Product name: "${productName}"

Generic search query:`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim().replace(/^["']|["']$/g, '')
    return text || productName
  } catch (err) {
    console.error('[genericName] Gemini error:', err instanceof Error ? err.message : String(err))
    // Fall back to the original name so the agent keeps running
    return productName
  }
}
