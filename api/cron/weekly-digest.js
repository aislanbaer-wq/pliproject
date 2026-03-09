
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
