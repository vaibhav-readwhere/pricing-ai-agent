import nodemailer from 'nodemailer'
import { query, execute } from '@/lib/db/connection'
import type { SKU } from '@/types'
import type { RecommendationResult } from './06_recommend'

type NotifRow = {
  smtp_host: string | null
  smtp_port: number
  smtp_user: string | null
  smtp_password_encrypted: string | null
  from_email: string
  from_name: string
  alert_on_overpriced: number | boolean
  alert_on_underpriced: number | boolean
  alert_threshold_pct: number | string
  default_recipients: string | null
}

export async function sendAlertIfNeeded({
  runId,
  sku,
  recommendation,
}: {
  runId: string
  sku: SKU
  recommendation: RecommendationResult | null
}): Promise<boolean> {
  if (!recommendation || recommendation.action === 'maintain') return false

  const rows = await query<NotifRow>('SELECT * FROM notification_settings LIMIT 1')
  if (!rows.length) return false
  const settings = rows[0]

  if (recommendation.action === 'decrease' && !Boolean(settings.alert_on_overpriced)) return false
  if (recommendation.action === 'increase' && !Boolean(settings.alert_on_underpriced)) return false

  const diffPct =
    Math.abs((sku.current_price - recommendation.recommended) / sku.current_price) * 100
  if (diffPct < Number(settings.alert_threshold_pct)) return false

  const skuRecipients: string[] = parseJSON<string[]>(sku.alert_recipients, [])
  const defaultRecipients: string[] = parseJSON<string[]>(settings.default_recipients, [])
  const recipients = [...new Set([...skuRecipients, ...defaultRecipients])]
  if (!recipients.length) return false

  const isOverpriced = recommendation.action === 'decrease'
  const subject = `[PriceWatch] ${isOverpriced ? '⚠️ Overpriced' : '📈 Underpriced'}: ${sku.product_name}`

  const bodyHtml = `
    <table style="font-family:sans-serif;border-collapse:collapse;width:100%;max-width:600px">
      <tr style="background:#f3f4f6">
        <td colspan="2" style="padding:16px;font-size:18px;font-weight:bold">
          ${isOverpriced ? '⚠️ Overpriced Alert' : '📈 Underpriced Opportunity'}: ${sku.product_name}
        </td>
      </tr>
      <tr><td style="padding:8px 16px;color:#6b7280">SKU</td><td style="padding:8px 16px">${sku.sku_id}</td></tr>
      <tr style="background:#f9fafb"><td style="padding:8px 16px;color:#6b7280">Our Price</td><td style="padding:8px 16px;font-weight:bold">AED ${sku.current_price.toFixed(2)}</td></tr>
      <tr><td style="padding:8px 16px;color:#6b7280">Competitor Min</td><td style="padding:8px 16px">AED ${recommendation.minPrice.toFixed(2)}</td></tr>
      <tr style="background:#f9fafb"><td style="padding:8px 16px;color:#6b7280">Competitor Max</td><td style="padding:8px 16px">AED ${recommendation.maxPrice.toFixed(2)}</td></tr>
      <tr><td style="padding:8px 16px;color:#6b7280">Competitor Avg</td><td style="padding:8px 16px">AED ${recommendation.avgPrice.toFixed(2)}</td></tr>
      <tr style="background:#eff6ff"><td style="padding:8px 16px;color:#1d4ed8;font-weight:bold">Recommended Price</td><td style="padding:8px 16px;color:#1d4ed8;font-weight:bold">AED ${recommendation.recommended.toFixed(2)}</td></tr>
      <tr><td colspan="2" style="padding:12px 16px;color:#374151;font-size:13px">${recommendation.reason}</td></tr>
    </table>
  `

  const transporter = nodemailer.createTransport({
    host: settings.smtp_host ?? undefined,
    port: settings.smtp_port ?? 587,
    auth: settings.smtp_user
      ? { user: settings.smtp_user, pass: settings.smtp_password_encrypted ?? '' }
      : undefined,
  })

  // Fetch lowest-priced competitor check so preview_data matches EmailAlert interface
  const lowestRows = await query<{ competitor_name: string; competitor_price: number }>(
    `SELECT competitor_name, competitor_price FROM competitor_checks
     WHERE run_id = ? AND sku_id = ? AND competitor_price IS NOT NULL
     ORDER BY competitor_price ASC LIMIT 1`,
    [runId, sku.id]
  )
  const lowestCheck = lowestRows[0]
  const previewData = {
    our_price: sku.current_price,
    competitor_price: lowestCheck?.competitor_price ?? recommendation.minPrice,
    competitor_name: lowestCheck?.competitor_name ?? 'Competitor',
    recommended_price: recommendation.recommended,
    reason: recommendation.reason,
  }

  let alertsSentCount = 0

  for (const recipient of recipients) {
    const alertId = crypto.randomUUID()
    await execute(
      `INSERT INTO email_alerts
         (id, run_id, sku_id, sku_name, recipient, subject, body_html, status, preview_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW())`,
      [
        alertId,
        runId,
        sku.id,
        sku.product_name,
        recipient,
        subject,
        bodyHtml,
        JSON.stringify(previewData),
      ]
    )

    try {
      await transporter.sendMail({
        from: `"${settings.from_name}" <${settings.from_email}>`,
        to: recipient,
        subject,
        html: bodyHtml,
      })
      await execute(
        `UPDATE email_alerts SET status = 'sent', sent_at = NOW() WHERE id = ?`,
        [alertId]
      )
      alertsSentCount++
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      await execute(
        `UPDATE email_alerts SET status = 'failed', error_message = ? WHERE id = ?`,
        [errMsg, alertId]
      )
    }
  }

  if (alertsSentCount > 0) {
    await execute(
      `UPDATE agent_runs SET alerts_sent = alerts_sent + ? WHERE id = ?`,
      [alertsSentCount, runId]
    )
  }

  return alertsSentCount > 0
}

function parseJSON<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T } catch { return fallback }
  }
  return val as T
}
