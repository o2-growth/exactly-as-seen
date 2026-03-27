

# Reorganizar tabela Tax Deductions por Categoria com botões de filtro

## Problema atual
A tabela mostra 22 colunas simultaneamente com nomes abreviados, difícil de ler e editar.

## Solução
Substituir a tabela única por **botões de categoria** (CaaS, SaaS, Education, Expansão, Tax) + opção "Todas". Ao clicar numa categoria, exibe apenas os subprodutos daquela categoria com nomes completos.

## Alterações — `src/pages/Assumptions.tsx` (L1306-1426)

1. Adicionar estado local `activeTaxCategory` (default: primeiro grupo ou 'all')
2. Substituir a tabela monolítica por:
   - **Barra de botões**: `CaaS | SaaS | Education | Expansão | Tax` (estilo similar aos TabsTrigger existentes)
   - **Tabela filtrada**: mostra apenas as keys do grupo selecionado
3. Usar **nomes completos** dos subprodutos em vez de abreviações:
   - CaaS: Serviços Especializados, Enterprise, Corporate, Parceiros, BPO Financeiro
   - SaaS: Oxy, Oxy+Gênio, Setup, Parceiros, Oxy+Gênio+Especialista
   - Education: Dono CFO, Eng. Negócios, Financeiro Raiz, FSP
   - Expansão: Oxy Hacker, Franquia, Master Franquia
   - Tax: AT, GPT, RCT, RT, DTC
4. Mesma lógica de edição (PIS, COFINS, ISS editáveis; IRPJ, CSLL, TOTAL calculados)
5. Remover scroll horizontal (tabela cabe com 3-5 colunas por vez)

## Arquivo alterado
- `src/pages/Assumptions.tsx` — refatorar bloco Tax Deductions (L1306-1426)

