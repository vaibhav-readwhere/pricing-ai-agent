import { NextResponse } from 'next/server'
import { RecommendationModel } from '@/lib/models/RecommendationModel'

export const RecommendationController = {
  async list(request: Request) {
    try {
      const { searchParams } = new URL(request.url)
      const recs = await RecommendationModel.findAll({
        action: searchParams.get('action') ?? undefined,
        status: searchParams.get('status') ?? undefined,
      })
      return NextResponse.json({
        data:  recs,
        total: recs.length,
        stats: {
          decrease:      recs.filter(r => r.action === 'decrease').length,
          increase:      recs.filter(r => r.action === 'increase').length,
          maintain:      recs.filter(r => r.action === 'maintain').length,
          manual_review: recs.filter(r => r.action === 'manual_review').length,
        },
      })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  },

  async update(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
      const { id } = await params
      const body = await request.json()
      const data = await RecommendationModel.update(id, {
        reviewed: body.reviewed,
        applied:  body.applied,
      })
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ data })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 400 })
    }
  },
}
