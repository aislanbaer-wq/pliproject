const { supabaseAdmin } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

  const { chain, urgency, limit = '50' } = req.query;

  let query = supabaseAdmin
    .from('events')
    .select('id, external_id, type, urgency, chain, title, body, status, last_move, players, substrates, score_impact, source, source_url, event_date, details')
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (chain && chain !== 'all') query = query.eq('chain', chain);
  if (urgency && urgency !== 'all') query = query.eq('urgency', urgency);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ events: data || [], total: data?.length || 0 });
};
