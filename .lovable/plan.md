## Problema

No `src/components/cashflow/PmrConfigurator.tsx`, os inputs de parcelas, inadimplência e custo de antecipação são controlados diretamente pelo prop `produtos`. O handler `updateProduto` só propaga a alteração via `onSave(...)` quando a soma das parcelas de **todos os produtos** é exatamente 100%.

Consequências percebidas pelo usuário:
- Ao apagar/digitar dígitos, o valor "volta" imediatamente — porque sem `onSave`, o prop nunca muda e o React re-renderiza o valor anterior.
- Inadimplência e custo de antecipação ficam travados se houver qualquer linha cuja soma de parcelas não seja 100%.
- `Number(e.target.value) || 0` força "0" ao limpar o campo, impedindo input intermediário vazio.

## Correção

Introduzir **estado local de rascunho (draft)** no `PmrConfigurator`, espelhando o prop `produtos`, e desacoplar UI da persistência:

1. `const [draft, setDraft] = useState(produtos)` + `useEffect` para sincronizar quando `produtos` mudar externamente.
2. Renderizar todos os inputs a partir de `draft` (não mais do prop).
3. `updateProduto` agora:
   - Sempre atualiza `draft` (permite digitação livre).
   - Chama `onSave(next)` **somente para a linha atualmente válida** (soma = 100%), em vez de exigir validade global. Linhas inválidas ficam marcadas em vermelho mas não bloqueiam outras edições.
4. Inputs de parcela aceitam string vazia durante a digitação (usar `useState` de string ou armazenar `''` como `0` apenas no commit/blur).
5. Inadimplência e custo de antecipação passam a chamar `onSave` independentemente da validade das parcelas (são campos numéricos isolados).
6. Manter o indicador visual `100%` em verde/vermelho e o rótulo "Auto-save ativo".

## Arquivo afetado

- `src/components/cashflow/PmrConfigurator.tsx` — refatorar para draft local + commit granular por linha.

## Validação

- Abrir `/cashflow` → expandir PMR → editar parcelas livremente (digitar, apagar) sem o valor "voltar".
- Mudar inadimplência de uma linha mesmo com parcelas de outra linha temporariamente inválidas.
- Verificar no Network que `POST /assumptions_snapshots` dispara ao atingir 100% em uma linha editada.
