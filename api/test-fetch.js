const { fetchAllSources, getLastWeekISO } = require('../lib/fetchers');
module.exports = async function handler(req, res) {
  if (req.query.secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  const since = getLastWeekISO();
  try {
    const results = await fetchAllSources(since);
    return res.status(200).json({ ok: true, since, total: results.length, sample: results.slice(0, 5).map(r => ({ external_id: r.external_id, source: r.source, preview: r.raw.slice(0, 200) })) });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

