// lib/fetchers.js — ES Module
const CAMARA_BASE  = 'https://dadosabertos.camara.leg.br/api/v2';
const SENADO_BASE  = 'https://legis.senado.leg.br/dadosabertos';
const QUERIDO_BASE = 'https://queridodiario.org/api/gazettes';

const KEYWORDS = [
  'embalagem', 'plástico', 'celulose', 'reciclagem', 'logística reversa',
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export function getLastWeekISO() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

async function fetchCamaraProposicoes(since) {
  const results = [];
  for (const kw of KEYWORDS) {
    try {
      const url = new URL(`${CAMARA_BASE}/proposicoes`);
      url.searchParams.set('keywords', kw);
      url.searchParams.set('dataApresentacaoInicio', since);
      url.searchParams.set('ordenarPor', 'dataApresentacao');
      url.searchParams.set('ordem', 'DESC');
      url.searchParams.set('itens', '10');
      const res = await fetch(url.toString());
      if (!res.ok) continue;
      const data = await res.json();
      for (const prop of (data.dados || [])) {
        results.push({
          external_id: `camara-${prop.id}`,
          source: 'dadosabertos.camara.leg.br',
          source_url: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${prop.id}`,
          raw: `${prop.siglaTipo} ${prop.numero}/${prop.ano} — ${prop.ementa}`,
        });
      }
      await sleep(400);
    } catch (e) { console.error(`[camara] ${kw}:`, e.message); }
  }
  return results;
}

async function fetchSenadoMaterias(since) {
  const results = [];
  for (const kw of ['embalagem', 'plástico', 'reciclagem']) {
    try {
      const url = `${SENADO_BASE}/materia/pesquisa-basica?palavraChave=${encodeURIComponent(kw)}&dataInicio=${since}&situacao=tramitando`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const data = await res.json();
      const materias = data?.PesquisaBasicaMateria?.Materias?.Materia || [];
      const list = Array.isArray(materias) ? materias : [materias];
      for (const m of list) {
        if (!m.CodigoMateria) continue;
        results.push({
          external_id: `senado-${m.CodigoMateria}`,
          source: 'legis.senado.leg.br',
          source_url: `https://www25.senado.leg.br/web/atividade/materias/-/materia/${m.CodigoMateria}`,
          raw: `${m.SiglaTipoMateria} ${m.NumeroMateria}/${m.AnoMateria}\n${m.EmentaMateria}\nSituação: ${m.SituacaoAtual || ''}`,
        });
      }
      await sleep(500);
    } catch (e) { console.error(`[senado] ${kw}:`, e.message); }
  }
  return results;
}

async function fetchDOU(since) {
  const results = [];
  const queries = ['embalagem plástico', 'logística reversa embalagem'];
  for (const q of queries) {
    try {
      const url = new URL(QUERIDO_BASE);
      url.searchParams.set('querystring', q);
      url.searchParams.set('since', since);
      url.searchParams.set('until', new Date().toISOString().split('T')[0]);
      url.searchParams.set('size', '5');
      url.searchParams.set('offset', '0');
      const res = await fetch(url.toString());
      if (!res.ok) continue;
      const data = await res.json();
      for (const g of (data.gazettes || [])) {
        for (const excerpt of (g.excerpts || []).slice(0, 2)) {
          const hash = Buffer.from(excerpt.slice(0, 20)).toString('hex').slice(0, 8);
          results.push({
            external_id: `dou-${g.date}-${hash}`,
            source: 'Diário Oficial da União',
            source_url: g.url,
            raw: `DOU ${g.date}\n\n${excerpt}`,
          });
        }
      }
      await sleep(400);
    } catch (e) { console.error(`[dou] ${q}:`, e.message); }
  }
  return results;
}

export async function fetchAllSources(since) {
  console.log(`[fetchers] Fetching since ${since}...`);
  const [camara, senado, dou] = await Promise.allSettled([
    fetchCamaraProposicoes(since),
    fetchSenadoMaterias(since),
    fetchDOU(since),
  ]);
  return [
    ...(camara.value || []),
    ...(senado.value || []),
    ...(dou.value || []),
  ];
}
