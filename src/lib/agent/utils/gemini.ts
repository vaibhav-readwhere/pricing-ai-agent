import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'

export function initGemini() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY env var is not set')
  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
}

export function parseGeminiJSON<T>(text: string): T | null {
  try {
    // Strip ```json ... ``` or ``` ... ``` fences
    const stripped = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()
    return JSON.parse(stripped) as T
  } catch {
    return null
  }
}

export function imageToBase64(filePath: string): string {
  return fs.readFileSync(filePath).toString('base64')
}
