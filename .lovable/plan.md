
# Fix: produção continua quebrando com `supabaseUrl is required`

## O que encontrei
- O app depende de `src/integrations/supabase/client.ts`, que cria o client imediatamente no carregamento do módulo.
- Esse arquivo lê `import.meta.env.VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Se a publicação live vier sem essas variáveis injetadas, o app quebra antes de renderizar qualquer tela.
- Hoje vários arquivos importam esse client no topo do módulo, então um problema de config derruba toda a aplicação.

## Objetivo
Evitar tela branca em produção e tornar o app resiliente mesmo quando a configuração do backend não vier no build live.

## Plano de implementação

### 1) Criar um wrapper seguro para o client
Adicionar um novo arquivo utilitário para:
- ler `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID`
- expor helpers como:
  - `hasBackendConfig()`
  - `getBackendClient()` (lazy, só cria client quando as chaves existirem)
  - `getBackendConfigError()` para mensagem amigável

Importante:
- não editar `src/integrations/supabase/client.ts`
- o wrapper passa a ser a camada usada pelo app

### 2) Remover imports diretos do client gerado nas telas/hooks críticos
Trocar os imports de `@/integrations/supabase/client` por chamadas ao wrapper nos pontos abaixo:
- `src/components/auth/ProtectedRoute.tsx`
- `src/pages/Auth.tsx`
- `src/pages/ResetPassword.tsx`
- `src/hooks/useDreData.ts`
- `src/hooks/useAssumptionsPersistence.ts`

Ajuste de lógica:
- criar/obter o client dentro de `useEffect` ou handlers
- se a config não existir, não tentar autenticar nem invocar backend
- retornar erro controlado em vez de exception fatal

### 3) Adicionar fallback visual no bootstrap/auth
Quando a configuração estiver ausente:
- renderizar uma tela de erro amigável, explicando que a publicação live está sem configuração do backend
- evitar crash silencioso / página em branco
- manter preview funcional quando as variáveis existirem

### 4) Blindar `useOxyCashFlow`
Hoje ele monta URL usando `VITE_SUPABASE_PROJECT_ID` + key diretamente.
Vou ajustar para:
- validar config antes do fetch
- exibir erro controlado se faltar `projectId`/key
- impedir novo crash posterior mesmo depois de corrigir o problema inicial

### 5) Garantir comportamento consistente
Após a mudança:
- se a publicação live vier configurada corretamente, tudo funciona normal
- se vier sem config, o usuário vê mensagem clara em vez de tela branca
- a falha deixa de acontecer no import-time

## Arquivos a alterar
- Novo utilitário: `src/lib/...` ou `src/integrations/...` para wrapper seguro
- `src/components/auth/ProtectedRoute.tsx`
- `src/pages/Auth.tsx`
- `src/pages/ResetPassword.tsx`
- `src/hooks/useDreData.ts`
- `src/hooks/useAssumptionsPersistence.ts`
- `src/hooks/useOxyCashFlow.ts`

## Detalhe técnico
A causa principal não é a lógica de autenticação em si, e sim a criação eager do client no topo do módulo. O conserto correto é tornar essa inicialização lazy e protegida, sem depender que o build live esteja sempre perfeito.

## Sem mudanças de banco
- nenhuma migration
- nenhuma mudança de política
- nenhuma mudança em Lovable Cloud

## Resultado esperado
- produção deixa de quebrar com `supabaseUrl is required`
- o app para de abrir em branco
- se houver problema real de configuração no deploy, ele aparece como erro visível e diagnosticável
