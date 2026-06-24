import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'

export function initGemini() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY env var is not set')
  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
}

export function parseGeminiJSON<T>(text: string): T | null {
  // Pass 1: direct parse (already clean JSON)
  try { return JSON.parse(text.trim()) as T } catch { /* fall through */ }

  // Pass 2: strip a single leading/trailing markdown code fence
  try {
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    return JSON.parse(stripped) as T
  } catch { /* fall through */ }

  // Pass 3: extract the first JSON array or object embedded anywhere in the text
  // (handles cases like "Here are the results:\n```json\n[...]\n```")
  try {
    const arr = text.match(/\[[\s\S]*\]/)
    if (arr) return JSON.parse(arr[0]) as T
  } catch { /* fall through */ }
  try {
    const obj = text.match(/\{[\s\S]*\}/)
    if (obj) return JSON.parse(obj[0]) as T
  } catch { /* fall through */ }

  console.warn('[parseGeminiJSON] could not parse response:', text.slice(0, 200))
  return null
}

export function imageToBase64(filePath: string): string {
  return fs.readFileSync(filePath).toString('base64')
}
