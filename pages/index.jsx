import { useState, useEffect, useRef } from "react";

// ── Brand constants ────────────────────────────────────────────────────────────
const C = {
  navy: "#0A1F3C", gold: "#C8993A", blue: "#1A56A0", dark: "#0D2540",
  paper: "#2E9E4F", plastic: "#1A78C2", recycl: "#D4900A",
  red: "#C62828", amber: "#D4900A", green: "#2E7D32",
  bg: "#060E1C", surface: "#0A1828", border: "#0D2540",
};

// ── SIMULATED LIVE EVENTS (em produção: fetch API Câmara + Senado + DOU) ───────
// Estes dados replicam exatamente o formato da API da Câmara dos Deputados
// GET https://dadosabertos.camara.leg.br/api/v2/proposicoes?keywords=embalagem+plástico
// GET https://dadosabertos.camara.leg.br/api/v2/eventos?dataInicio=...&orgao=...

const LIVE_EVENTS_SEED = [
  {
    id: "pl-2024-2022", type: "PL", urgency: "CRÍTICO", chain: "plastic",
    score_impact: +4,
    title: "PL 2024/2022 — Ban de Plásticos Descartáveis",
    body: "Câmara dos Deputados",
    status: "Em tramitação — Comissão de Meio Ambiente",
    last_move: "Audiência pública com ABIQUIM e ABIPLAST — jan/2026",
    players: ["ABIQUIM", "ABIPLAST", "Braskem", "Instituto Akatu"],
    substrates: ["EPS", "PVC embalagem", "PE filme mono"],
    date: "2026-01-15",
    source: "dadosabertos.camara.leg.br",
    details: "ABIQUIM argumentou risco de 40 mil demissões diretas. Texto atual prevê ban em 24 meses após sanção. Substitutivo em elaboração pelo relator.",
    vote_status: { favor: 12, contra: 8, ausentes: 5 },
  },
  {
    id: "dec-12688", type: "DECRETO", urgency: "EM VIGOR", chain: "plastic",
    score_impact: 0,
    title: "Decreto 12.688/2025 — EPR Plásticos",
    body: "Presidência da República",
    status: "EM VIGOR desde outubro 2025",
    last_move: "Regulamentação de rastreabilidade digital — consulta pública MMA aberta",
    players: ["MMA", "PLASTIVIDA", "CRBr", "ABIQUIM"],
    substrates: ["PE filme mono", "PET garrafa", "PP rígido"],
    date: "2026-01-08",
    source: "in.gov.br / DOU",
    details: "Meta de 22% conteúdo reciclado e 32% recuperação vigente desde jan/2026. Consulta pública sobre metodologia de rastreabilidade digital encerra em março/2026.",
    vote_status: null,
  },
  {
    id: "pnrs-papel", type: "CONSULTA PÚBLICA", urgency: "MONITORAMENTO", chain: "paper",
    score_impact: +2,
    title: "PNRS — Ampliação Logística Reversa Papel",
    body: "Ministério do Meio Ambiente",
    status: "Consulta pública aberta",
    last_move: "ABRE e Ibá enviaram contribuições — fev/2026",
    players: ["Ibá", "ABRE", "ABTCP", "Klabin", "Suzano"],
    substrates: ["Papelão ondulado", "Papel / cartão FSC"],
    date: "2026-02-03",
    source: "participacao.mma.gov.br",
    details: "Proposta de extensão da logística reversa obrigatória para embalagens de papel e cartão que não sejam capturadas pelo fluxo municipal. Ibá defende modelo coletivo. Prazo de contribuições: 30 abr/2026.",
    vote_status: null,
  },
  {
    id: "anvisa-pfas", type: "RDC", urgency: "CRÍTICO", chain: "plastic",
    score_impact: +6,
    title: "ANVISA — Pré-aviso PFAS em embalagens food contact",
    body: "ANVISA",
    status: "Nota técnica interna vazada — sem publicação oficial",
    last_move: "ABIQUIM solicitou audiência com diretoria ANVISA — fev/2026",
    players: ["ABIQUIM", "ABIA", "ANVISA", "ClientEarth Brasil"],
    substrates: ["PFAS food contact", "Filmes multicamada"],
    date: "2026-02-20",
    source: "ABIQUIM Newsletter (indireto)",
    details: "Nota técnica da ANVISA sobre alinhamento com ban EU de PFAS em food contact (PPWR ago/2026) está em circulação interna. ABIQUIM pediu prazo de 36 meses para adequação vs. ban imediato. Alta probabilidade de publicação de pré-RDC no semestre.",
    vote_status: null,
  },
  {
    id: "mapa-eudr", type: "INSTRUÇÃO NORMATIVA", urgency: "MONITORAMENTO", chain: "paper",
    score_impact: +3,
    title: "MAPA — Protocolo EUDR para exportadores de celulose",
    body: "Ministério da Agricultura",
    status: "Em elaboração",
    last_move: "Grupo de trabalho Ibá + MAPA publicou relatório intermediário",
    players: ["Ibá", "Suzano", "Klabin", "CMPC Brasil"],
    substrates: ["Papel / cartão FSC", "Papelão ondulado"],
    date: "2026-01-28",
    source: "Ibá Circular 12/2026",
    details: "Instrução Normativa do MAPA para padronizar documentação de due diligence de origem florestal exigida pelo EUDR. Exportadores com menos de 2.000 ton/ano podem ter procedimento simplificado — lobby Ibá conseguiu inclusão desta cláusula.",
    vote_status: null,
  },
  {
    id: "cade-reciclagem", type: "ATO DE CONCENTRAÇÃO", urgency: "MONITORAMENTO", chain: "recycl",
    score_impact: +1,
    title: "CADE — Aprovação fusão coletores de PET",
    body: "CADE",
    status: "Aprovado com restrições",
    last_move: "Decisão publicada no DOU 14/fev/2026",
    players: ["PETCO", "Grupo Reciclagem BR", "CRBr"],
    substrates: ["PET garrafa", "PE filme mono"],
    date: "2026-02-14",
    source: "DOU / CADE",
    details: "CADE aprovou fusão de dois grandes operadores de coleta e triagem de PET com desinvestimento obrigatório em 3 estados. Concentração do mercado pode pressionar oferta de PCR no curto prazo.",
    vote_status: null,
  },
  {
    id: "senado-tratado-plastico", type: "REQUERIMENTO", urgency: "VIGILÂNCIA", chain: "plastic",
    score_impact: +2,
    title: "Senado — Requerimento ratificação UN Plastics Treaty",
    body: "Senado Federal",
    status: "Requerimento protocolado — aguarda pauta",
    last_move: "Senadores ambientalistas pediram urgência para debate — mar/2026",
    players: ["ABIPLAST", "Greenpeace Brasil", "WWF Brasil"],
    substrates: ["EPS", "PVC embalagem", "Filmes multicamada"],
    date: "2026-03-01",
    source: "legis.senado.leg.br",
    details: "Requerimento de debate urgente sobre posição do Brasil no UN Global Plastics Treaty. Setor questiona se tratado impõe metas de redução absoluta (posição ABIPLAST: inadmissível) ou de reciclagem (aceitável).",
    vote_status: { favor: 18, contra: 15, ausentes: 9 },
  },
];

