# G-Labs Webhook API — Documentação

> **Base URL**: `http://127.0.0.1:8765` (local) ou via Tailscale: `https://joel.tail739437.ts.net`
> **Autenticação**: Header `X-API-Key` obrigatório (exceto `/api/health` e `/api/files/{filename}`)
> **Licença**: Plano MAX necessário para o servidor Webhook
> **Versão de referência**: G-Labs Automation v8.0.0

> ⚠️ **Nunca cole a API key real neste arquivo.** O repositório é público. Os
> exemplos que o G-Labs mostra na própria interface vêm com a sua chave
> preenchida — troque por `SUA_CHAVE_AQUI` antes de copiar qualquer coisa
> para cá. A chave real vive apenas em `.env.local` (local, gitignored) e nas
> Environment Variables do Coolify.

---

## Autenticação

Todos os endpoints (exceto health check e download de arquivo) requerem:

```
X-API-Key: SUA_CHAVE_AQUI
```

Chave ausente ou inválida retorna `401`:

```json
{"error": "Invalid or missing API key"}
```

---

## Endpoints

| Método | Endpoint | Auth | Descrição |
|---|---|:---:|---|
| GET | `/api/health` | ✗ | Status do servidor, uptime e tarefas pendentes |
| POST | `/api/image/generate` | ✓ | Flow Image (Nano Banana / Veo) |
| POST | `/api/video/generate` | ✓ | Flow Video |
| POST | `/api/grok/generate` | ✓ | Grok AI (imagem e vídeo) |
| POST | `/api/meta/generate` | ✓ | Meta AI (imagem e vídeo) |
| POST | `/api/openai/generate` | ✓ | **OpenAI GPT Image 2** |
| GET | `/api/status/{task_id}` | ✓ | Status da task, progresso e detalhe de erro |
| GET | `/api/result/{task_id}` | ✓ | Resultado com URLs de download |
| GET | `/api/files/{filename}` | ✗ | Baixa o arquivo gerado |
| GET | `/api/tasks` | ✓ | Lista as 50 tasks recentes |

### Fluxo assíncrono

1. **Submeter** → `POST /api/{tipo}/generate` devolve `202` com `task_id`
2. **Consultar** → `GET /api/status/{task_id}` até `completed` ou `failed`
3. **Baixar** → cada URL do array `results` (sem auth)

Intervalo de polling sugerido: 3–5 segundos.

---

## Modelos disponíveis

| model | Nome | Proporções |
|---|---|---|
| `nano_banana_pro` | Nano Banana Pro | 1:1, 3:4, 4:3, 9:16, 16:9 |
| `nano_banana_2` | Nano Banana 2 | 1:1, 3:4, 4:3, 9:16, 16:9 |
| `nano_banana_2_lite` | Nano Banana 2 Lite | 1:1, 3:4, 4:3, 9:16, 16:9 |
| `veo_31_lite_relaxed` | Veo 3.1 Lite [prioridade baixa] | 16:9, 9:16 |
| `veo_31_fast` | Veo 3.1 Fast | 16:9, 9:16 |
| `veo_31_lite` | Veo 3.1 Lite | 16:9, 9:16 |
| `veo_31_quality` | Veo 3.1 Quality | 16:9, 9:16 |
| `omni_flash` | Omni Flash | 16:9, 9:16 |
| `grok-3` (t2i/i2i/t2v/i2v) | Grok 3 | 9:16, 16:9, 1:1, 2:3, 3:2 |
| `meta` (t2i/i2i/t2v/i2v) | Meta AI | 9:16, 16:9, 1:1 |
| `openai (GPT_IMAGE)` | **GPT Image 2** | 1:1, 3:2, 4:3, 16:9, 2:3, 3:4, 9:16 |

---

## Corpos de requisição

### Image — `POST /api/image/generate`

```jsonc
{
  "prompt": "sua descrição",        // obrigatório
  "model": "nano_banana_2",         // ver tabela (default nano_banana_2)
  "aspect_ratio": "16:9",           // default 1:1
  "reference_images": ["data:image/..."],  // opcional, até 10
  "upscale": ["2K"]                 // opcional: "2K" | "4K" (4K exige ULTRA)
}
```

