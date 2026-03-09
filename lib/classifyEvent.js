// lib/classifyEvent.js — ES Module
const SUBSTRATES = [
  'PFAS food contact', 'Filmes multicamada', 'EPS', 'PVC embalagem',
  'PE filme mono', 'Papel/cartão FSC', 'PET garrafa', 'OPP mono',
  'Papelão ondulado', 'Bio-based PE',
];

const SYSTEM_PROMPT = `Você é o analista de inteligência regulatória do PLI™ (Packaging Lobby Intelligence) da ProjetoPack & Associados.
Dado um texto bruto de proposição legislativa, decreto ou ato normativo brasileiro, extraia informações relevantes para o setor de embalagem.
SUBSTRATOS PLI™: ${SUBSTRATES.join(', ')}
Responda APENAS em JSON válido, sem markdown.`;

const USER_PROMPT = (raw) => `Analise e retorne JSON:
${raw.slice(0, 3000)}

{
  "is_relevant": true/false,
  "type": "PL|DECRETO|RDC|CONSULTA|IN|REQUERIMENTO",
  "urgency": "CRÍTICO|MONITORAMENTO|VIGILÂNCIA|EM VIGOR|BAIXO",
  "chain": "plastic|paper|recycl|cross",
  "title": "título conciso",
  "body": "órgão responsável",
  "status": "status atual",
  "last_move": "último movimento",
  "details": "resumo técnico para convertedores (max 300 chars)",
  "players": ["players do setor de embalagem envolvidos"],
  "substrates": ["substratos PLI™ afetados"],
  "score_impact": 0
}
score_impact: positivo=aumenta pressão regulatória (+2 a +8), negativo=vitória do lobby (-2 a -6), neutro=0`;

export async function classifyEvent(rawText) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: USER_PROMPT(rawText) }],
      }),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || '{}';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    return parsed.is_relevant ? parsed : null;
  } catch (e) {
    console.error('[classifyEvent]', e.message);
    return null;
  }
}

    return null;
  }
}

module.exports = { classifyEvent };
