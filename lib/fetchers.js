// lib/fetchers.js
// Fetches regulatory data from Brazilian public APIs
// ─────────────────────────────────────────────────────────────────────────────
// All APIs used here are free and require no authentication.
// Documentation:
//   Câmara:  https://dadosabertos.camara.leg.br/swagger/api.html
//   Senado:  https://legis.senado.leg.br/dadosabertos/docs
//   DOU:     https://queridodiario.org/api (Querido Diário - OKBR)

const CAMARA_BASE  = 'https://dadosabertos.camara.leg.br/api/v2';
const SENADO_BASE  = 'https://legis.senado.leg.br/dadosabertos';
const QUERIDO_BASE = 'https://queridodiario.org/api/gazettes';

// Keywords relevant to packaging supply chains
const KEYWORDS = [
  'embalagem', 'plástico', 'celulose', 'papel cartão',
  'reciclagem', 'logística reversa', 'PFAS', 'EPS poliestireno',
  'descartável', 'PCR reciclado', 'PNRS',
];

// ── Câmara ────────────────────────────────────────────────────────────────────
async function fetchCamaraProposicoes(since) {
  const results = [];
  for (const kw of KEYWORDS.slice(0, 5)) { // rate-limit: first 5 keywords
    try {
      const url = new URL(`${CAMARA_BASE}/proposicoes`);
      url.searchParams.set('keywords', kw);
      url.searchParams.set('dataApresentacaoInicio', since);
      url.searchParams.set('ordenarPor', 'dataApresentacao');
      url.searchParams.set('ordem', 'DESC');
      url.searchParams.set('itens', '20');

      const res = await fetch(url.toString());
      if (!res.ok) continue;
      const data = await res.json();

      for (const prop of (data.dados || [])) {
        // Get full detail
        const detail = await fetchCamaraProposicaoDetail(prop.id);
        if (detail) results.push({
          external_id: `camara-${prop.id}`,
          source: 'dadosabertos.camara.leg.br',
          source_url: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${prop.id}`,
          raw: `${prop.siglaTipo} ${prop.numero}/${prop.ano} — ${prop.ementa}\n\n${detail.situacao || ''}\n\n${detail.keywords || ''}`,
        });
        await sleep(300); // respect rate limits
      }
    } catch (err) {
      console.error(`[fetchCamara] keyword="${kw}" error:`, err.message);
    }
  }
  return results;
}

async function fetchCamaraProposicaoDetail(id) {
  try {
    const res = await fetch(`${CAMARA_BASE}/proposicoes/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.dados;
  } catch {
    return null;
  }
}

// Also fetch recent committee events (votações, audiências)
async function fetchCamaraEventos(since) {
  const results = [];
  try {
    const url = new URL(`${CAMARA_BASE}/eventos`);
    url.searchParams.set('dataInicio', since);
    url.searchParams.set('orgaoId', '2013'); // Comissão de Meio Ambiente
    url.searchParams.set('itens', '30');

    const res = await fetch(url.toString());
    if (!res.ok) return results;
    const data = await res.json();

    for (const ev of (data.dados || [])) {
      results.push({
        external_id: `camara-ev-${ev.id}`,
        source: 'dadosabertos.camara.leg.br/eventos',
        source_url: ev.uri,
        raw: `${ev.descricaoTipo}: ${ev.descricao || ''}\nOrgão: ${ev.orgaos?.map(o => o.nome).join(', ') || ''}\nData: ${ev.dataHoraInicio}`,
      });
    }
  } catch (err) {
    console.error('[fetchCamaraEventos] error:', err.message);
  }
  return results;
}

// ── Senado ────────────────────────────────────────────────────────────────────
async function fetchSenadoMaterias(since) {
  const results = [];
  for (const kw of ['embalagem', 'plástico', 'reciclagem']) {
    try {
      const url = `${SENADO_BASE}/materia/pesquisa-basica?palavraChave=${encodeURIComponent(kw)}&dataInicio=${since}&situacao=tramitando`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) continue;
      const data = await res.json();
      const materias = data?.PesquisaBasicaMateria?.Materias?.Materia || [];

      for (const m of (Array.isArray(materias) ? materias : [materias])) {
        results.push({
          external_id: `senado-${m.CodigoMateria}`,
          source: 'legis.senado.leg.br',
          source_url: `https://www25.senado.leg.br/web/atividade/materias/-/materia/${m.CodigoMateria}`,
          raw: `${m.SiglaTipoMateria} ${m.NumeroMateria}/${m.AnoMateria}\n${m.EmentaMateria}\nSituação: ${m.SituacaoAtual || ''}`,
        });
      }
      await sleep(500);
    } catch (err) {
      console.error(`[fetchSenado] keyword="${kw}" error:`, err.message);
    }
  }
  return results;
}

// ── Querido Diário (DOU scraper by OKBR) ─────────────────────────────────────
async function fetchDOU(since) {
  const results = [];
  const queries = ['embalagem plástico', 'logística reversa embalagem', 'PFAS embalagem'];

  for (const q of queries) {
    try {
      const url = new URL(QUERIDO_BASE);
      url.searchParams.set('querystring', q);
      url.searchParams.set('since', since);
      url.searchParams.set('until', new Date().toISOString().split('T')[0]);
      url.searchParams.set('territory_id', ''); // federal
      url.searchParams.set('size', '10');
      url.searchParams.set('offset', '0');

      const res = await fetch(url.toString());
      if (!res.ok) continue;
      const data = await res.json();

      for (const gazette of (data.gazettes || [])) {
        for (const excerpt of (gazette.excerpts || []).slice(0, 2)) {
          results.push({
            external_id: `dou-${gazette.date}-${Buffer.from(excerpt.slice(0, 30)).toString('hex').slice(0, 12)}`,
            source: 'Diário Oficial da União (Querido Diário)',
            source_url: gazette.url,
            raw: `DOU ${gazette.date} — Seção ${gazette.edition_number || ''}\n\n${excerpt}`,
          });
        }
      }
      await sleep(400);
    } catch (err) {
      console.error(`[fetchDOU] query="${q}" error:`, err.message);
    }
  }
  return results;
}

// ── Utility ───────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getLastWeekISO() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

async function fetchAllSources(since) {
  console.log(`[fetchers] Fetching since ${since}...`);
  const [camara, eventos, senado, dou] = await Promise.allSettled([
    fetchCamaraProposicoes(since),
    fetchCamaraEventos(since),
    fetchSenadoMaterias(since),
    fetchDOU(since),
  ]);

  return [
    ...(camara.value || []),
    ...(eventos.value || []),
    ...(senado.value || []),
    ...(dou.value || []),
  ];
}

module.exports = { fetchAllSources, getLastWeekISO };