// PLI Score baseline por substrato
const PLI_SCORES = [
  { sub: "PFAS food contact", score: 88, band: "CRÍTICA", col: C.red, chain: "plastic" },
  { sub: "Filmes multicamada", score: 79, band: "CRÍTICA", col: C.red, chain: "plastic" },
  { sub: "EPS", score: 76, band: "CRÍTICA", col: C.red, chain: "plastic" },
  { sub: "PVC embalagem", score: 72, band: "CRÍTICA", col: C.red, chain: "plastic" },
  { sub: "PE filme mono", score: 54, band: "MONITORAMENTO", col: C.amber, chain: "plastic" },
  { sub: "Papel/cartão FSC", score: 42, band: "MONITORAMENTO", col: C.amber, chain: "paper" },
  { sub: "PET garrafa", score: 38, band: "ESTÁVEL", col: C.green, chain: "recycl" },
  { sub: "OPP mono", score: 35, band: "ESTÁVEL", col: C.green, chain: "plastic" },
  { sub: "Papelão ondulado", score: 28, band: "ESTÁVEL", col: C.green, chain: "paper" },
  { sub: "Bio-based PE", score: 22, band: "ESTÁVEL", col: C.green, chain: "plastic" },
];

const CHAIN_LABELS = { plastic: "Resinas", paper: "Celulose & Papel", recycl: "Reciclagem" };
const CHAIN_COLORS = { plastic: C.plastic, paper: C.paper, recycl: C.recycl };
const URGENCY_COLORS = {
  "CRÍTICO": C.red, "EM VIGOR": C.green, "MONITORAMENTO": C.amber,
  "VIGILÂNCIA": "#7C4DFF", "CONSULTA PÚBLICA": C.blue,
};

