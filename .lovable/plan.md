

# Adicionar BU "Expansão" ao gráfico "Evolução de Clientes por BU"

## Alteração
Arquivo: `src/pages/Assumptions.tsx`, linhas 723-738

1. Adicionar `Expansão: data.subProductClients?.baas?.[y] ?? 0` ao objeto de dados do chart (linha 728)
2. Adicionar `<Line type="monotone" dataKey="Expansão" stroke="hsl(30, 80%, 55%)" strokeWidth={2} dot={{ r: 3 }} />` após a linha do Tax (linha 738)

Resultado: o gráfico passará a mostrar 5 séries — CaaS, SaaS, Education, Tax e Expansão (laranja).

