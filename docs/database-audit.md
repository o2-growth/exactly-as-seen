# Database & Supabase Audit - O2 Inc. Financial Modeling Dashboard

**Data:** 2026-03-31
**Fase:** 0.3 - Auditoria de Banco de Dados (Dara - Data Engineer)

---

## A. Schema Design

### Tabela Unica: `assumptions_snapshots`
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | Identificador unico |
| user_id | UUID (FK → auth.users) | Dono do snapshot |
| scenario | TEXT (CHECK: BASE/BULL/BEAR) | Cenario |
| name | TEXT | Nome do snapshot |
| assumptions | JSONB | Objeto Assumptions completo |
| is_active | BOOLEAN | Snapshot ativo |
| created_at | TIMESTAMPTZ | Criacao |
| updated_at | TIMESTAMPTZ | Atualizacao |

### Index Existente
- `idx_assumptions_user_active` em (user_id, is_active) ✓

### Indexes Faltantes
- `(scenario, user_id)` - filtro comum
- `(created_at DESC)` - queries temporais
- `(name)` - busca por nome

### Problemas
- JSONB armazena objeto completo sem possibilidade de query granular
- Sem versionamento (optimistic locking)
- Dependencia forte de banco DRE externo (PostgreSQL separado)

---

## B. Edge Functions

### fetch-oxy-cashflow
- **Proposito**: Proxy para API Oxy Finance (cash flow externo)
- **Auth**: `verify_jwt = false` ⚠️
- **CNPJ hardcoded**: `23.813.779/0001-60`
- **CORS**: `Access-Control-Allow-Origin: *` ⚠️
- **Sem cache ou rate limiting**

### fetch-dre-data
- **Proposito**: Query direta ao banco DRE externo, transforma em arvore P&L
- **Auth**: `verify_jwt = false` ⚠️
- **SQL INJECTION**: Template literals usados diretamente ⚠️ CRITICO
- **Pool size**: 1 (gargalo sob carga)
- **Sem paginacao**: Carrega TODOS os registros

### explore-dre-db
- **Proposito**: Funcao de debug para inspecionar schema do DRE
- **Auth**: `verify_jwt = false` ⚠️
- **SQL INJECTION**: Mesmo problema do fetch-dre-data ⚠️ CRITICO
- **Deveria estar DESABILITADO em producao**

---

## C. Estrategia de Persistencia

### Fluxo de Escrita
```
User edita assumption
  → localStorage (imediato)
  → Supabase (async, debounce 2s)
  → Se Supabase falha, dados sobrevivem no localStorage
```

### Fluxo de Leitura
```
1. Verifica se Supabase esta configurado
2. Se nao → localStorage fallback
3. Se sim mas sem usuario → localStorage
4. Se autenticado → fetch do Supabase
5. Se fetch falha → localStorage fallback
```

### Problemas de Consistencia
- **Sem resolucao de conflitos** (last-write-wins)
- **Race condition**: Edicao durante debounce de 2s
- **Sem sync entre abas** (apenas reload manual)
- **Sem queue de retry** para escritas falhadas
- **Sem optimistic locking** (sem coluna de versao)

---

## D. Avaliacao de Seguranca

### CRITICOS

| # | Problema | Risco | Acao |
|---|---------|-------|------|
| 1 | **RLS policy "dev only"** permite acesso anonimo total | CRITICO | Remover imediatamente |
| 2 | **SQL Injection** em explore-dre-db e fetch-dre-data | CRITICO | Usar queries parametrizadas |
| 3 | **Sem auth** nas edge functions (verify_jwt = false) | ALTO | Habilitar JWT verification |
| 4 | **CORS wildcard** em todas as functions | ALTO | Restringir a dominio O2 |

### A policy RLS problematica (migration linha 38-40):
```sql
CREATE POLICY "Anon can do everything (dev only)"
  ON public.assumptions_snapshots FOR ALL
  USING (true) WITH CHECK (true);
```
**Esta policy permite que QUALQUER pessoa acesse TODOS os dados de TODOS os usuarios.**

### ALTOS

| # | Problema | Risco | Acao |
|---|---------|-------|------|
| 5 | Chave anonima hardcoded no source | ALTO | Usar apenas env vars |
| 6 | Credenciais DRE em env vars compartilhadas | ALTO | Usar Supabase Secrets |
| 7 | explore-dre-db expoe schema em producao | ALTO | Desabilitar em prod |

---

## E. Performance

### Problemas Identificados

1. **fetch-dre-data**: 4 queries sequenciais → deveria usar batch ou views materializadas
2. **JSONB sem indexacao**: Nao e possivel filtrar por campos especificos do assumptions
3. **Pool size = 1**: Gargalo sob requests concorrentes
4. **Sem cache**: Dados DRE refetchados a cada requisicao
5. **N+1 em useAssumptionsPersistence**: Update all → Insert sem transacao

---

## F. Recomendacoes Priorizadas

### CRITICO (Imediato)

1. **Remover RLS policy de dev**
   ```sql
   DROP POLICY "Anon can do everything (dev only)" ON public.assumptions_snapshots;
   ```

2. **Corrigir SQL Injection** nas edge functions
   - Usar queries parametrizadas (`$1`, `$2`)
   - Validar nomes de tabela contra whitelist

3. **Habilitar JWT nas edge functions**
   - `verify_jwt = true` em config.toml
   - Adicionar check de autorizacao

4. **Restringir CORS**
   - Trocar `'*'` pelo dominio da aplicacao

5. **Desabilitar explore-dre-db em producao**

### ALTO (Semana 1-2)

6. **Adicionar coluna `version`** para optimistic locking
7. **Transacao atomica** no save de assumptions (update + insert)
8. **Adicionar indexes**: (scenario, user_id), (created_at DESC)
9. **Rotacionar credenciais** do banco DRE

### MEDIO (Semana 3-4)

10. **Cache de edge functions** (TTL 1-6h para dados DRE)
11. **Aumentar pool size** para 5-10
12. **Adicionar date range** como parametro do fetch-dre-data
13. **Implementar sync queue** com retry para escritas falhadas

### BAIXO (Futuro)

14. **Extrair campos frequentes do JSONB** para colunas dedicadas
15. **Mover logica P&L** de edge function para SQL (CTEs recursivos)
16. **Monitoramento** de erros, pool exhaustion, RLS violations

---

## Resumo

O banco de dados tem uma **arquitetura minimalista** (1 tabela no Supabase + banco DRE externo) que funciona para o uso atual, mas possui **vulnerabilidades criticas de seguranca** que precisam ser corrigidas imediatamente:

1. RLS policy de dev aberta em producao
2. SQL injection em 2 edge functions
3. Edge functions sem autenticacao
4. CORS wildcard

A estrategia de persistencia (localStorage + Supabase) e funcional mas fragil, sem resolucao de conflitos ou sync entre abas.
