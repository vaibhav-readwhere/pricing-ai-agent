import { NextResponse } from 'next/server'
import { DashboardModel } from '@/lib/models/DashboardModel'

export const DashboardController = {
  async getStats() {
    try {
      const data = await DashboardModel.getStats()
      return NextResponse.json(data)
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  },
}
