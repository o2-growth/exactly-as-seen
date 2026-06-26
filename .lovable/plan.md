## Resetar senha do Pedro Albite

Vou localizar o usuário pelo email no Lovable Cloud e atualizar a senha para `Alterar@01` usando a Admin API (service role).

### Passos
1. Buscar o `user_id` em `auth.users` filtrando pelo email do Pedro Albite (preciso confirmar o email exato — vou assumir que existe um único usuário cujo email contenha "albite"; se houver mais de um, paro e pergunto).
2. Executar `auth.admin.updateUserById(userId, { password: 'Alterar@01' })` via uma chamada pontual com a service role key (executada no ambiente do agente, sem expor a chave no código do app).
3. Confirmar o sucesso e avisar você.

### Observação
- Nenhum arquivo do projeto será alterado.
- A nova senha será `Alterar@01`. Recomendo pedir ao Pedro para trocá-la no primeiro login.

Confirma que posso prosseguir? Se souber o email exato do Pedro, me passa para garantir que eu atualize a conta certa.
