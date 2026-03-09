// api/cron/weekly-digest.js
import { fetchAllSources, getLastWeekISO } from '../../lib/fetchers.js';
import { classifyEvent } from '../../lib/classifyEvent.js';
import { supabaseAdmin } from '../../lib/supabase.js';

const SCORE_BASELINES = {
  'PFAS food contact': 88, 'Filmes multicamada': 79, 'EPS': 76,
  'PVC embalagem': 72,     'PE filme mono': 54,       'Papel/cartão FSC': 42,
  'PET garrafa': 38,       'OPP mono': 35,            'Papelão ondulado': 28,
  'Bio-based PE': 22,
};
const SUBSTRATE_CHAIN = {
  'PFAS food contact': 'plastic', 'Filmes multicamada': 'plastic',
  'EPS': 'plastic', 'PVC embalagem': 'plastic', 'PE filme mono': 'plastic',
  'OPP mono': 'plastic', 'Bio-based PE': 'plastic',
  'Papel/cartão FSC': 'paper', 'Papelão ondulado': 'paper',
  'PET garrafa': 'recycl',
};

function getBand(s) { return s >= 70 ? 'CRÍTICA' : s >= 40 ? 'MONITORAMENTO' : 'ESTÁVEL'; }

async function recalculateScores() {
  const { data: events } = await supabaseAdmin
    .from('events').select('substrates, score_impact, urgency')
    .eq('active', true).in('urgency', ['CRÍTICO', 'MONITORAMENTO', 'EM VIGOR']);

  const delta = {};
  for (const ev of (events || [])) {
    for (const sub of (ev.substrates || [])) {
      delta[sub] = (delta[sub] || 0) + Math.round((ev.score_impact || 0) * 0.4);
    }
  }
  const today = new Date().toISOString().split('T')[0];
  const snapshots = Object.entries(SCORE_BASELINES).map(([sub, base]) => {
    const score = Math.min(100, Math.max(0, base + (delta[sub] || 0)));
    return { substrate: sub, chain: SUBSTRATE_CHAIN[sub], score, score_base: base,
             score_delta: delta[sub] || 0, band: getBand(score), snapshot_date: today };
  });
  await supabaseAdmin.from('pli_scores')
    .upsert(snapshots, { onConflict: 'substrate,snapshot_date' });
  return snapshots;
}

export default async function handler(req, res) {
  const auth = req.headers.authorization;
  const querySecret = req.query.secret;
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && querySecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const since = getLastWeekISO();
  let fetched = 0, inserted = 0;

  try {
    const raw = await fetchAllSources(since);
    fetched = raw.length;

    const { data: existing } = await supabaseAdmin.from('events').select('external_id');
    const existingIds = new Set((existing || []).map(e => e.external_id));

    const toInsert = [];
    for (const item of raw) {
      if (existingIds.has(item.external_id)) continue;
      const classified = await classifyEvent(item.raw);
      if (!classified) continue;
      toInsert.push({
        external_id: item.external_id, type: classified.type,
        urgency: classified.urgency, chain: classified.chain,
        title: classified.title, body: classified.body,
        status: classified.status, last_move: classified.last_move,
        details: classified.details, players: classified.players || [],
        substrates: classified.substrates || [],
        score_impact: classified.score_impact || 0,
        source: item.source, source_url: item.source_url, event_date: since,
      });
    }

    if (toInsert.length > 0) {
      await supabaseAdmin.from('events').insert(toInsert);
      inserted = toInsert.length;
    }

    const scores = await recalculateScores();

    await supabaseAdmin.from('digest_runs').insert({
      run_date: since, events_fetched: fetched,
      events_new: inserted, status: 'ok',
    });

    return res.status(200).json({ ok: true, since, fetched, inserted, scores: scores.length });
  } catch (err) {
    console.error('[cron]', err);
    await supabaseAdmin.from('digest_runs').insert({
      run_date: since, events_fetched: fetched, events_new: inserted,
      status: 'error', notes: err.message,
    });
    return res.status(500).json({ error: err.message });
  }
}
