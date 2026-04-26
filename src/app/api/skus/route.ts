import { NextResponse } from 'next/server'
import { mockSKUs } from '@/lib/mock-data'
import type { SKU } from '@/types'

let skus: SKU[] = [...mockSKUs]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const category = searchParams.get('category')
  const search = searchParams.get('search')?.toLowerCase()

  let result = skus
  if (status) result = result.filter(s => s.status === status)
  if (category) result = result.filter(s => s.category === category)
  if (search) result = result.filter(s => s.product_name.toLowerCase().includes(search) || s.sku_id.toLowerCase().includes(search))

  return NextResponse.json({ data: result, total: result.length })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const newSKU: SKU = {
      id: `sku-${Date.now()}`,
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    skus = [newSKU, ...skus]
    return NextResponse.json({ data: newSKU }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
