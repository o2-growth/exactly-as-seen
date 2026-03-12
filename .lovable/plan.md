

# Explorar API Oxy Finance — Cash Flow

## Passo 1: Adicionar secret `OXY_API_KEY`

Solicitar o secret via ferramenta de secrets para disponibilizar nas edge functions.

## Passo 2: Criar Edge Function diagnóstica `fetch-oxy-cashflow`

Edge function que faz chamadas aos **2 endpoints** da API Oxy e retorna os JSONs brutos para análise:

1. **Card details** (`/widgets/cash-flow/v2/card/details`) — chamado com `movimentType=R` e depois com `movimentType=P`
2. **Chart** (`/widgets/cash-flow/charts/fluxo-caixa`)

Parâmetros fixos: CNPJ `23.813.779/0001-60`, datas recebidas via query string.

## Passo 3: Testar e analisar os JSONs

Invocar a edge function, examinar a estrutura de resposta de cada endpoint, e só então planejar a integração no frontend.

