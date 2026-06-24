import { execute, query } from '@/lib/db/connection'
import { log } from '@/lib/agent/utils/logger'
import { extractGenericSearchName } from '@/lib/agent/utils/genericName'
import { startRun } from '@/lib/agent/stages/01_startRun'
import { searchAndScreenshot } from '@/lib/agent/stages/02_searchScreenshot'
import { analyzeListing } from '@/lib/agent/stages/03_geminiListing'
import { clickAndDetail } from '@/lib/agent/stages/04_clickDetail'
import { extractDetail } from '@/lib/agent/stages/05_geminiDetail'
import { fetchCachedProductPrice } from '@/lib/agent/stages/fastPriceFetch'
import { buildRecommendation } from '@/lib/agent/stages/06_recommend'
import { sendAlertIfNeeded } from '@/lib/agent/stages/07_alert'
import { finaliseRun } from '@/lib/agent/stages/08_finaliseRun'

export async function runPricingAgent({
  triggeredBy = 'manual',
  userId,
  skuIds,
  runId: preGeneratedRunId,
}: {
  triggeredBy?: 'manual' | 'scheduled'
  userId?: string
  skuIds?: string[]
  runId?: string
}): Promise<{ runId: string; stats: ReturnType<typeof initStats> }> {
  const { runId, skus, competitors } = await startRun({ triggeredBy, userId, runId: preGeneratedRunId })

  const targetSkus = skuIds ? skus.filter(s => skuIds.includes(s.id)) : skus
  const stats = initStats()

  await log('info', `Agent started — ${targetSkus.length} SKU(s), ${competitors.length} competitor(s)`, {}, { runId })

  for (const sku of targetSkus) {
    await log('info', `[${sku.sku_id}] Normalising product name via Gemini`, {}, { runId, skuId: sku.id })

    const searchName = await extractGenericSearchName(sku.product_name)
    await log('info', `[${sku.sku_id}] Generic search name → "${searchName}"`, { original: sku.product_name }, { runId, skuId: sku.id })

    for (const competitor of competitors) {
      let checkId: string | undefined

      try {
        // Fast path: if we already have a confirmed high-confidence URL from a previous run,
        // skip the search + Gemini listing/detail pipeline and fetch price directly from the DOM.
        const cachedUrl = await getCachedCompetitorUrl(sku.id, competitor.id)
        if (cachedUrl) {
          await log('info', `[${sku.sku_id}] ${competitor.name}: cached URL found — skipping search (no Gemini cost)`, { url: cachedUrl }, { runId, skuId: sku.id, competitorId: competitor.id })
          const fast = await fetchCachedProductPrice({ runId, sku, competitor, cachedUrl })
          if (fast) {
            await log('success', `[${sku.sku_id}] ${competitor.name}: price AED ${fast.price} via cached URL (status: ${fast.status})`, { price: fast.price, status: fast.status }, { runId, skuId: sku.id, competitorId: competitor.id })
            stats.competitorsChecked++
            continue
          }
          // DOM extraction returned null — URL may be stale; fall through to full pipeline
          await log('warn', `[${sku.sku_id}] ${competitor.name}: cached URL price extraction failed — running full pipeline`, {}, { runId, skuId: sku.id, competitorId: competitor.id })
        }

        await log('info', `[${sku.sku_id}] Searching ${competitor.name}…`, {}, { runId, skuId: sku.id, competitorId: competitor.id })

        const { checkId: newCheckId, screenshotPath, searchUrl } = await searchAndScreenshot({
          runId,
          sku,
          competitor,
          searchName,
        })
        checkId = newCheckId

        await log('info', `[${sku.sku_id}] Screenshot saved — analysing listings with Gemini`, { searchUrl }, { runId, skuId: sku.id, competitorId: competitor.id })

        const candidates = await analyzeListing({
          screenshotPath,
          targetProduct: searchName,
        })

        const qualified = candidates.filter(c => c.confidence >= 0.6)
        await log(
          qualified.length > 0 ? 'info' : 'warn',
          `[${sku.sku_id}] ${competitor.name}: ${qualified.length} matching listing(s) found (confidence ≥ 60%)`,
          { candidates: candidates.map(c => ({ title: c.title, confidence: c.confidence })) },
          { runId, skuId: sku.id, competitorId: competitor.id }
        )

        const maxCandidates = Number(process.env.MAX_CANDIDATES) || 3
        const topCandidates = qualified.slice(0, maxCandidates)

        if (!topCandidates.length) continue

        let extracted = null

        for (const candidate of topCandidates) {
          await log('info', `[${sku.sku_id}] ${competitor.name}: clicking → "${candidate.title}"`, {}, { runId, skuId: sku.id, competitorId: competitor.id })

          const detail = await clickAndDetail({
            checkId,
            sku,
            competitor,
            candidate,
            searchUrl,
            searchName,
          })

          const result = await extractDetail({
            checkId,
            sku,
            competitor,
            detailScreenshotPath: detail.detailScreenshotPath,
            detailUrl: detail.detailUrl,
            searchName,
          })
          extracted = result.extracted

          if (extracted?.price) {
            await log(
              'success',
              `[${sku.sku_id}] ${competitor.name}: price AED ${extracted.price} @ ${Math.round((extracted.confidence ?? 0) * 100)}% confidence`,
              { price: extracted.price, confidence: extracted.confidence, url: detail.detailUrl },
              { runId, skuId: sku.id, competitorId: competitor.id }
            )
          } else {
            await log('warn', `[${sku.sku_id}] ${competitor.name}: no price extracted from product page`, {}, { runId, skuId: sku.id, competitorId: competitor.id })
          }

          if (extracted?.confidence != null && extracted.confidence >= 0.75) break
        }

        stats.competitorsChecked++
        stats.screenshots += 2
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        await log(
          'error',
          `[${sku.sku_id}] ${competitor.name}: failed — ${errMsg}`,
          { error: errMsg },
          { runId, skuId: sku.id, competitorId: competitor.id }
        )
        if (checkId) {
          await execute(
            `UPDATE competitor_checks SET status = 'error', error_message = ? WHERE id = ?`,
            [errMsg, checkId]
          )
        }
        continue
      }
    }

    await log('info', `[${sku.sku_id}] Building recommendation…`, {}, { runId, skuId: sku.id })
    const recommendation = await buildRecommendation({ runId, sku })

    if (recommendation) {
      await log(
        'info',
        `[${sku.sku_id}] Recommendation: ${recommendation.action} → AED ${recommendation.recommended} (${recommendation.reason})`,
        { action: recommendation.action, recommended: recommendation.recommended },
        { runId, skuId: sku.id }
      )
    }

    const alerted = await sendAlertIfNeeded({ runId, sku, recommendation })
    if (alerted) {
      await log('success', `[${sku.sku_id}] Alert email sent`, {}, { runId, skuId: sku.id })
      stats.alertsSent++
    }

    stats.skusProcessed++
    if (recommendation && recommendation.action !== 'maintain') stats.mismatches++

    await execute(
      `UPDATE agent_runs SET skus_processed = ?, competitors_checked = ? WHERE id = ?`,
      [stats.skusProcessed, stats.competitorsChecked, runId]
    )
  }

  await log('success', `Agent finished — ${stats.skusProcessed} SKUs, ${stats.competitorsChecked} checks, ${stats.mismatches} mismatches`, { stats }, { runId })
  await finaliseRun({ runId, stats })

  return { runId, stats }
}

function initStats() {
  return {
    skusProcessed: 0,
    competitorsChecked: 0,
    mismatches: 0,
    screenshots: 0,
    alertsSent: 0,
  }
}

// Returns the most recent competitor_url for this SKU+competitor where confidence was ≥0.9.
// Used to skip the full search pipeline on repeat runs.
async function getCachedCompetitorUrl(skuId: string, competitorId: string): Promise<string | null> {
  const rows = await query<{ competitor_url: string }>(
    `SELECT competitor_url FROM competitor_checks
     WHERE sku_id = ? AND competitor_id = ?
       AND match_confidence >= 0.9
       AND competitor_url IS NOT NULL
       AND status NOT IN ('error', 'needs_manual_review', 'low_confidence')
     ORDER BY created_at DESC LIMIT 1`,
    [skuId, competitorId]
  )
  return rows[0]?.competitor_url ?? null
}