### OpenAI GPT Image 2 — `POST /api/openai/generate`

```jsonc
{
  "prompt": "sua descrição",        // obrigatório
  "aspect_ratio": "1:1",            // 1:1, 3:2, 4:3, 16:9, 2:3, 3:4, 9:16
  "quality": "high",                // "low" | "medium" | "high" (default high)
  "prompt_mode": "auto",            // "auto" (reescreve) | "direct" (default auto)
  "reasoning": "none",              // none, low, medium, high, xhigh, max (default none)
  "web_search": false,              // grounding por busca (default false)
  "reference_images": ["data:image/..."]  // até 5, POSICIONAL, sem @tag
}
```

Sempre devolve **1 imagem**. Sem campo `model`, sem `upscale`. Saída limitada
a ~1.57 MP.

### Video — `POST /api/video/generate`

```jsonc
{
  "prompt": "descrição do movimento",
  "model": "veo_31_fast",
  "aspect_ratio": "16:9",           // 16:9 ou 9:16
  "mode": "text_to_video",          // text_to_video | start_image | start_end_image | components
  "reference_images": ["data:image/..."],  // obrigatório se mode != text_to_video
  "resolution": ["720p"],           // 720p | 1080p | 4K (4K exige ULTRA)
  "voice": "aoede",                 // só no mode components
  "video_length": 8                 // Veo 4/6/8 (4 e 6 exigem ULTRA); Omni Flash 4/6/8/10
}
```

### Grok — `POST /api/grok/generate`

```jsonc
{
  "prompt": "seu prompt",
  "mode": "t2i",                    // t2i | i2i | t2v | i2v
  "aspect_ratio": "9:16",
  "reference_images": ["data:image/..."],  // obrigatório em i2i/i2v, até 5
  "video_length": 6,                // 6 | 10 | 15 segundos
  "resolution": "480p"              // 480p | 720p (só vídeo)
}
```

Devolve **um** resultado por requisição (o primeiro gerado).

### Meta AI — `POST /api/meta/generate`

```jsonc
{
  "prompt": "seu prompt",
  "mode": "t2i",                    // t2i | i2i | t2v | i2v
  "aspect_ratio": "9:16",           // 9:16 | 16:9 | 1:1
  "resolution": "720p",             // 480p | 720p (só vídeo)
  "count": 1,                       // 1–4 saídas por prompt
  "character_image": "data:image/...",  // i2i
  "scene_image": "data:image/...",      // i2i
  "style_image": "data:image/...",      // i2i
  "start_image": "data:image/...",      // i2v (obrigatório)
  "end_image": "data:image/..."         // i2v (opcional)
}
```

Meta usa campos nomeados em vez do array `reference_images`.

---

## Imagens de referência

Formatos aceitos:

- Data URI: `"data:image/png;base64,iVBORw0KGgo..."`
- Base64 puro: `"iVBORw0KGgo..."`
- Objeto: `{"data": "...", "name": "arquivo.png", "category": "subject"}`

**Apenas Image e Veo** aceitam `@palavra` no prompt para amarrar imagens
nomeadas (casamento por substring no nome do arquivo, sem diferenciar
maiúsculas):

```json
{
  "prompt": "a @red_car next to a @house",
  "reference_images": [
    {"data": "data:image/png;base64,...", "name": "red_car.png"},
    {"data": "data:image/jpeg;base64,...", "name": "house.jpg"}
  ]
}
```

### Limites por endpoint

| Endpoint | Máximo de referências |
|---|---|
| `image` | 10 |
| `video` | 3 |
| `grok` | 5 |
| **`openai`** | **5** (posicional, sem `@tag`) |
| `meta` | usa campos nomeados |

---

## Respostas

### Submissão (202)

```json
{
  "task_id": "abc12345",
  "status": "pending",
  "message": "Task queued for processing",
  "poll_url": "/api/status/abc12345"
}
```

### Status — concluída

