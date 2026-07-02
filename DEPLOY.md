# Deploy — Coolify (VPS Hetzner)

Guia pra subir o Thumbnail Factory na VPS via Coolify, usando o `Dockerfile` do repo.

> **Contexto:** app single-user, Next.js 16 (standalone). Imagem = **G-Labs**
> (Nano Banana Pro). Texto/visão = **Claude Opus 4.8** via CLI Proxy. Estado em
> SQLite + arquivos no disco (`/app/data`) — precisa de **volume persistente**.

---

## 1. Pré-requisitos

- Repositório no GitHub: `joelneto1/thumbnail-factory` (privado).
- Coolify instalado na VPS (Hetzner).
- **G-Labs acessível pela VPS.** Hoje o G-Labs roda na SUA máquina (Chrome +
  extensão em `127.0.0.1:8765`), exposto via **Tailscale Serve** em
  `https://joel.tail739437.ts.net`. Pra VPS alcançar isso, ela precisa estar
  **na mesma tailnet** (instalar Tailscale na VPS e autenticar) — ou o túnel
  precisa estar público via Tailscale Funnel. Já validamos que a URL responde.

---

## 2. Criar o recurso no Coolify

1. **New Resource → Application → Private Repository (via GitHub App ou Deploy Key)**.
2. Selecione `joelneto1/thumbnail-factory`, branch **`master`**.
3. **Build Pack: `Dockerfile`** (o Coolify detecta o `Dockerfile` na raiz).
4. **Port (exposed): `3000`**.
5. **Health check path:** `/api/health` (opcional, mas recomendado).

---

## 3. Variáveis de ambiente (Coolify → Environment Variables)

As chaves **NÃO** vão no repo — configure aqui:

| Variável | Valor |
|---|---|
| `GLABS_BASE_URL` | `https://joel.tail739437.ts.net` |
| `GLABS_API_KEY` | *(sua chave G-Labs)* |
| `CLI_PROXY_BASE_URL` | `http://cli-proxyllm.rotaclubs.com/v1` |
| `CLI_PROXY_API_KEY` | *(sua chave `cpw_...`)* |
| `CLI_PROXY_MODEL` | `claude-opus-4-8` |
| `CLI_PROXY_REASONING_EFFORT` | `high` |

> `NODE_ENV`, `PORT` e `HOSTNAME` já vêm do Dockerfile — não precisa setar.

---

## 4. Volume persistente (CRÍTICO)

Sem isso, você perde personas, histórico e thumbnails a cada redeploy.

- Coolify → **Storages / Volumes → Add**.
- **Mount path (no container): `/app/data`**.
- Deixe o Coolify criar o volume nomeado (ex: `thumbfactory-data`).

O app grava aqui: `data/thumbnails.db` (SQLite) e `data/outputs`, `data/personas`,
`data/competitors` (imagens).

---

## 5. Deploy

Clique **Deploy**. O Coolify vai buildar o `Dockerfile` (multi-stage) e subir.
Primeiro build demora um pouco (compila deps nativas + Next). Acompanhe os logs.

Depois, acesse a URL que o Coolify gerar e confira **`/api/health`** — deve
retornar `{"glabs":"up"|"down", "claude":"configured", ...}`.

---

## 6. Gotchas importantes

- **Settings salvas no DB têm prioridade sobre env vars.** O volume novo começa
  vazio, então as env vars acima é que valem — perfeito. **NÃO** copie o
  `data/thumbnails.db` local pra VPS: ele tem `glabs_base_url = 127.0.0.1:8765`
  salvo, que a VPS não alcança. Se precisar, ajuste depois em **/settings**.
- **G-Labs depende da SUA máquina.** A geração de imagem só funciona com o
  Chrome + extensão G-Labs abertos localmente e o túnel Tailscale de pé. Se cair,
  `/api/health` mostra `glabs:down` e a geração falha (sem fallback — o Claude
  não gera imagem). É o comportamento esperado até o RunPod entrar.
- **Claude (CLI Proxy)** é acessível pela internet, então funciona da VPS direto.
- **Módulo nativo:** o Dockerfile já copia o binário do `better-sqlite3`. Se
  aparecer erro de `better_sqlite3.node` no runtime, veja o passo de cópia da
  cadeia no `Dockerfile` (better-sqlite3 + bindings + file-uri-to-path).

---

## 7. Redeploys

Todo push na branch `master` pode disparar redeploy automático (se você ligar o
webhook no Coolify). O volume `/app/data` persiste entre deploys.
