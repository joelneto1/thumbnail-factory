# Deploy — Coolify (VPS Hetzner)

Guia pra subir o Thumbnail Factory na VPS via Coolify, usando o `Dockerfile` do repo.

> **Contexto:** app single-user, Next.js 16 (standalone). Imagem = **G-Labs**,
> em duas engines: **Nano Banana Pro** (`/api/image/generate`) e **GPT Image 2**
> (`/api/openai/generate`) — mesmo host e mesma API key.
> Texto/visão = **Claude Opus 4.8** via CLI Proxy. Estado em
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
| `AUTH_USERNAME` | *(seu usuário de login)* |
| `AUTH_PASSWORD_HASH` | *(`scrypt:...` — veja abaixo)* |
| `AUTH_SECRET` | *(64 hex aleatórios)* |

> `NODE_ENV`, `PORT` e `HOSTNAME` já vêm do Dockerfile — não precisa setar.

### Autenticação (obrigatória)

O app **exige login**. Sem as três variáveis `AUTH_*`, ele nega todo acesso —
falha fechada de propósito, pra nunca subir aberto por engano.

Para gerar um conjunto novo (senha aleatória + hash + segredo):

```bash
node scripts/gen-credentials.mjs
```

O script imprime as três variáveis prontas pra colar, e a senha em texto **uma
única vez** — ela não fica gravada em lugar nenhum. Guarde no seu gerenciador
de senhas.

Para trocar a senha depois: rode o script de novo, atualize
`AUTH_PASSWORD_HASH` no Coolify e redeploy. Trocar `AUTH_SECRET` derruba todas
as sessões abertas — é o botão de pânico se você achar que a senha vazou.

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
- **GPT Image 2 exige conta ChatGPT em plano PAGO**, cadastrada na aba OpenAI
  do G-Labs — confirmado com o suporte da plataforma. Isso é além do que o Nano
  Banana já exige (conta Google com Gemini Pro/Ultra). Conta no tier Free falha
  mesmo estando logada, habilitada e com `status=valid`. O tier de cada conta
  fica em `%APPDATA%/G-Labs Automation/openai_accounts.json`; ele é lido no
  login, então **depois de assinar é preciso remover e re-adicionar a conta**
  para o G-Labs parar de tratá-la como Free.
- **O sintoma é traiçoeiro:** a falha vem como *"Invalid request. Check the
  prompt and reference images (format/size)"*, que manda procurar no prompt e
  nas imagens. Não é isso — é o balde genérico de bad request do G-Labs
  (`oa_msg_bad_request`); conteúdo e cota têm mensagens próprias. O
  `/api/health` também continua `glabs:up`, porque o servidor está de pé; quem
  está fora é o plano da conta.
- **GPT Image 2 aceita no máximo 5 referências** (contra 10 do Nano Banana). Se a
  persona tiver styles demais, o app corta os styles excedentes e avisa na tela —
  a face e a thumbnail do concorrente nunca são descartadas, porque o prompt
  depende delas estarem na primeira e na última posição.
- **Claude (CLI Proxy)** é acessível pela internet, então funciona da VPS direto.
- **Módulo nativo:** o Dockerfile já copia o binário do `better-sqlite3`. Se
  aparecer erro de `better_sqlite3.node` no runtime, veja o passo de cópia da
  cadeia no `Dockerfile` (better-sqlite3 + bindings + file-uri-to-path).

---

## 7. Redeploys

Todo push na branch `master` pode disparar redeploy automático (se você ligar o
webhook no Coolify). O volume `/app/data` persiste entre deploys.
