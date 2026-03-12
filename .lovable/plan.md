

# Plan: Conectar P&L ao Banco de Dados PostgreSQL Externo

## Resumo

Habilitar Lovable Cloud, armazenar as credenciais do banco como secrets, criar uma edge function para explorar e consumir os dados do banco `dre_analytics`, e atualizar o frontend para buscar dados reais do DRE.

## Etapas

### 1. Habilitar Lovable Cloud (Supabase)
Necessário para criar edge functions que acessam o banco externo.

### 2. Armazenar credenciais como secrets
As seguintes variáveis serão armazenadas de forma segura (nunca no código):
- `DRE_DB_HOST` → `5.78.97.125`
- `DRE_DB_PORT` → `5432`
- `DRE_DB_NAME` → `dre_analytics`
- `DRE_DB_USER` → `postgres`
- `DRE_DB_PASSWORD` → `b85ad58ebb9e9caed0e200bc640e1d82`

### 3. Edge function: `explore-dre-db`
Uma função temporária que conecta ao PostgreSQL usando a lib `postgres` (npm) e retorna:
- Lista de tabelas
- Colunas de cada tabela
- Amostra de dados (LIMIT 5 por tabela)

Isso nos permite entender a estrutura do banco antes de construir a integração final.

```text
Browser → Edge Function → PostgreSQL externo (5.78.97.125)
                ↓
         JSON com schema + amostra
```

### 4. Analisar resultado e mapear para o P&L
Com base na estrutura descoberta, criarei uma segunda edge function (`fetch-dre-data`) que:
- Consulta as tabelas certas do banco
- Retorna os dados formatados no shape do `PnlNode[]` atual
- Substitui os dados hardcoded em `pnlData.ts`

### 5. Atualizar frontend
- Criar hook `useDreData` que chama a edge function
- Integrar no `FinancialModelContext` para substituir os dados estáticos
- Manter fallback para dados hardcoded caso a API falhe

## Arquivos impactados

| Arquivo | Ação |
|---------|------|
| `supabase/config.toml` | Criar com config da edge function |
| `supabase/functions/explore-dre-db/index.ts` | Criar (exploração do schema) |
| `supabase/functions/fetch-dre-data/index.ts` | Criar (consulta real dos dados) |
| `src/hooks/useDreData.ts` | Criar (hook para consumir a API) |
| `src/contexts/FinancialModelContext.tsx` | Atualizar para usar dados do banco |

## Primeira ação
Habilitar Lovable Cloud e armazenar os secrets, depois criar a edge function de exploração para entender o banco antes de qualquer integração.