```json
{
  "task_id": "abc12345",
  "type": "image",
  "status": "completed",
  "prompt": "...",
  "created_at": 1707782400.0,
  "results": ["http://127.0.0.1:8765/api/files/image_001.png"],
  "completed_at": 1707782460.0
}
```

### Status — falhou

```json
{
  "task_id": "abc12345",
  "type": "image",
  "status": "failed",
  "error_code": 403,
  "error": "PERMISSION_DENIED",
  "error_detail": "403: PERMISSION_DENIED"
}
```

### Health

```json
{
  "status": "ok",
  "server": "G-Labs Webhook",
  "uptime": 123,
  "tasks_pending": 0,
  "tasks_running": 1
}
```

---

## Códigos de erro

| Código | Significado |
|---|---|
| `429` | Cota ou rate limit esgotado |
| `403` | Permissão negada |
| `400` | Requisição inválida / violação de política |
| `500` | Erro no servidor upstream |
| `0` | **Erro de validação/ambiente** |

**O `error_code` é evidência muito melhor que o texto do `error`.** O texto é
genérico e frequentemente aponta para o lugar errado — o caso clássico é o
código `0` no canal OpenAI, que devolve *"Invalid request. Check the prompt and
reference images (format/size)"* quando o problema não tem nada a ver com
prompt nem imagens (ver a seção de restrições). Sempre registre o `error_code`
junto do texto.

---

## Restrições operacionais

- Plano **MAX** exigido para o servidor Webhook
- Bind padrão `127.0.0.1:8765` (só localhost — a VPS chega via Tailscale)
- Até **10 tarefas simultâneas**; o excedente entra na fila
- **Image/Video**: exigem conta Google logada e habilitada (Gemini Pro/Ultra)
- **Grok**: exige conexão Super Grok ativa
- **Meta AI**: exige conta Meta logada e habilitada
- **OpenAI**: exige conta ChatGPT logada, habilitada e em **plano PAGO**
  (confirmado com o suporte da plataforma — conta Free falha com `error_code: 0`
  mesmo com `status=valid`); **máx. 5 threads por conta**
- Upscale 4K e vídeo 4K exigem ULTRA; 1080p funciona sem
- Tasks vivem só em memória — somem se o app reiniciar

> O G-Labs avisa na própria interface: *"Subscription only covers the
> automation tool. To actually generate images / videos, you still need
> accounts from the respective platforms (Gemini Pro / Ultra for Google Labs
> image / video, Super Grok for Grok Video, etc.)."*

---

## Exemplos (curl)

> Troque `SUA_CHAVE_AQUI` pela sua chave. **Cuidado:** a interface do G-Labs
> exibe esses mesmos exemplos já com a sua chave real preenchida — não copie
> de lá para lugares públicos.

