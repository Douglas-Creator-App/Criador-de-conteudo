# GitHub e Supabase

## GitHub

Este projeto deve ser versionado a partir da pasta `content-agent/`, nao da raiz `PROJETOS-CODEX`, porque a raiz tem outras skills e projetos.

Comandos:

```powershell
cd C:\Users\dmooo\OneDrive\Desktop\PROJETOS-CODEX\content-agent
git init
git add .
git commit -m "Initial content agent"
```

Depois crie um repositorio vazio no GitHub e conecte:

```powershell
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/content-agent.git
git push -u origin main
```

Se instalar o GitHub CLI:

```powershell
gh auth login
gh repo create content-agent --private --source . --remote origin --push
```

## Supabase

Instale o Supabase CLI e rode:

```powershell
cd C:\Users\dmooo\OneDrive\Desktop\PROJETOS-CODEX\content-agent
supabase login
supabase link --project-ref qoveugouqjpmihslaeqk
supabase db push
```

Secrets recomendados:

```powershell
supabase secrets set BORAPOSTAR_API_KEY=...
supabase secrets set GEMINI_API_KEY=...
supabase secrets set SCRAPECREATORS_API_KEY=...
```

## Arquivos que nao devem subir

- `config/content-machine-config.json`
- `.env`
- qualquer arquivo com token/API key real
- outputs temporarios em `outputs/`
