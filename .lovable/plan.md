

# Automatizar Setup = soma dos novos clientes de 5 produtos

## Produtos que entram na soma
- Enterprise (`caasEnterprise`)
- Corporate (`caasCorporate`)
- Oxy (`saasOxy`)
- Oxy + Gênio (`saasOxyGenio`)
- Oxy + Gênio + Especialista (`saasOxyGenioEsp`)

## Alterações

### 1. `src/engine/calculationsEngine.ts`
Criar helper `getNewClientsInMonth(subKey, month, year, assumptions)` que calcula `Math.max(0, clientesMêsAtual - clientesMêsAnterior)` para um subproduto.

Setup mensal = soma dos novos clientes dos 5 produtos acima:
```text
setup[m] = newClients('caasEnterprise', m) 
         + newClients('caasCorporate', m) 
         + newClients('saasOxy', m) 
         + newClients('saasOxyGenio', m) 
         + newClients('saasOxyGenioEsp', m)
```

Janeiro compara com dezembro do ano anterior. Valores negativos (perda de clientes) são ignorados (`Math.max(0, ...)`).

### 2. `src/pages/Assumptions.tsx`
Tornar a linha de clientes do Setup **somente leitura** — o valor é derivado, não editável.

### 3. Defaults
Ignorar valores fixos de `saasSetupClients` em `modelData.ts` para anos projetados — usar sempre o cálculo dinâmico.

## Resultado
- Setup sempre reflete a soma dos novos clientes dos 5 produtos
- Qualquer mudança em Enterprise, Corporate, Oxy, Oxy+Gênio ou Oxy+Gênio+Especialista atualiza Setup automaticamente

