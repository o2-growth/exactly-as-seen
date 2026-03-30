

# Atualizar labels e cálculo anual de clientes nas categorias de receita

## Alterações

### 1. "Clientes por ano" → soma dos 12 meses (não target de Dezembro)
**Linha ~932**: Trocar o valor exibido de `assumptions.subProductClients[prodKey]?.[y]` para a **soma dos 12 meses** do array de overrides/projeções daquele ano. Tornar esse campo **somente leitura** (exibição, não input), pois é um valor derivado.

### 2. Renomear labels
- **Linha ~924**: `"Clientes por ano (target fim de ano)"` → `"Clientes por ano (soma)"`
- **Linha ~945**: `"Clientes mensais"` → `"Novos clientes mensais"`
- **Linha ~1096**: `"Receita Bruta (R$/mês)"` → `"Nova Receita adicionada (R$/mês)"`

### 3. Aplicar para todas as categorias/subcategorias
Estas alterações estão dentro do bloco que itera `filteredProducts`, então se aplicam automaticamente a todos os subprodutos.

### Lógica da soma anual
```ts
// Para cada ano, somar os 12 meses do array de clientes mensais
const monthlyArr = data.monthlyClientOverrides?.[prodKey]?.[y];
const baseMonthly = model.years[y]?.monthlyData;
const sum = Array.from({length: 12}, (_, i) => 
  monthlyArr?.[i] ?? baseMonthly?.[i]?.clients?.[prodKey] ?? 0
).reduce((a, b) => a + b, 0);
```

## Arquivo alterado
- `src/pages/Assumptions.tsx` — 4 alterações de texto + 1 mudança de lógica (input → span com soma)