// ── COMPONENTS ────────────────────────────────────────────────────────────────

function LivePulse({ active }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: active ? "#4ADE80" : "#666",
        boxShadow: active ? "0 0 0 3px rgba(74,222,128,0.25)" : "none",
        animation: active ? "pulse 2s infinite" : "none",
        display: "inline-block",
      }} />
      <span style={{ fontSize: 10, color: active ? "#4ADE80" : "#666", fontFamily: "monospace", letterSpacing: 1 }}>
        {active ? "AO VIVO" : "OFFLINE"}
      </span>
    </span>
  );
}

function ScoreBadge({ score, col, size = "md" }) {
  const s = size === "sm" ? { w: 36, h: 28, fs: 13 } : { w: 48, h: 38, fs: 17 };
  return (
    <div style={{
      width: s.w, height: s.h, background: col + "22", border: `1.5px solid ${col}`,
      borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Georgia', serif", fontSize: s.fs, fontWeight: 700, color: col, flexShrink: 0,
    }}>
      {score}
    </div>
  );
}

function UrgencyPill({ urgency }) {
  const col = URGENCY_COLORS[urgency] || C.mid;
  return (
    <span style={{
      background: col + "22", border: `1px solid ${col}`, color: col,
      fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 3,
      letterSpacing: 1, fontFamily: "monospace", whiteSpace: "nowrap",
    }}>
      {urgency}
    </span>
  );
}

function ChainPill({ chain }) {
  const col = CHAIN_COLORS[chain] || "#888";
  const label = CHAIN_LABELS[chain] || chain;
  return (
    <span style={{
      background: col + "18", border: `1px solid ${col}44`, color: col,
      fontSize: 9, padding: "2px 8px", borderRadius: 3, fontFamily: "monospace",
    }}>
      {label}
    </span>
  );
}

