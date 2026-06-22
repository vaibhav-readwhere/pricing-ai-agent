import { NextResponse } from 'next/server'
import { SKUModel } from '@/lib/models/SKUModel'

export const SKUController = {
  async list(request: Request) {
    try {
      const { searchParams } = new URL(request.url)
      const data = await SKUModel.findAll({
        status:   searchParams.get('status') ?? undefined,
        category: searchParams.get('category') ?? undefined,
        search:   searchParams.get('search') ?? undefined,
      })
      return NextResponse.json({ data, total: data.length })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  },

  async get(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
      const { id } = await params
      const data = await SKUModel.findById(id)
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ data })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  },

  async create(request: Request) {
    try {
      const body = await request.json()
      const data = await SKUModel.create(body)
      return NextResponse.json({ data }, { status: 201 })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 400 })
    }
  },

  async update(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
      const { id } = await params
      const body = await request.json()
      const data = await SKUModel.update(id, body)
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ data })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 400 })
    }
  },

  async remove(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
      const { id } = await params
      const ok = await SKUModel.delete(id)
      if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ success: true })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 400 })
    }
  },
}
