const { classifyEvent } = require('../lib/classifyEvent');

module.exports = async function handler(req, res) {
  if (req.query.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const texto = 'PL 980/2026 — Dispõe sobre a obrigatoriedade de inclusão de alertas nos rótulos e embalagens de alimentos processados sobre os riscos à saúde, especialmente o desenvolvimento de câncer.';

  console.log('[test-claude] chamando classifyEvent...');
  const result = await classifyEvent(texto);
  console.log('[test-claude] resultado:', JSON.stringify(result));

  return res.status(200).json({ result });
};
```

Commit → aguarda deploy → acesse:
```
https://pliproject2.vercel.app/api/test-claude?secret=pli2026monitor
