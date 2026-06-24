import { NextResponse } from 'next/server'
import { AlertModel } from '@/lib/models/AlertModel'

export const AlertController = {
  async list() {
    try {
      const alerts = await AlertModel.findAll()
      return NextResponse.json({
        data:  alerts,
        total: alerts.length,
        stats: {
          sent:    alerts.filter(a => a.status === 'sent').length,
          failed:  alerts.filter(a => a.status === 'failed').length,
          pending: alerts.filter(a => a.status === 'pending').length,
        },
      })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  },

  async resend(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
      const { id } = await params
      const data = await AlertModel.resetToPending(id)
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ data })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 400 })
    }
  },
}