```bash
# Health (sem auth)
curl http://127.0.0.1:8765/api/health

# Image — básico
curl -X POST http://127.0.0.1:8765/api/image/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SUA_CHAVE_AQUI" \
  -d '{"prompt": "a cat wearing sunglasses", "model": "nano_banana_2"}'

# Image — com referência
curl -X POST http://127.0.0.1:8765/api/image/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SUA_CHAVE_AQUI" \
  -d '{"prompt": "same person", "model": "nano_banana_2", "reference_images": ["data:image/png;base64,..."]}'

# Image — com upscale 4K (exige ULTRA)
curl -X POST http://127.0.0.1:8765/api/image/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SUA_CHAVE_AQUI" \
  -d '{"prompt": "modern house", "model": "nano_banana_pro", "reference_images": ["data:image/png;base64,..."], "upscale": ["4K"]}'

# Video — a partir de imagem inicial
curl -X POST http://127.0.0.1:8765/api/video/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SUA_CHAVE_AQUI" \
  -d '{"prompt": "flowing water", "mode": "start_image", "reference_images": ["data:image/png;base64,..."], "resolution": ["1080p"]}'

# Video — modo components com voz
curl -X POST http://127.0.0.1:8765/api/video/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SUA_CHAVE_AQUI" \
  -d '{"prompt": "she says hello", "mode": "components", "reference_images": ["data:image/png;base64,..."], "voice": "aoede"}'

# Grok — texto para imagem
curl -X POST http://127.0.0.1:8765/api/grok/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SUA_CHAVE_AQUI" \
  -d '{"prompt": "a girl swimming in a pool", "mode": "t2i", "aspect_ratio": "16:9"}'

# Grok — texto para vídeo
curl -X POST http://127.0.0.1:8765/api/grok/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SUA_CHAVE_AQUI" \
  -d '{"prompt": "neon city at night", "mode": "t2v", "aspect_ratio": "9:16", "video_length": 6, "resolution": "480p"}'

# Meta AI — texto para imagem
curl -X POST http://127.0.0.1:8765/api/meta/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SUA_CHAVE_AQUI" \
  -d '{"prompt": "a cat astronaut", "mode": "t2i", "aspect_ratio": "1:1", "count": 1}'

# Meta AI — imagem para imagem (componentes nomeados)
curl -X POST http://127.0.0.1:8765/api/meta/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SUA_CHAVE_AQUI" \
  -d '{"prompt": "same character in a forest", "mode": "i2i", "aspect_ratio": "16:9", "character_image": "data:image/png;base64,...", "scene_image": "data:image/png;base64,..."}'

# OpenAI GPT Image 2 — texto para imagem
curl -X POST http://127.0.0.1:8765/api/openai/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SUA_CHAVE_AQUI" \
  -d '{"prompt": "a modern minimalist house, golden hour", "aspect_ratio": "16:9", "quality": "high"}'

# OpenAI GPT Image 2 — com referências (posicionais, sem @tag)
curl -X POST http://127.0.0.1:8765/api/openai/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SUA_CHAVE_AQUI" \
  -d '{"prompt": "same subject on a beach", "aspect_ratio": "1:1", "reference_images": ["data:image/png;base64,..."]}'

# Consultar status
curl http://127.0.0.1:8765/api/status/TASK_ID -H "X-API-Key: SUA_CHAVE_AQUI"

# Listar tarefas recentes
curl http://127.0.0.1:8765/api/tasks -H "X-API-Key: SUA_CHAVE_AQUI"
```

---

## Armadilhas ao integrar

Aprendidas na prática, custaram tempo:

**1. A URL do resultado aponta para o host do G-Labs, não para o seu.**

O campo `results` traz URL **absoluta**, tipicamente
`http://127.0.0.1:8765/api/files/...`, porque é onde o G-Labs escuta. Se o seu
sistema roda em outra máquina (servidor, container, VPS), usar essa URL como
veio falha — `127.0.0.1` ali é o *seu* host, não o dele. **Descarte o host do
resultado e aproveite só o caminho**, reapontando para a base configurada:

```js
const parsed = new URL(rawResultUrl);
const url = `${BASE_URL}${parsed.pathname}${parsed.search}`;
```

O sintoma é confuso: a submissão passa, o G-Labs gera a imagem normalmente, e
só o download quebra.

**2. `prompt_mode: "auto"` reescreve o seu prompt (GPT Image 2).**

É o padrão. A OpenAI refina o texto antes de gerar, o que destrói prompts
estruturados — posições, blocos de preservação, referências por posição. Use
`"direct"` quando o prompt for engenheirado. Não há erro; o resultado só piora.

**3. `@tag` não funciona no canal OpenAI.**

Amarrar imagens por nome (`@red_car`) só existe em Image e Veo. No
`/api/openai/generate` as referências são **posicionais** — se o seu prompt
depende de qual imagem é qual, garanta a ordem no array.

**4. Os tetos de referência variam por endpoint** (10 / 3 / 5 / 5). Ao cortar
para caber, decida conscientemente o que descartar: se o prompt referencia
imagens por posição, remover a errada muda o significado sem gerar erro.

**5. As tasks vivem só em memória.** Reiniciar o G-Labs perde tudo que estava
em andamento. Trate `404` no status como "task perdida", não como erro
transitório a repetir.
