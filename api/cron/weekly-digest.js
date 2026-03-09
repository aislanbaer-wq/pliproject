const { fetchAllSources, getLastWeekISO } = require('../../lib/fetchers');
const { supabaseAdmin } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && req.query.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const since = getLastWeekISO();

  try {
    const raw = await fetchAllSources(since);

    const { data: existing } = await supabaseAdmin.from('events').select('external_id');
    const existingIds = new Set((existing || []).map(e => e.external_id));

    const toInsert = raw
      .filter(item => !existingIds.has(item.external_id))
      .slice(0, 3)
      .map(item => ({
        external_id: item.external_id,
        type: 'PL',
        urgency: 'MONITORAMENTO',
        chain: 'plastic',
        title: item.raw.slice(0, 100),
        body: item.source,
        status: 'Em tramitação',
        last_move: since,
        details: item.raw.slice(0, 300),
        players: [],
        substrates: [],
        score_impact: 0,
        source: item.source,
        source_url: item.source_url,
        event_date: since,
      }));

    if (toInsert.length > 0) {
      const { error } = await supabaseAdmin.from('events').insert(toInsert);
      if (error) return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true, since, fetched: raw.length, inserted: toInsert.length });
  } catch (err) {
    console.error('[cron]', err);
    return res.status(500).json({ error: err.message });
  }
};
