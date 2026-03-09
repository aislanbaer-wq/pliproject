const SUBSTRATES = ['PFAS food contact','Filmes multicamada','EPS','PVC embalagem','PE filme mono','Papel/cartão FSC','PET garrafa','OPP mono','Papelão ondulado','Bio-based PE'];
const SYSTEM_PROMPT = `Você é o analista de inteligência regulatória do PLI™ da ProjetoPack & Associados. Dado um texto bruto de proposição legislativa, decreto ou ato normativo brasileiro, extraia informações relevantes para o setor de embalagem. SUBSTRATOS PLI™: ${SUBSTRATES.join(', ')}. Responda APENAS em JSON válido, sem markdown.`;

async function classifyEvent(rawText) {
  console.log('[classifyEvent] iniciando para:', rawText.slice(0, 80));
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: `Analise e retorne JSON:\n${rawText.slice(0,1500)}\n\n{"is_relevant":true,"type":"PL","urgency":"CRÍTICO","chain":"plastic","title":"","body":"","status":"","last_move":"","details":"","players":[],"substrates":[],"score_impact":0}` }] })
    });
    const data = await res.json();
    console.log('[classifyEvent] resposta status:', res.status, 'content:', JSON.stringify(data).slice(0, 200));
    const text = data.content?.[0]?.text || '{}';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    return parsed.is_relevant ? parsed : null;
  } catch (e) {
    console.error('[classifyEvent] erro:', e.message);
    return null;
  }
}

module.exports = { classifyEvent };