function EventCard({ event, onClick, isSelected }) {
  return (
    <div onClick={() => onClick(event)}
      style={{
        background: isSelected ? C.surface : C.bg,
        border: `1px solid ${isSelected ? C.gold : C.border}`,
        borderLeft: `3px solid ${URGENCY_COLORS[event.urgency] || C.blue}`,
        borderRadius: 6, padding: "12px 14px", cursor: "pointer",
        transition: "all 0.18s", marginBottom: 8,
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = C.gold + "66"; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = C.border; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <UrgencyPill urgency={event.urgency} />
          <ChainPill chain={event.chain} />
          <span style={{ fontSize: 9, color: "#555", fontFamily: "monospace", padding: "2px 6px" }}>
            {event.type}
          </span>
        </div>
        {event.score_impact !== 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, fontFamily: "monospace",
            color: event.score_impact > 0 ? C.red : C.green,
          }}>
            {event.score_impact > 0 ? "▲" : "▼"} {Math.abs(event.score_impact)} PLI
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#E0E8F0", lineHeight: 1.4, marginBottom: 4, fontFamily: "'Georgia', serif" }}>
        {event.title}
      </div>
      <div style={{ fontSize: 10, color: "#5A7A9A", marginBottom: 4 }}>
        {event.body}  ·  {event.date}
      </div>
      <div style={{ fontSize: 10, color: "#7A9ABB", fontStyle: "italic", lineHeight: 1.5 }}>
        {event.last_move}
      </div>
    </div>
  );
}

function EventDetail({ event, onClose }) {
  if (!event) return null;
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.gold}55`,
      borderRadius: 8, padding: 20, position: "relative",
    }}>
      <button onClick={onClose} style={{
        position: "absolute", top: 12, right: 14, background: "none",
        border: "none", color: "#7A9ABB", cursor: "pointer", fontSize: 16, padding: 4,
      }}>✕</button>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <UrgencyPill urgency={event.urgency} />
        <ChainPill chain={event.chain} />
        <span style={{ fontSize: 9, color: "#7A9ABB", fontFamily: "monospace", padding: "2px 6px",
          background: "#0A1828", border: "1px solid #1A3050", borderRadius: 3 }}>
          {event.type}
        </span>
      </div>

      <h3 style={{ color: C.gold, fontFamily: "'Georgia', serif", fontSize: 15, margin: "0 0 6px", lineHeight: 1.4 }}>
        {event.title}
      </h3>
      <div style={{ fontSize: 11, color: "#5A7A9A", marginBottom: 14 }}>
        {event.body}  ·  {event.date}  ·  Fonte: {event.source}
      </div>

      <div style={{ fontSize: 12, color: "#B0C4D8", lineHeight: 1.7, marginBottom: 16 }}>
        {event.details}
      </div>

      {/* Substrates affected */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: C.gold, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>
          SUBSTRATOS AFETADOS
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {event.substrates.map(s => {
            const match = (scores || PLI_SCORES).find(p => p.sub === s);
            return (
              <div key={s} style={{
                display: "flex", alignItems: "center", gap: 6,
                background: C.dark, border: `1px solid ${match?.col || "#333"}55`,
                borderRadius: 4, padding: "4px 10px",
              }}>
                {match && <ScoreBadge score={match.score} col={match.col} size="sm" />}
                <span style={{ fontSize: 11, color: "#C0D0E0" }}>{s}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Players */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: C.gold, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>
          PLAYERS ATIVOS NESTE EVENTO
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {event.players.map(p => (
            <span key={p} style={{
              fontSize: 10, color: "#8AABCC", background: "#0A1830",
              border: "1px solid #1A3050", borderRadius: 3, padding: "3px 8px",
            }}>{p}</span>
          ))}
        </div>
      </div>

      {/* Vote status if available */}
      {event.vote_status && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: C.gold, fontFamily: "monospace", letterSpacing: 1, marginBottom: 8 }}>
            PLACAR ATUAL (parlamentares)
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { label: "A FAVOR", val: event.vote_status.favor, col: C.green },
              { label: "CONTRA", val: event.vote_status.contra, col: C.red },
              { label: "AUSENTES", val: event.vote_status.ausentes, col: "#555" },
            ].map(({ label, val, col }) => (
              <div key={label} style={{
                flex: 1, background: C.dark, border: `1px solid ${col}44`,
                borderRadius: 5, padding: "8px 10px", textAlign: "center",
              }}>
                <div style={{ fontSize: 22, fontFamily: "'Georgia', serif", fontWeight: 700, color: col }}>{val}</div>
                <div style={{ fontSize: 9, color: "#5A7A9A", fontFamily: "monospace", letterSpacing: 0.5 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {event.score_impact !== 0 && (
        <div style={{
          marginTop: 12, background: (event.score_impact > 0 ? C.red : C.green) + "15",
          border: `1px solid ${event.score_impact > 0 ? C.red : C.green}44`,
          borderRadius: 5, padding: "8px 12px",
        }}>
          <span style={{ fontSize: 10, color: event.score_impact > 0 ? C.red : C.green, fontFamily: "monospace", fontWeight: 700 }}>
            {event.score_impact > 0 ? "▲" : "▼"} IMPACTO PLI SCORE™:
          </span>
          <span style={{ fontSize: 10, color: "#B0C0D0", marginLeft: 8 }}>
            Este evento pressiona os substratos afetados em +{Math.abs(event.score_impact)} pontos na próxima edição do índice
          </span>
        </div>
      )}
    </div>
  );
}

function ScoreTable({ events, scores }) {
  // Calculate dynamic adjustments from events
  const adjustments = {};
  events.forEach(e => {
    if (e.score_impact !== 0) {
      e.substrates.forEach(sub => {
        const match = (scores || PLI_SCORES).find(p => p.sub === sub);
        if (match) adjustments[sub] = (adjustments[sub] || 0) + e.score_impact * 0.4;
      });
    }
  });

  return (
    <div>
      <div style={{ fontSize: 9, color: C.gold, fontFamily: "monospace", letterSpacing: 1.5, marginBottom: 12 }}>
        PLI SCORE™ — ATUALIZADO COM EVENTOS RECENTES
      </div>
      {(scores || PLI_SCORES).map(({ sub, score, band, col, chain }) => {
        const adj = Math.round(adjustments[sub] || 0);
        const liveScore = Math.min(100, score + adj);
        return (
          <div key={sub} style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 6,
            padding: "7px 10px", background: C.surface, borderRadius: 5,
            border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${col}`,
          }}>
            <ScoreBadge score={liveScore} col={col} size="sm" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "#C0D0E0", fontWeight: 600, marginBottom: 2 }}>{sub}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <ChainPill chain={chain} />
                <span style={{ fontSize: 9, color: col, fontFamily: "monospace" }}>{band}</span>
              </div>
            </div>
            {adj !== 0 && (
              <span style={{ fontSize: 10, color: adj > 0 ? C.red : C.green, fontFamily: "monospace", fontWeight: 700 }}>
                {adj > 0 ? "+" : ""}{adj}
              </span>
            )}
            <div style={{ width: 80, height: 4, background: "#0A1828", borderRadius: 2 }}>
              <div style={{ height: 4, width: `${liveScore}%`, background: col, borderRadius: 2, transition: "width 0.5s" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── API STATUS indicator (shows what would be connected in production) ──────────
function ApiStatus() {
  const apis = [
    { name: "API Câmara Federal", url: "dadosabertos.camara.leg.br", status: "demo", color: C.amber },
    { name: "API Senado Federal", url: "legis.senado.leg.br", status: "demo", color: C.amber },
    { name: "Diário Oficial (DOU)", url: "in.gov.br / Querido Diário", status: "demo", color: C.amber },
    { name: "ANVISA Open Data", url: "consultas.anvisa.gov.br", status: "demo", color: C.amber },
    { name: "Portal Transparência", url: "portaldatransparencia.gov.br", status: "demo", color: C.amber },
  ];
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 9, color: "#5A7A9A", fontFamily: "monospace", letterSpacing: 1, marginBottom: 8 }}>
        FONTES DE DADOS (PRODUÇÃO)
      </div>
      {apis.map(({ name, url, status, color }) => (
        <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "#8AABCC" }}>{name}</div>
            <div style={{ fontSize: 9, color: "#3A5A7A", fontFamily: "monospace" }}>{url}</div>
          </div>
          <span style={{ fontSize: 9, color: color, fontFamily: "monospace" }}>{status.toUpperCase()}</span>
        </div>
      ))}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function PLIMonitor() {
  const [activeTab, setActiveTab] = useState("feed");
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [chainFilter, setChainFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [pliScores, setPliScores] = useState(PLI_SCORES);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [newEventAlert, setNewEventAlert] = useState(false);

  // Map DB band to color
  function bandColor(band) {
    if (band === "CRÍTICA") return C.red;
    if (band === "MONITORAMENTO") return C.amber;
    return C.green;
  }

  // Fetch events and scores from real API
  async function loadData() {
    try {
      const [evRes, scRes] = await Promise.all([
        fetch("/api/events?limit=50"),
        fetch("/api/scores"),
      ]);
      const evData = await evRes.json();
      const scData = await scRes.json();

      if (evData.events && evData.events.length > 0) {
        // Normalize DB format to component format
        const normalized = evData.events.map(e => ({
          id: e.external_id || e.id,
          type: e.type || "PL",
          urgency: e.urgency || "MONITORAMENTO",
          chain: e.chain || "plastic",
          score_impact: e.score_impact || 0,
          title: e.title || "",
          body: e.body || "",
          status: e.status || "",
          last_move: e.last_move || "",
          players: e.players || [],
          substrates: e.substrates || [],
          date: e.event_date || "",
          source: e.source || "",
          source_url: e.source_url || "",
          details: e.details || "",
          vote_status: null,
        }));
        setEvents(normalized);
        setNewEventAlert(true);
        setTimeout(() => setNewEventAlert(false), 4000);
      } else {
        // Fallback to seed if no real data yet
        setEvents(LIVE_EVENTS_SEED);
      }

      if (scData.scores && scData.scores.length > 0) {
        const normalized = scData.scores.map(s => ({
          sub: s.substrate,
          score: s.score,
          band: s.band,
          col: bandColor(s.band),
          chain: s.chain,
        }));
        setPliScores(normalized);
      }

      setLastUpdate(new Date());
    } catch (err) {
      console.error("[PLIMonitor] fetch error:", err);
      setEvents(LIVE_EVENTS_SEED);
    } finally {
      setLoading(false);
    }
  }

 useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!cancelled) await loadData();
    }
    load();
    const interval = setInterval(load, 300000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const filtered = events.filter(e => {
    if (chainFilter !== "all" && e.chain !== chainFilter) return false;
    if (urgencyFilter !== "all" && e.urgency !== urgencyFilter) return false;
    return true;
  });

  const criticalCount = events.filter(e => e.urgency === "CRÍTICO").length;

  const tabs = [
    { id: "feed", label: "FEED REGULATÓRIO" },
    { id: "scores", label: "PLI SCORE™ AO VIVO" },
    { id: "architecture", label: "ARQUITETURA" },
  ];

  return (
    <div style={{
      background: C.bg, minHeight: "100vh", color: "#E0E8F0",
      fontFamily: "'Gill Sans', 'Gill Sans MT', Calibri, sans-serif",
      padding: 0,
    }}>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; box-shadow:0 0 0 3px rgba(74,222,128,0.25); }
          50% { opacity:0.7; box-shadow:0 0 0 6px rgba(74,222,128,0.1); } }
        @keyframes slideIn { from { transform:translateY(-20px); opacity:0; }
          to { transform:translateY(0); opacity:1; } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:#060E1C; }
        ::-webkit-scrollbar-thumb { background:#1A3050; border-radius:2px; }
      `}</style>

      {/* Header */}
      <div style={{
        background: C.navy, borderBottom: `1px solid ${C.gold}55`,
        padding: "0 24px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 0" }}>
            <div>
              <div style={{ fontSize: 9, color: C.gold, fontFamily: "monospace", letterSpacing: 2, marginBottom: 3 }}>
                PROJETOPAC K  INTELLIGENCE
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 24, fontFamily: "'Georgia', serif", fontWeight: 700, color: "#fff" }}>PLI™</span>
                <span style={{ fontSize: 14, color: C.gold }}>Monitor Brasil</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ marginBottom: 4 }}><LivePulse active={true} /></div>
              <div style={{ fontSize: 9, color: "#3A5A7A", fontFamily: "monospace" }}>
                Última atualização: {lastUpdate.toLocaleTimeString("pt-BR")}
              </div>
            </div>
          </div>

          {/* Critical alert bar */}
          {criticalCount > 0 && (
            <div style={{
              background: C.red + "18", border: `1px solid ${C.red}44`,
              borderRadius: 4, padding: "6px 12px", margin: "10px 0",
              display: "flex", alignItems: "center", gap: 8,
              animation: "fadeIn 0.3s ease",
            }}>
              <span style={{ color: C.red, fontSize: 12 }}>⚠</span>
              <span style={{ fontSize: 11, color: "#FFAAAA", fontFamily: "monospace" }}>
                {criticalCount} EVENTO{criticalCount > 1 ? "S" : ""} CRÍTICO{criticalCount > 1 ? "S" : ""} REQUER{criticalCount > 1 ? "EM" : ""} ATENÇÃO IMEDIATA
              </span>
            </div>
          )}

          {/* New event toast */}
          {newEventAlert && (
            <div style={{
              background: C.blue + "22", border: `1px solid ${C.blue}66`,
              borderRadius: 4, padding: "6px 12px", margin: "4px 0",
              display: "flex", alignItems: "center", gap: 8,
              animation: "slideIn 0.3s ease",
            }}>
              <span style={{ color: C.blue, fontSize: 11 }}>◉</span>
              <span style={{ fontSize: 11, color: "#AACCEE", fontFamily: "monospace" }}>
                NOVO EVENTO DETECTADO — API Câmara · Atualizado agora
              </span>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, marginTop: 10 }}>
            {tabs.map(({ id, label }) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "8px 16px", fontSize: 10, fontFamily: "monospace",
                letterSpacing: 1, fontWeight: 700,
                color: activeTab === id ? C.gold : "#5A7A9A",
                borderBottom: activeTab === id ? `2px solid ${C.gold}` : "2px solid transparent",
                transition: "all 0.15s",
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px" }}>

        {/* ── FEED TAB ── */}
        {activeTab === "feed" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 20, alignItems: "start" }}>
            {/* Left: filters + list */}
            <div>
              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                {[
                  { v: events.length, l: "Eventos monitorados", c: C.blue },
                  { v: criticalCount, l: "Críticos ativos", c: C.red },
                  { v: events.reduce((acc, e) => acc + Math.abs(e.score_impact), 0), l: "Pressão PLI acumulada", c: C.amber },
                ].map(({ v, l, c }) => (
                  <div key={l} style={{ background: C.dark, border: `1px solid ${c}33`, borderRadius: 6, padding: "10px 12px" }}>
                    <div style={{ fontSize: 24, fontFamily: "'Georgia', serif", fontWeight: 700, color: c }}>{v}</div>
                    <div style={{ fontSize: 9, color: "#5A7A9A", marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                {["all", "plastic", "paper", "recycl"].map(f => (
                  <button key={f} onClick={() => setChainFilter(f)} style={{
                    background: chainFilter === f ? (CHAIN_COLORS[f] || C.blue) + "33" : C.surface,
                    border: `1px solid ${chainFilter === f ? (CHAIN_COLORS[f] || C.blue) : C.border}`,
                    color: chainFilter === f ? (CHAIN_COLORS[f] || C.gold) : "#7A9ABB",
                    padding: "4px 10px", borderRadius: 4, cursor: "pointer",
                    fontSize: 9, fontFamily: "monospace", letterSpacing: 0.5,
                  }}>
                    {f === "all" ? "TODAS" : CHAIN_LABELS[f]?.toUpperCase()}
                  </button>
                ))}
                <div style={{ borderLeft: `1px solid ${C.border}`, margin: "0 4px" }} />
                {["all", "CRÍTICO", "MONITORAMENTO"].map(f => (
                  <button key={f} onClick={() => setUrgencyFilter(f)} style={{
                    background: urgencyFilter === f ? (URGENCY_COLORS[f] || C.blue) + "22" : C.surface,
                    border: `1px solid ${urgencyFilter === f ? (URGENCY_COLORS[f] || C.blue) : C.border}`,
                    color: urgencyFilter === f ? (URGENCY_COLORS[f] || C.gold) : "#7A9ABB",
                    padding: "4px 10px", borderRadius: 4, cursor: "pointer",
                    fontSize: 9, fontFamily: "monospace",
                  }}>
                    {f === "all" ? "TODOS" : f}
                  </button>
                ))}
              </div>

              {/* Event list */}
              <div>
                {filtered.map(e => (
                  <EventCard key={e.id} event={e} onClick={setSelectedEvent} isSelected={selectedEvent?.id === e.id} />
                ))}
                {filtered.length === 0 && (
                  <div style={{ color: "#3A5A7A", textAlign: "center", padding: 40, fontSize: 12 }}>
                    Nenhum evento com estes filtros
                  </div>
                )}
              </div>
            </div>

            {/* Right: detail panel */}
            <div style={{ position: "sticky", top: 20 }}>
              {selectedEvent ? (
                <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
              ) : (
                <div style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: 32, textAlign: "center",
                }}>
                  <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>◎</div>
                  <div style={{ color: "#3A5A7A", fontSize: 12 }}>Selecione um evento para ver detalhes, players envolvidos e impacto no PLI Score™</div>
                </div>
              )}
              <ApiStatus />
            </div>
          </div>
        )}

        {/* ── SCORES TAB ── */}
        {activeTab === "scores" && (
          <div style={{ maxWidth: 700 }}>
            <div style={{ background: C.dark, border: `1px solid ${C.gold}33`, borderRadius: 6, padding: "10px 14px", marginBottom: 16, fontSize: 11, color: "#8AABCC" }}>
              Os scores abaixo refletem o PLI Score™ base (edição inaugural) ajustado pelos eventos regulatórios detectados. Em produção, ajuste é calculado automaticamente via D1–D5 a cada nova regulação capturada.
            </div>
            <ScoreTable events={events} scores={pliScores} />
          </div>
        )}

        {/* ── ARCHITECTURE TAB ── */}
        {activeTab === "architecture" && (
          <div style={{ maxWidth: 800 }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 9, color: C.gold, fontFamily: "monospace", letterSpacing: 1.5, marginBottom: 8 }}>
                ARQUITETURA RECOMENDADA — PLI™ MONITOR PRODUÇÃO
              </div>
              <div style={{ color: "#8AABCC", fontSize: 12, lineHeight: 1.8, marginBottom: 16 }}>
                Esta demo usa dados simulados que replicam exatamente o formato das APIs públicas brasileiras.
                Para colocar em produção, a arquitetura abaixo tem custo próximo de zero e pode ser operada
                pelo time ProjetoPack sem infraestrutura própria.
              </div>
            </div>

            {[
              {
                tier: "CAMADA 1 — COLETA DE DADOS", color: C.blue,
                items: [
                  ["API Câmara (gratuita)", "dadosabertos.camara.leg.br/api/v2/proposicoes?keywords=embalagem,plástico,celulose", "Proposições, votações, eventos de comissão — atualização diária"],
                  ["API Senado (gratuita)", "legis.senado.leg.br/dadosabertos/materia/pesquisa-basica", "Matérias, comissões, pareceres — atualização diária"],
                  ["Querido Diário (gratuita)", "queridodiario.org / API DOU", "Diário Oficial: regulamentações, portarias, ANS, ANVISA, MMA"],
                  ["NewsAPI / GDELT", "API paga ($49/mês) ou GDELT gratuito", "Cobertura de imprensa sobre lobby e regulação de embalagem"],
                ]
              },
              {
                tier: "CAMADA 2 — PROCESSAMENTO", color: C.paper,
                items: [
                  ["Vercel Cron Jobs (gratuito)", "vercel.com/docs/cron-jobs", "Dispara coleta diária, armazena em Supabase, deduplica eventos"],
                  ["Supabase (gratuito até 500MB)", "supabase.com", "Banco PostgreSQL: eventos, scores históricos, players, substratos"],
                  ["Claude API (US$15/mês est.)", "claude-sonnet-4-5", "Classifica relevância, extrai players, calcula impacto PLI Score™"],
                ]
              },
              {
                tier: "CAMADA 3 — FRONTEND + ENTREGA", color: C.gold,
                items: [
                  ["Vercel (gratuito)", "vercel.com", "Deploy automático do React app, CDN global, SSL"],
                  ["Autenticação por tier", "Clerk.dev ou Supabase Auth", "Tier 1 = feed basic; Tier 2 = scores + flash; Tier 3 = API access"],
                  ["PLI Flash automático", "PDF gerado por webhook", "Quando score muda >5 pontos, gera PLI Flash PDF e envia por email"],
                ]
              },
            ].map(({ tier, color, items }) => (
              <div key={tier} style={{ marginBottom: 20 }}>
                <div style={{
                  background: color + "22", border: `1px solid ${color}55`,
                  borderRadius: "6px 6px 0 0", padding: "8px 14px",
                  fontSize: 10, fontFamily: "monospace", letterSpacing: 1, color: color, fontWeight: 700,
                }}>
                  {tier}
                </div>
                {items.map(([name, endpoint, desc]) => (
                  <div key={name} style={{
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderTop: "none", padding: "10px 14px",
                    display: "grid", gridTemplateColumns: "180px 1fr",
                    gap: 12, alignItems: "start",
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#D0E0F0", fontWeight: 600, marginBottom: 2 }}>{name}</div>
                      <div style={{ fontSize: 9, color: "#3A5A7A", fontFamily: "monospace", wordBreak: "break-all" }}>{endpoint}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#7A9ABB", lineHeight: 1.6 }}>{desc}</div>
                  </div>
                ))}
              </div>
            ))}

            <div style={{
              background: C.dark, border: `1px solid ${C.gold}44`,
              borderRadius: 6, padding: "12px 16px", marginTop: 16,
            }}>
              <div style={{ fontSize: 10, color: C.gold, fontFamily: "monospace", letterSpacing: 1, marginBottom: 8 }}>
                CUSTO ESTIMADO DE OPERAÇÃO / MÊS
              </div>
              {[
                ["Vercel + Supabase + Clerk (tiers gratuitos)", "R$ 0"],
                ["Claude API (classificação diária de ~50 eventos)", "~R$ 80"],
                ["NewsAPI para cobertura de imprensa", "~R$ 280"],
                ["Domínio + SSL (incluso Vercel)", "R$ 0"],
                ["TOTAL infraestrutura", "~R$ 360/mês"],
              ].map(([item, val]) => (
                <div key={item} style={{
                  display: "flex", justifyContent: "space-between",
                  borderBottom: `1px solid ${C.border}`,
                  padding: "5px 0", fontSize: 11,
                  color: item.includes("TOTAL") ? C.gold : "#8AABCC",
                  fontWeight: item.includes("TOTAL") ? 700 : 400,
                }}>
                  <span>{item}</span>
                  <span style={{ fontFamily: "monospace" }}>{val}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, background: C.navy + "88", border: `1px solid ${C.blue}44`, borderRadius: 6, padding: "12px 16px" }}>
              <div style={{ fontSize: 10, color: C.blue, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>
                LIMITAÇÃO HONESTA — BRASIL VS. EU
              </div>
              <div style={{ fontSize: 11, color: "#8AABCC", lineHeight: 1.8 }}>
                O Brasil não tem lobby declarado obrigatório (a Lei do Lobby tramita há 18 anos sem aprovação).
                O PLI™ Monitor Brasil rastreia <strong style={{color:"#D0E0F0"}}>atividade regulatória e legislativa</strong> sobre embalagem
                — não gastos de lobby declarados como no EU Transparency Register.
                Na prática, isso captura o que importa ao convertedor: quando um PL avança,
                quando uma consulta pública se abre, quando uma agência publica uma IN.
                Os gastos de lobby são estimados via cobertura de imprensa e declarações setoriais.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
