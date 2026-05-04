Achei o motivo real da tela branca.

O problema não é o P&L, nem o cálculo de dívida, nem autenticação. O app está quebrando antes de renderizar qualquer tela porque um cliente de backend está sendo criado com URL e chave `undefined`.

O erro exato:

```text
Uncaught Error: supabaseUrl is required.
at AH (...)
at new TH (...)
at EI (...)
```

significa: o código chamou `createClient(undefined, undefined, ...)`. A biblioteca interrompe imediatamente a execução do JavaScript. Como isso acontece no carregamento inicial do bundle, o React nem chega a montar a interface, então a tela fica branca.

E eu confirmei isso no bundle publicado. O JavaScript publicado contém este padrão minificado:

```text
const U5e = void 0,
      z5e = void 0,
      Qi = EI(U5e, z5e, { auth: ... })
```

Ou seja: no bundle que está no ar, a URL e a chave foram compiladas como `undefined`.

Por que isso começou agora

A alteração de Debt & Finance adicionou 3 hooks novos:

```text
src/hooks/useFinancialDebts.ts
src/hooks/useTaxDebts.ts
src/hooks/useDebtSchedule.ts
```

Esses 3 arquivos importam diretamente:

```ts
import { supabase } from '@/integrations/supabase/client';
```

Esse arquivo `src/integrations/supabase/client.ts` é auto-gerado e faz isto no topo do módulo:

```ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ...);
```

Quando essas variáveis não chegam no build/publicação, ele quebra na hora.

Por que quebra até abrindo a página inicial `/`, e não só `/debt`

Porque `src/App.tsx` importa a página DebtFinance de forma estática:

```ts
import DebtFinance from './pages/DebtFinance';
```

E `DebtFinance` importa os 3 hooks acima. Então o navegador carrega essa cadeia inteira logo na abertura do app:

```text
App.tsx
  -> DebtFinance.tsx
     -> useFinancialDebts.ts
        -> integrations/supabase/client.ts
           -> createClient(undefined, undefined)
           -> crash geral
```

Mesmo que você esteja na home `/`, o import já foi avaliado. Por isso a tela branca aparece antes de qualquer rota, login ou dashboard.

Por que o fallback existente não salvou o app

O projeto já tem um arquivo seguro:

```text
src/lib/supabase-safe.ts
```

Esse arquivo tem fallback e inicialização protegida. Outras partes do app já usam ele corretamente, por exemplo:

```text
Auth.tsx
ResetPassword.tsx
ProtectedRoute.tsx
useAssumptionsPersistence.ts
useDreData.ts
AppSidebar.tsx
```

Mas os 3 hooks novos de dívida não usam esse arquivo seguro; eles usam o cliente auto-gerado direto. Então eles desviaram da proteção que já existia no projeto.

Por que não sai da tela branca ao atualizar

Porque o bundle publicado ainda é o mesmo arquivo quebrado:

```text
/assets/index-Dqy8wN9-.js
```

Enquanto esse bundle continuar contendo `createClient(undefined, undefined)`, todo reload vai executar o mesmo erro antes do React renderizar. Limpar cache ou recarregar não resolve se o código publicado continua com esse trecho.

Plano de correção

1. Trocar os 3 hooks de dívida para usar o cliente seguro
   - `useFinancialDebts.ts`
   - `useTaxDebts.ts`
   - `useDebtSchedule.ts`

   Em vez de importar `supabase` direto de `@/integrations/supabase/client`, usar `getBackendClientSafe()` de `@/lib/supabase-safe`.

2. Tratar backend indisponível sem crash
   - Nas queries, se o cliente não existir, retornar `[]` ou lançar um erro controlado pelo React Query.
   - Nas mutations, se o cliente não existir, mostrar toast amigável em português em vez de derrubar o app.

3. Não editar arquivos auto-gerados
   - Não mexer em:
     ```text
     src/integrations/supabase/client.ts
     src/integrations/supabase/types.ts
     ```
   - O conserto deve ficar nos hooks e seguir o padrão já usado no resto do projeto.

4. Republicar o frontend depois da correção
   - A correção só entra no site publicado quando o frontend for publicado/atualizado novamente.
   - Backend/tabelas já existem; o problema atual é o JavaScript publicado quebrando na inicialização.

5. Conferência pós-correção
   - Confirmar que não existe mais import direto de `@/integrations/supabase/client` nos hooks novos.
   - Confirmar que o app renderiza a rota `/` sem tela branca.
   - Confirmar que a rota `/debt` carrega dados ou mostra estado vazio/erro controlado, sem crash global.

Resumo direto

A tela branca persiste porque a última publicação colocou no ar um bundle onde os hooks novos de Debt & Finance inicializam o cliente de backend diretamente com variáveis ausentes. Isso gera `supabaseUrl is required` no carregamento do JavaScript e derruba o app inteiro antes da primeira renderização.

A correção real é remover essas 3 importações diretas e fazer esses hooks usarem o wrapper seguro que o projeto já tem.

<lov-actions>
  <lov-open-history>View History</lov-open-history>
</lov-actions>

<lov-actions>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>