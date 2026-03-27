
# Fix: produção continua sem backend apesar do preview funcionar

## O que revisei
Encontrei um ponto importante: o app já não importa mais o client gerado diretamente. Hoje o gargalo real ficou concentrado em `src/lib/supabase-safe.ts`.

Também confirmei que:
- o preview usa outra camada/ambiente e por isso pode funcionar normalmente
- a versão publicada continua dependendo de `import.meta.env.VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID`
- se essas variáveis não forem injetadas no build live, `hasBackendConfig()` retorna `false` e o app mostra “Configuração ausente”

Ou seja: o wrapper evitou a tela branca, mas ainda depende 100% de variáveis de build no ambiente publicado.

## Plano de correção

### 1) Tornar `supabase-safe.ts` independente do build live
Ajustar `src/lib/supabase-safe.ts` para usar esta ordem:
1. tentar `import.meta.env`
2. se faltar, usar um fallback público do projeto já conhecido pelo app
3. só mostrar “Configuração ausente” se ambos falharem

Isso elimina a dependência do publish injetar as variáveis corretamente.

### 2) Cobrir também o `projectId`
Hoje `useOxyCashFlow` depende de `getProjectId()`.
Vou garantir que `getProjectId()` também tenha fallback, para esse hook continuar funcionando em produção.

### 3) Manter o comportamento atual do app
Não vou mexer no fluxo de autenticação nem no banco.
Os arquivos já migrados para o wrapper seguro continuam iguais:
- `ProtectedRoute`
- `Auth`
- `ResetPassword`
- `useDreData`
- `useAssumptionsPersistence`
- `useOxyCashFlow`

A mudança fica centralizada no wrapper.

### 4) Validar a mensagem de erro
Se ainda houver falha depois disso, a mensagem exibida passará a significar problema real de configuração/fallback inválido, e não mais apenas ausência de env no deploy.

## Arquivo a alterar
- `src/lib/supabase-safe.ts`

## Resultado esperado
- preview continua funcionando
- produção deixa de depender das variáveis `VITE_*` para acessar o backend
- o link publicado volta a abrir normalmente mesmo quando o build live não recebe essas envs

## Detalhe técnico
Pelo estado atual do código, este não é mais um problema espalhado pela aplicação. É um problema de resolução de configuração em um único ponto central. O conserto correto agora é adicionar fallback explícito no wrapper em vez de continuar tratando como “problema de republicação”.
