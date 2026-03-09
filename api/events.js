// api/events.js — GET /api/events
// Returns events filtered by tier, chain, urgency
// Requires valid Supabase session (passed via Authorization header)
// ─────────────────────────────────────────────────────────────────────────────
const { supabaseAdmin } = require('../lib/supabase');

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  const { chain, urgency, limit = '50' } = req.query;
  const jwt = req.headers.authorization?.replace('Bearer ', '');

  // Verify subscriber tier from JWT
  let tier = 0;
  if (jwt) {
    const { data: { user } } = await supabaseAdmin.auth.getUser(jwt);
    if (user) {
      const { data: sub } = await supabaseAdmin
        .from('subscribers')
        .select('tier, active, trial, trial_ends')
        .eq('id', user.id)
        .single();

      if (sub?.active) tier = sub.tier;
      // Trial access
      if (sub?.trial && new Date(sub.trial_ends) > new Date()) tier = 1;
    }
  }

  // Demo mode (no auth) — return limited preview
  const isDemo = tier === 0;
  const eventLimit = isDemo ? 3 : parseInt(limit);

  let query = supabaseAdmin
    .from('events')
    .select('id, type, urgency, chain, title, body, status, last_move, players, substrates, score_impact, source, event_date, details')
    .eq('active', true)
    .order('event_date', { ascending: false })
    .limit(eventLimit);

  if (chain && chain !== 'all') query = query.eq('chain', chain);
  if (urgency && urgency !== 'all') query = query.eq('urgency', urgency);

  // Tier 1+: full feed but no details field
  // Tier 2+: full feed + details + players
  // Tier 3: everything + source_url
  if (tier < 2) {
    query = supabaseAdmin
      .from('events')
      .select('id, type, urgency, chain, title, body, status, last_move, substrates, score_impact, event_date')
      .eq('active', true)
      .order('event_date', { ascending: false })
      .limit(eventLimit);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({
    events: data || [],
    tier,
    is_demo: isDemo,
    total: data?.length || 0,
  });
}
