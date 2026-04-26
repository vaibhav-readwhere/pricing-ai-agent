import { NextResponse } from 'next/server'
import { mockEmailAlerts } from '@/lib/mock-data'

export async function GET() {
  return NextResponse.json({
    data: mockEmailAlerts,
    total: mockEmailAlerts.length,
    stats: {
      sent: mockEmailAlerts.filter(a => a.status === 'sent').length,
      failed: mockEmailAlerts.filter(a => a.status === 'failed').length,
    },
  })
}
