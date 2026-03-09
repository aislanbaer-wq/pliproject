// lib/classifyEvent.js
// Uses Claude API to classify and enrich raw regulatory data
// ─────────────────────────────────────────────────────────────────────────────
// Called by the weekly cron after fetching raw data from Câmara / Senado / DOU
// Returns structured event object ready for Supabase insert

const SUBSTRATES = [
  'PFAS food contact', 'Filmes multicamada', 'EPS', 'PVC embalagem',
  'PE filme mono', 'Papel/cartão FSC', 'PET garrafa', 'OPP mono',
  'Papelão ondulado', 'Bio-based PE',
];

const PLAYERS_BR = [
  'ABIQUIM', 'ABIPLAST', 'Braskem', 'PLASTIVIDA', 'CRBr', 'CEMPRE',
  'Ibá', 'ABTCP', 'ABRE', 'Suzano', 'Klabin', 'CMPC', 'PETCO',
  'ANVISA', 'MMA', 'MAPA', 'CADE', 'Greenpeace Brasil', 'WWF Brasil',
  'Instituto Akatu', 'Observatório do Clima',
];

const SYSTEM_PROMPT = `Você é o analista de inteligência regulatória do PLI™ (Packaging Lobby Intelligence), 
da ProjetoPack & Associados.

Sua função: dado um texto bruto de uma proposição legislativa, decreto, ato normativo ou 
notícia regulatória brasileira, extrair e estruturar as informações relevantes para o 
setor de embalagem, gráficas e convertedores.

SUBSTRATOS DO PLI™: ${SUBSTRATES.join(', ')}

PLAYERS CONHECIDOS: ${PLAYERS_BR.join(', ')}

Responda APENAS em JSON válido, sem markdown, sem explicação fora do JSON.`;

const USER_PROMPT_TEMPLATE = (rawText) => `
Analise este conteúdo regulatório e retorne um JSON com a estrutura abaixo.
Se algum campo não for aplicável, use null ou array vazio.

CONTEÚDO:
${rawText.slice(0, 4000)}

ESTRUTURA DE RESPOSTA:
{
  "is_relevant": true,
  "type": "PL|DECRETO|RDC|CONSULTA|IN|REQUERIMENTO|NOTICIA",
  "urgency": "CRÍTICO|MONITORAMENTO|VIGILÂNCIA|EM VIGOR|BAIXO",
  "chain": "plastic|paper|recycl|cross",
  "title": "Título conciso (máx 100 chars)",
  "body": "Órgão responsável",
  "status": "Status atual em uma frase",
  "last_move": "Último movimento registrado em uma frase",
  "details": "Resumo técnico para gráficas e convertedores (máx 300 chars)",
  "players": ["array de players do setor de embalagem envolvidos"],
  "substrates": ["array dos substratos PLI™ afetados, somente os listados acima"],
  "score_impact": 0,
  "reasoning": "Explicação do score_impact em 1 frase"
}

REGRAS para score_impact (inteiro -10 a +10):
- Positivo = aumenta pressão regulatória (vai piorar score)
- CRÍTICO confirmado = +5 a +8
- MONITORAMENTO pipeline = +2 a +4
- Vitória do lobby (adiamento/revogação) = -3 a -6
- Sem impacto claro = 0
`;

async function classifyEvent(rawText) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: USER_PROMPT_TEMPLATE(rawText) }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';

    // Strip any accidental markdown fences
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    if (!parsed.is_relevant) return null;
    return parsed;
  } catch (err) {
    console.error('[classifyEvent] Error:', err.message);
    return null;
  }
}

module.exports = { classifyEvent };
