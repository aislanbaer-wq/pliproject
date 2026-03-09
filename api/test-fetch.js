// api/test-fetch.js
// Endpoint de teste manual — chama as APIs públicas e retorna o que encontrou
// GET /api/test-fetch?secret=pli2026monitor
// Não grava no banco, só mostra o que as APIs retornam

import { fetchAllSources, getLastWeekISO } from '../lib/fetchers.js';

export default async function handler(req, res) {
  if (req.query.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const d = new Date();
d.setDate(d.getDate() - 30);
const since = d.toISOString().split('T')[0];
  try {
    const results = await fetchAllSources(since);
    return res.status(200).json({
      ok: true,
      since,
      total: results.length,
      sample: results.slice(0, 5).map(r => ({
        external_id: r.external_id,
        source: r.source,
        preview: r.raw.slice(0, 200),
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
