// api/cron/weekly-digest.js
// Vercel Cron Function — runs every Monday at 06:00 BRT
// ─────────────────────────────────────────────────────────────────────────────
// Schedule defined in vercel.json:
//   { "crons": [{ "path": "/api/cron/weekly-digest", "schedule": "0 9 * * 1" }] }
//
// Vercel automatically sends a GET request with header:
//   Authorization: Bearer <CRON_SECRET>
//
// Flow:
//   1. Fetch raw data from Câmara, Senado, DOU
//   2. Classify each item with Claude API
//   3. Upsert new events to Supabase
//   4. Recalculate PLI Scores
//   5. If any score changed >5 pts → trigger PLI Flash email

const { fetchAllSources, getLastWeekISO } = require('../../lib/fetchers');
const { classifyEvent } = require('../../lib/classifyEvent');
const { supabaseAdmin } = require('../../lib/supabase');

// ── Score recalculation ───────────────────────────────────────────────────────
const SCORE_BASELINES = {
  'PFAS food contact':  88, 'Filmes multicamada': 79, 'EPS': 76,
  'PVC embalagem':      72, 'PE filme mono':      54, 'Papel/cartão FSC': 42,
  'PET garrafa':        38, 'OPP mono':           35, 'Papelão ondulado': 28,
  'Bio-based PE':       22,
};

const SUBSTRATE_CHAIN = {
  'PFAS food contact': 'plastic', 'Filmes multicamada': 'plastic',
  'EPS': 'plastic',              'PVC embalagem': 'plastic',
  'PE filme mono': 'plastic',    'OPP mono': 'plastic',
  'Bio-based PE': 'plastic',     'Papel/cartão FSC': 'paper',
  'Papelão ondulado': 'paper',   'PET garrafa': 'recycl',
};

function getBand(score) {
  if (score >= 70) return 'CRÍTICA';
  if (score >= 40) return 'MONITORAMENTO';
  return 'ESTÁVEL';
}

async function recalculateScores() {
  // Get all active events with their impacts
  const { data: activeEvents } = await supabaseAdmin
    .from('events')
    .select('substrates, score_impact, urgency')
    .eq('active', true)
    .in('urgency', ['CRÍTICO', 'MONITORAMENTO', 'EM VIGOR']);

  const deltaBySubstrate = {};
  for (const ev of (activeEvents || [])) {
    for (const sub of (ev.substrates || [])) {
      deltaBySubstrate[sub] = (deltaBySubstrate[sub] || 0) + Math.round(ev.score_impact * 0.4);
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const snapshots = [];

  for (const [sub, base] of Object.entries(SCORE_BASELINES)) {
    const delta = deltaBySubstrate[sub] || 0;
    const score = Math.min(100, Math.max(0, base + delta));
    snapshots.push({
      substrate: sub,
      chain: SUBSTRATE_CHAIN[sub],
      score,
      score_base: base,
      score_delta: delta,
      band: getBand(score),
      snapshot_date: today,
    });
  }

  await supabaseAdmin
    .from('pli_scores')
    .upsert(snapshots, { onConflict: 'substrate,snapshot_date' });

  return snapshots;
}

// ── PLI Flash email trigger ───────────────────────────────────────────────────
async function triggerFlashIfNeeded(newSnapshots) {
  const today = new Date().toISOString().split('T')[0];
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastWeekStr = lastWeek.toISOString().split('T')[0];

  // Get last week's scores for comparison
  const { data: prevScores } = await supabaseAdmin
    .from('pli_scores')
    .select('substrate, score')
    .eq('snapshot_date', lastWeekStr);

  const prevMap = {};
  for (const p of (prevScores || [])) prevMap[p.substrate] = p.score;

  const alerts = newSnapshots
    .filter(s => Math.abs(s.score - (prevMap[s.substrate] || s.score_base)) >= 5)
    .map(s => ({
      substrate: s.substrate,
      prev: prevMap[s.substrate] || s.score_base,
      curr: s.score,
      delta: s.score - (prevMap[s.substrate] || s.score_base),
    }));

  if (alerts.length > 0) {
    console.log(`[flash] ${alerts.length} substrates with Δ≥5 — triggering PLI Flash email`);
    // In production: call email service (Resend, SendGrid, etc.)
    // await sendFlashEmail(alerts);
    // For now: log to Supabase notifications table
    await supabaseAdmin.from('notifications').insert(
      alerts.map(a => ({
        type: 'FLASH',
        subject: `PLI Flash™ — ${a.substrate} ${a.delta > 0 ? '▲' : '▼'}${Math.abs(a.delta)} pts`,
        status: 'pending', // Set to 'sent' after email delivery
      }))
    );
  }

  return alerts;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Verify cron secret (Vercel sets this automatically)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const since = getLastWeekISO();
  let eventsNew = 0;
  let eventsFetched = 0;

  try {
    console.log(`[cron] Starting weekly digest — since ${since}`);

    // 1. Fetch raw data from all sources
    const rawItems = await fetchAllSources(since);
    eventsFetched = rawItems.length;
    console.log(`[cron] Fetched ${eventsFetched} raw items`);

    // 2. Check which external_ids are already in DB
    const { data: existing } = await supabaseAdmin
      .from('events')
      .select('external_id');
    const existingIds = new Set((existing || []).map(e => e.external_id));

    // 3. Classify new items with Claude
    const toInsert = [];
    for (const item of rawItems) {
      if (existingIds.has(item.external_id)) continue;

      const classified = await classifyEvent(item.raw);
      if (!classified) continue;

      toInsert.push({
        external_id: item.external_id,
        type:         classified.type,
        urgency:      classified.urgency,
        chain:        classified.chain,
        title:        classified.title,
        body:         classified.body,
        status:       classified.status,
        last_move:    classified.last_move,
        details:      classified.details,
        players:      classified.players || [],
        substrates:   classified.substrates || [],
        score_impact: classified.score_impact || 0,
        source:       item.source,
        source_url:   item.source_url,
        event_date:   since,
      });
    }

    // 4. Upsert to Supabase
    if (toInsert.length > 0) {
      await supabaseAdmin.from('events').insert(toInsert);
      eventsNew = toInsert.length;
      console.log(`[cron] Inserted ${eventsNew} new events`);
    }

    // 5. Recalculate PLI Scores
    const snapshots = await recalculateScores();
    console.log(`[cron] Recalculated ${snapshots.length} PLI scores`);

    // 6. Trigger flash if score changed significantly
    const alerts = await triggerFlashIfNeeded(snapshots);

    // 7. Log run
    await supabaseAdmin.from('digest_runs').insert({
      run_date: since,
      events_fetched: eventsFetched,
      events_new: eventsNew,
      status: 'ok',
      notes: alerts.length > 0 ? `Flash triggered for: ${alerts.map(a => a.substrate).join(', ')}` : null,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[cron] Done in ${elapsed}s — ${eventsNew} new events, ${alerts.length} flash alerts`);

    return res.status(200).json({
      ok: true,
      since,
      events_fetched: eventsFetched,
      events_new: eventsNew,
      flash_alerts: alerts.length,
      elapsed_seconds: parseFloat(elapsed),
    });

  } catch (err) {
    console.error('[cron] Fatal error:', err);
    await supabaseAdmin.from('digest_runs').insert({
      run_date: since,
      events_fetched: eventsFetched,
      events_new: eventsNew,
      status: 'error',
      notes: err.message,
    });
    return res.status(500).json({ error: err.message });
  }
}
