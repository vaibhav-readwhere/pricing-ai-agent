import { NextResponse } from 'next/server'
import { CompetitorModel } from '@/lib/models/CompetitorModel'

export const CompetitorController = {
  async list() {
    try {
      const data = await CompetitorModel.findAll()
      return NextResponse.json({ data, total: data.length })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  },

  async create(request: Request) {
    try {
      const body = await request.json()
      const data = await CompetitorModel.create({
        name:               body.name,
        website_url:        body.website_url,
        search_url_pattern: body.search_url_pattern ?? '',
        logo:               body.logo ?? null,
        price_selector:     body.price_selector ?? null,
        screenshot_required: body.screenshot_required ?? true,
        status:             body.status ?? 'active',
        matching_rules: {
          title_similarity_threshold: Number(body.title_similarity_threshold ?? body.matching_rules?.title_similarity_threshold ?? 0.75),
          brand_match_required:       Boolean(body.brand_match_required ?? body.matching_rules?.brand_match_required ?? true),
          model_match_required:       Boolean(body.model_match_required ?? body.matching_rules?.model_match_required ?? false),
        },
      })
      return NextResponse.json({ data }, { status: 201 })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 400 })
    }
  },

  async update(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
      const { id } = await params
      const body = await request.json()
      const data = await CompetitorModel.update(id, {
        name:                       body.name,
        website_url:                body.website_url,
        search_url_pattern:         body.search_url_pattern,
        logo:                       body.logo,
        price_selector:             body.price_selector,
        screenshot_required:        body.screenshot_required,
        status:                     body.status,
        title_similarity_threshold: body.title_similarity_threshold,
        brand_match_required:       body.brand_match_required,
        matching_rules:             body.matching_rules,
      })
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ data })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 400 })
    }
  },

  async remove(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
      const { id } = await params
      const ok = await CompetitorModel.delete(id)
      if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ success: true })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 400 })
    }
  },
}
