# Content Agent Codex

Agente local de conteudo para operar a maquina de conteudo no Codex/Windows.

## Setup

1. Crie a config local:

```powershell
.\content-agent\content-agent.cmd init
```

2. Edite `content-agent\config\content-machine-config.json` e preencha pelo menos:

- `borapostar_api_key`
- `instagram_username`

3. Teste o status:

```powershell
.\content-agent\content-agent.cmd status
```

## Comandos

```powershell
.\content-agent\content-agent.cmd init
.\content-agent\content-agent.cmd status
.\content-agent\content-agent.cmd prompts get
.\content-agent\content-agent.cmd borapostar test
.\content-agent\content-agent.cmd borapostar listar
.\content-agent\content-agent.cmd borapostar gerar .\content-agent\outputs\briefing-carrossel.md
.\content-agent\content-agent.cmd borapostar ultimo
.\content-agent\content-agent.cmd borapostar slides CAROUSEL_ID
.\content-agent\content-agent.cmd draft carousel "tema do carrossel"
.\content-agent\content-agent.cmd draft linkedin "tema do post"
.\content-agent\content-agent.cmd draft youtube "tema ou url do video"
```

## App ViralRadar

Abra o app web em:

```text
web/index.html
```

Ou rode localmente:

```powershell
node web\server.js
```

O app inclui radar de tendencias, pipeline de conteudo, gerador de briefing, calendario editorial e tela de configuracoes.

## Fluxo recomendado

1. Codex pesquisa/escreve o conteudo e salva um briefing em `outputs/`.
2. Voce aprova explicitamente.
3. O comando `borapostar gerar` envia o briefing aprovado para a API.
4. O comando `borapostar ultimo` acompanha o status.
5. Publicacao em redes sociais passa por confirmacao manual antes de qualquer envio.

## Seguranca

`config/content-machine-config.json` fica ignorado pelo git. Nao coloque tokens em arquivos fora de `config/`.
