import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('image') as File | null
    if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const dir = path.join(process.cwd(), 'public', 'sku-images')
    await mkdir(dir, { recursive: true })

    const filename = `${crypto.randomUUID()}.${ext}`
    await writeFile(path.join(dir, filename), buffer)

    return NextResponse.json({ url: `/sku-images/${filename}` })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
