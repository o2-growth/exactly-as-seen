

# Adicionar "Esqueci minha senha" à tela de login

## Resumo
Adicionar link "Esqueci minha senha" na tela de login e criar página `/reset-password` para definir nova senha.

## Alterações

### 1. `src/pages/Auth.tsx`
- Adicionar estado `isForgotPassword` para alternar entre login/signup/forgot
- No modo "forgot": exibir apenas campo de email + botão "Enviar link de recuperação"
- Chamar `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`
- Adicionar link "Esqueceu sua senha?" abaixo do campo de senha (visível apenas no modo login)
- Manter identidade visual (Space Grotesk, card com borda, cores do tema)

### 2. `src/pages/ResetPassword.tsx` (novo)
- Página pública (fora do ProtectedRoute) na rota `/reset-password`
- Detectar token de recovery no URL hash (`type=recovery`)
- Formulário para digitar nova senha + confirmação
- Chamar `supabase.auth.updateUser({ password })`
- Após sucesso, redirecionar para `/auth`
- Mesma identidade visual da tela de login

### 3. `src/App.tsx`
- Adicionar rota `/reset-password` apontando para `ResetPassword` (rota pública, fora do ProtectedRoute)

