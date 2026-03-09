# PLI™ Monitor — Deploy Guide 
**ProjetoPack & Associados — Packaging Lobby Intelligence** 

> Monitoramento semanal automatizado de atividade regulatória nas cadeias de embalagem brasileiras.

---

## Stack

| Camada | Tecnologia | Custo |
|--------|-----------|-------|
| Frontend + API Routes | Next.js → Vercel | Gratuito |
| Banco de dados | Supabase (PostgreSQL) | Gratuito até 500MB |
| Autenticação | Supabase Auth | Gratuito |
| Cron semanal | Vercel Cron | Gratuito (hobby plan) |
| Classificação IA | Claude API (Anthropic) | ~R$80/mês |
| Cobertura de imprensa | NewsAPI (opcional) | ~R$280/mês |
| **Total** | | **~R$360/mês** |

---

## Deploy em 5 passos

### 1. Supabase — criar projeto

1. Acesse [supabase.com](https://supabase.com) → New Project
2. No SQL Editor, cole e execute o conteúdo de `supabase/schema.sql`
3. Anote: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`

### 2. Variáveis de ambiente no Vercel

```bash
# No dashboard Vercel → Settings → Environment Variables:
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
CRON_SECRET=gere_uma_string_aleatoria_aqui
```

### 3. Deploy no Vercel

```bash
npm install -g vercel
vercel --prod
```

O `vercel.json` já configura o cron para **toda segunda-feira às 06:00 BRT** (09:00 UTC).

### 4. Testar o pipeline manualmente

```bash
# Dispara o cron uma vez para popular o banco
curl -X GET https://seu-dominio.vercel.app/api/cron/weekly-digest \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```

### 5. Criar primeiro assinante (você)

No Supabase → Authentication → Users → Invite user, depois:

```sql
INSERT INTO subscribers (id, email, name, company, tier, tier_name, active)
VALUES (
  'uuid-do-usuario-criado',
  'aislan@projetopack.com.br',
  'Aislan',
  'ProjetoPack & Associados',
  3,        -- Tier 3 = Corporativo
  'CORPORATIVO',
  true
);
```

---

## Tiers de acesso

| Tier | Preço | Feed | Detalhes | PLI Flash | API |
|------|-------|------|----------|-----------|-----|
| 0 — Demo | Gratuito | 3 eventos | ✗ | ✗ | ✗ |
| 1 — Essencial | R$2.490/ano | Feed completo | ✗ | ✗ | ✗ |
| 2 — Estratégico | R$6.900/ano | Feed completo | ✓ | ✓ email | ✗ |
| 3 — Corporativo | R$18.000/ano | Feed completo | ✓ | ✓ email | ✓ |

---

## Fontes de dados (APIs públicas, sem autenticação)

| Fonte | Endpoint | O que captura |
|-------|----------|---------------|
| API Câmara | `dadosabertos.camara.leg.br/api/v2/proposicoes` | PLs, votações, audiências |
| API Senado | `legis.senado.leg.br/dadosabertos/materia/pesquisa-basica` | Matérias, pareceres |
| Querido Diário | `queridodiario.org/api/gazettes` | DOU: portarias, INs, RDCs |
| NewsAPI *(opcional)* | `newsapi.org/v2/everything` | Cobertura de imprensa |

---

## Limitação conhecida (documentar para clientes)

O Brasil não possui lei de lobby com declaração obrigatória de gastos (o PL 1202/2007 tramita há 18 anos). O PLI™ Monitor rastreia **atividade regulatória e legislativa** — não gastos de lobby declarados como no EU Transparency Register.

Isso captura o que importa ao convertedor: quando um PL avança, quando uma consulta abre, quando uma agência publica uma normativa. Os gastos de lobby são estimados via cobertura de imprensa e declarações setoriais.

---

## Roadmap

| Fase | Timeline | Entregável |
|------|----------|-----------|
| ✅ Demo | Agora | React app com dados simulados |
| 🔜 MVP | Q2/2026 | Pipeline real + Supabase + 5 clientes âncora |
| 🔜 SaaS | Q3/2026 | Auth, tiers, pagamento (Stripe), PLI Flash email |
| 🔜 EU | Q4/2026 | EU Transparency Register API + roadmap cross-border |
| 🔜 API | Q1/2027 | REST API para Tier 3 + webhook de alertas |

---

*PLI™ — Packaging Lobby Intelligence · ProjetoPack & Associados*
