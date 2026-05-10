param(
  [Parameter(Position = 0)]
  [string]$Command = "help",

  [Parameter(Position = 1)]
  [string]$Subcommand = "",

  [Parameter(Position = 2)]
  [string]$Value = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ConfigDir = Join-Path $Root "config"
$ConfigPath = Join-Path $ConfigDir "content-machine-config.json"
$ExampleConfigPath = Join-Path $ConfigDir "content-machine-config.example.json"
$OutputsDir = Join-Path $Root "outputs"
$CarouselApiBase = "https://xxhixkptbggbjqdmebwc.supabase.co/functions/v1/carousel-api"
$PromptsApiBase = "https://xxhixkptbggbjqdmebwc.supabase.co/functions/v1/user-prompts"

function Write-Info($Message) {
  Write-Host "[content-agent] $Message"
}

function Ensure-Dirs {
  New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
  New-Item -ItemType Directory -Force -Path $OutputsDir | Out-Null
}

function Ensure-Config {
  Ensure-Dirs
  if (!(Test-Path -LiteralPath $ConfigPath)) {
    Copy-Item -LiteralPath $ExampleConfigPath -Destination $ConfigPath
    Write-Info "Config criada em $ConfigPath"
    Write-Info "Preencha borapostar_api_key e instagram_username antes de usar APIs."
  }
}

function Get-Config {
  Ensure-Config
  $raw = Get-Content -LiteralPath $ConfigPath -Raw
  return $raw | ConvertFrom-Json
}

function Get-ApiHeaders {
  $config = Get-Config
  if ([string]::IsNullOrWhiteSpace($config.borapostar_api_key)) {
    throw "borapostar_api_key esta vazio em $ConfigPath"
  }
  return @{ "X-API-Key" = $config.borapostar_api_key }
}

function Invoke-AgentApi($Method, $Uri, $Body = $null) {
  $headers = Get-ApiHeaders
  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
  }
  return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 10)
}

function Show-Help {
  @"
Content Agent Codex

Comandos:
  init
  status
  prompts get
  prompts set-persona "texto"
  borapostar test
  borapostar listar
  borapostar gerar caminho\briefing.md
  borapostar ultimo
  borapostar slides CAROUSEL_ID
  draft carousel "tema"
  draft linkedin "tema"
  draft youtube "tema ou url"
"@
}

function Show-Status {
  $config = Get-Config
  $mask = if ([string]::IsNullOrWhiteSpace($config.borapostar_api_key)) { "faltando" } else { "configurada" }
  [pscustomobject]@{
    config_path = $ConfigPath
    borapostar_api_key = $mask
    instagram_username = $config.instagram_username
    youtube_channel_id = $config.youtube_channel_id
    gemini_api_key = if ([string]::IsNullOrWhiteSpace($config.gemini_api_key)) { "faltando" } else { "configurada" }
    browser_provider = $config.browser_automation.provider
    approval_required = $config.approval_required
  } | Format-List
}

function New-Draft($Type, $Topic) {
  Ensure-Dirs
  if ([string]::IsNullOrWhiteSpace($Topic)) {
    throw "Informe um tema."
  }

  $slug = ($Topic.ToLowerInvariant() -replace "[^a-z0-9]+", "-").Trim("-")
  if ([string]::IsNullOrWhiteSpace($slug)) { $slug = "rascunho" }
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $path = Join-Path $OutputsDir "$timestamp-$Type-$slug.md"

  switch ($Type) {
    "carousel" { $template = Get-Content -LiteralPath (Join-Path $Root "prompts\carousel-brief-template.md") -Raw }
    "linkedin" { $template = Get-Content -LiteralPath (Join-Path $Root "prompts\linkedin-post-template.md") -Raw }
    "youtube" { $template = Get-Content -LiteralPath (Join-Path $Root "prompts\youtube-optimization-template.md") -Raw }
    default { throw "Tipo de draft desconhecido: $Type" }
  }

  $content = $template -replace "Tema:", "Tema: $Topic" -replace "Video/URL:", "Video/URL: $Topic"
  Set-Content -LiteralPath $path -Value $content -Encoding UTF8
  Write-Info "Rascunho criado: $path"
}

switch ($Command.ToLowerInvariant()) {
  "help" { Show-Help }
  "init" { Ensure-Config }
  "status" { Show-Status }
  "draft" {
    $type = $Subcommand.ToLowerInvariant()
    New-Draft $type $Value
  }
  "prompts" {
    switch ($Subcommand.ToLowerInvariant()) {
      "get" {
        Invoke-AgentApi "GET" $PromptsApiBase | ConvertTo-Json -Depth 10
      }
      "set-persona" {
        if ([string]::IsNullOrWhiteSpace($Value)) { throw "Informe a persona." }
        Invoke-AgentApi "PUT" $PromptsApiBase @{ persona = $Value } | ConvertTo-Json -Depth 10
      }
      default { Show-Help }
    }
  }
  "borapostar" {
    switch ($Subcommand.ToLowerInvariant()) {
      "test" {
        Invoke-AgentApi "GET" "$CarouselApiBase/agent/listar" | ConvertTo-Json -Depth 10
      }
      "listar" {
        Invoke-AgentApi "GET" "$CarouselApiBase/agent/listar" | ConvertTo-Json -Depth 10
      }
      "gerar" {
        if ([string]::IsNullOrWhiteSpace($Value)) { throw "Informe o caminho do briefing aprovado." }
        $briefingPath = Resolve-Path -LiteralPath $Value
        $topic = Get-Content -LiteralPath $briefingPath -Raw
        Invoke-AgentApi "POST" "$CarouselApiBase/agent/gerar" @{ topic = $topic } | ConvertTo-Json -Depth 10
      }
      "ultimo" {
        Invoke-AgentApi "GET" "$CarouselApiBase/agent/ultimo" | ConvertTo-Json -Depth 10
      }
      "slides" {
        if ([string]::IsNullOrWhiteSpace($Value)) { throw "Informe o carousel_id." }
        Invoke-AgentApi "GET" "$CarouselApiBase/agent/slides/$Value" | ConvertTo-Json -Depth 10
      }
      default { Show-Help }
    }
  }
  default { Show-Help }
}

