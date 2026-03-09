const { supabaseAdmin } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  const { data, error } = await supabaseAdmin
    .from('pli_scores')
    .select('substrate, chain, score, band, score_delta, snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });

  // Return latest snapshot per substrate
  const seen = new Set();
  const latest = (data || []).filter(r => {
    if (seen.has(r.substrate)) return false;
    seen.add(r.substrate);
    return true;
  });

  return res.status(200).json({ scores: latest });
};
