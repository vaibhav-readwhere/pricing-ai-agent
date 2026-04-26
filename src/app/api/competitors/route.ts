import { NextResponse } from 'next/server'
import { mockCompetitors } from '@/lib/mock-data'
import type { Competitor } from '@/types'

let competitors: Competitor[] = [...mockCompetitors]

export async function GET() {
  return NextResponse.json({ data: competitors, total: competitors.length })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const newComp: Competitor = {
      id: `comp-${Date.now()}`,
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    competitors = [newComp, ...competitors]
    return NextResponse.json({ data: newComp }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
