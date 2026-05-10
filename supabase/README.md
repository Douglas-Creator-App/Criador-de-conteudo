# Supabase

Estrutura reservada para deixar o Content Agent pronto para Supabase.

## Pastas

- `functions/`: Edge Functions futuras.
- `migrations/`: migrations SQL versionadas.
- `seed.sql`: dados iniciais opcionais.

## Setup esperado

Quando o Supabase CLI estiver instalado:

```powershell
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

Para Edge Functions:

```powershell
supabase functions deploy NOME_DA_FUNCAO
```

## Segredos

Nao versionar tokens reais. Use Supabase Secrets:

```powershell
supabase secrets set BORAPOSTAR_API_KEY=...
supabase secrets set GEMINI_API_KEY=...
```

