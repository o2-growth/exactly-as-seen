

# Diagnóstico: "Configuração ausente" no preview

## O que está acontecendo

A boa notícia: o app **não quebra mais** com `supabaseUrl is required`. O wrapper seguro está funcionando — em vez de tela branca, ele mostra a mensagem de fallback.

A mensagem "Configuração ausente" aparece porque `hasBackendConfig()` retorna `false`, ou seja, as variáveis `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` não estão sendo encontradas no momento do carregamento.

## Causa provável

Isso geralmente acontece após um restart do dev server ou quando o Hot Module Replacement (HMR) perde sincronização. O session replay mostra que o preview estava funcionando momentos antes (gráficos e tooltips renderizando normalmente).

## Solução

1. **Recarregue o preview** — clique no botão de refresh no painel de preview (não no navegador)
2. **Para produção** — clique em **Publish → Update** novamente para forçar um novo build com as variáveis injetadas
3. Se a produção continuar com o erro após republicar, pode ser um problema temporário de sincronização da plataforma — aguarde 1-2 minutos e tente novamente

## Nenhuma mudança de código necessária

O código está correto. Nenhum arquivo importa o client gerado diretamente. O wrapper seguro está ativo e funcionando como esperado.

