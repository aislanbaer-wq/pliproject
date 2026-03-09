// api/scores.js — GET /api/scores
// Returns latest PLI Score™ snapshot for all substrates
// Public endpoint (cached) — no auth required for current scores
// ─────────────────────────────────────────────────────────────────────────────
const { supabaseAdmin } = require('../lib/supabase');

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  // Latest snapshot date
  const { data: latest } = await supabaseAdmin
    .from('pli_scores')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single();

  if (!latest) return res.status(200).json({ scores: [], snapshot_date: null });

  const { data, error } = await supabaseAdmin
    .from('pli_scores')
    .select('substrate, chain, score, score_base, score_delta, band, snapshot_date')
    .eq('snapshot_date', latest.snapshot_date)
    .order('score', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Also get previous week for delta display
  const prevDate = new Date(latest.snapshot_date);
  prevDate.setDate(prevDate.getDate() - 7);
  const prevDateStr = prevDate.toISOString().split('T')[0];

  const { data: prev } = await supabaseAdmin
    .from('pli_scores')
    .select('substrate, score')
    .eq('snapshot_date', prevDateStr);

  const prevMap = {};
  for (const p of (prev || [])) prevMap[p.substrate] = p.score;

  const scores = (data || []).map(s => ({
    ...s,
    score_prev: prevMap[s.substrate] ?? s.score,
    score_week_delta: s.score - (prevMap[s.substrate] ?? s.score),
  }));

  return res.status(200).json({
    scores,
    snapshot_date: latest.snapshot_date,
    prev_date: prevDateStr,
  });
}
