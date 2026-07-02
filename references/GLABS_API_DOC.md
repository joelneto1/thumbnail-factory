# G-Labs Webhook API — Documentação

> **Base URL**: `http://127.0.0.1:8765` (local) ou via Tailscale: `https://joel.tail739437.ts.net`
> **Autenticação**: Header `X-API-Key` obrigatório (exceto `/api/health`)
> **Licença**: Plano MAX necessário

---

## Autenticação

Todos os endpoints (exceto health check) requerem o header:
```
X-API-Key: SUA_CHAVE_AQUI
```

Chave ausente ou inválida retorna `401 Unauthorized`:
```json
{"error": "invalid or missing API key"}
```

---

## Endpoints

### 1. Health Check

```
GET /api/health
```

Sem autenticação. Retorna status do servidor, uptime, tasks pendentes e em execução.

---

### 2. Geração de Imagem

```
POST /api/image/generate
Content-Type: application/json
X-API-Key: SUA_CHAVE
```

**Parâmetros:**

| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `prompt` | string | ✅ | — | Descrição da imagem |
| `model` | string | ❌ | `imagen4` | Modelo a usar |
| `count` | integer | ❌ | `1` | Quantidade (1–8) |
| `aspect_ratio` | string | ❌ | `1:1` | Proporção |
| `reference_images` | array | ❌ | — | Imagens base64 de referência |
| `upscale` | array | ❌ | — | `["2K"]`, `["4K"]` ou ambos |

**Modelos de imagem disponíveis:**

| Modelo | Descrição |
|--------|-----------|
| `imagen4` | Google Imagen 4 (text-to-image) |
| `nano_banana` | Nano Banana |
| `nano_banana_2` | Nano Banana 2 |
| `nano_banana_pro` | Nano Banana Pro (requer extensão Chrome) |

**Aspect ratios:** `1:1`, `16:9`, `9:16`, `4:3`, `3:4`

**Reference images:**

Para `imagen4` (Whisk), usar formato dict com categoria:
```json
{
  "reference_images": [
    {"data": "data:image/png;base64,IMAGEM_BASE64", "category": "subject"}
  ]
}
```
Categorias: `subject`, `scene`, `style`

Para `nano_banana_pro`, usar formato string direto:
```json
{
  "reference_images": ["data:image/png;base64,IMAGEM_BASE64"]
}
```

**Resposta (202 Accepted):**
```json
{
  "task_id": "abc12345",
  "status": "pending",
  "message": "Task queued for processing",
  "poll_url": "/api/status/abc12345"
}
```

---

### 3. Geração de Vídeo

```
POST /api/video/generate
Content-Type: application/json
X-API-Key: SUA_CHAVE
```

**Parâmetros:**

| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `prompt` | string | ✅ | — | Descrição do vídeo |
| `model` | string | ❌ | `veo_31_fast_relaxed` | Modelo Veo |
| `mode` | string | ❌ | `text_to_video` | Modo de geração |
| `aspect_ratio` | string | ❌ | `16:9` | Proporção |
| `resolution` | array | ❌ | `["720p"]` | Resolução |
| `reference_images` | array | ❌ | — | Obrigatório para modos não-texto |

**Modelos de vídeo disponíveis:**

| Modelo | Créditos | Nota |
|--------|----------|------|
| `veo_31_fast_relaxed` | 0 | Low priority (ULTRA only) |
| `veo_31_fast` | 10 | Prioridade normal |
| `veo_31_quality` | 100 | Maior qualidade |

**Modos:**

| Modo | Descrição | Reference images |
|------|-----------|-----------------|
| `text_to_video` | Texto → vídeo | Não necessário |
| `start_image` | Imagem inicial → vídeo | 1 imagem obrigatória |
| `start_end_image` | Imagem inicial + final → vídeo | 2 imagens obrigatórias |
| `components` | Componentes → vídeo | Obrigatório |

**Resoluções:** `["720p"]`, `["1080p"]`, `["4K"]`

**Aspect ratios:** `16:9`, `9:16`

**Duração:** Veo sempre gera vídeos de **8 segundos**

**Resposta (202 Accepted):**
```json
{
  "task_id": "def67890",
  "status": "pending",
  "message": "Task queued for processing",
  "poll_url": "/api/status/def67890"
}
```

**Exemplo — text-to-video:**
```json
{
  "prompt": "A cat walking on a sunny beach, cinematic lighting",
  "model": "veo_31_fast",
  "mode": "text_to_video",
  "aspect_ratio": "16:9",
  "resolution": ["720p"]
}
```

---

### 4. Status da Task

```
GET /api/status/{task_id}
X-API-Key: SUA_CHAVE
```

**Estados possíveis:** `pending` → `running` → `completed` | `failed`

**Resposta (completed):**
```json
{
  "task_id": "abc12345",
  "status": "completed",
  "results": [
    {"url": "/api/files/resultado_001.png", "filename": "resultado_001.png"}
  ]
}
```

**Resposta (failed):**
```json
{
  "task_id": "abc12345",
  "status": "failed",
  "error_code": 0,
  "error_detail": "No images generated"
}
```

---

### 5. Resultado da Task

```
GET /api/result/{task_id}
X-API-Key: SUA_CHAVE
```

Retorna dados focados nas URLs dos arquivos de output.

---

### 6. Listar Tasks

```
GET /api/tasks
X-API-Key: SUA_CHAVE
```

Retorna as 50 tasks mais recentes, ordenadas por data (mais recente primeiro).

---

### 7. Download de Arquivo

```
GET /api/files/{filename}
X-API-Key: SUA_CHAVE
```

Retorna o arquivo binário com `Content-Type` apropriado.

---

## Padrão de Polling

Tasks são **assíncronas**. Fluxo recomendado:

1. Submeter request de geração → recebe `task_id`
2. Aguardar 5-30 segundos
3. Poll `GET /api/status/{task_id}` a cada **5 segundos**
4. Quando `status: "completed"` → baixar arquivos das URLs em `results`

### Exemplo Python:
```python
import httpx
import time

BASE_URL = "https://joel.tail739437.ts.net"
API_KEY = "SUA_CHAVE"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

# 1. Submit
resp = httpx.post(f"{BASE_URL}/api/video/generate", headers=HEADERS, json={
    "prompt": "A cat walking on a sunny beach",
    "model": "veo_31_fast",
    "mode": "text_to_video",
    "aspect_ratio": "16:9",
    "resolution": ["720p"]
})
task_id = resp.json()["task_id"]

# 2. Poll
while True:
    time.sleep(5)
    status_resp = httpx.get(f"{BASE_URL}/api/status/{task_id}", headers=HEADERS)
    data = status_resp.json()

    if data["status"] == "completed":
        for result in data["results"]:
            # Download
            file_resp = httpx.get(f"{BASE_URL}{result['url']}", headers=HEADERS)
            with open(result["filename"], "wb") as f:
                f.write(file_resp.content)
        break
    elif data["status"] == "failed":
        print(f"Erro: {data.get('error_detail')}")
        break
```

---

## Status Codes HTTP

| Código | Descrição |
|--------|-----------|
| `200` | Sucesso |
| `202` | Task aceita/enfileirada |
| `400` | Request inválido (JSON malformado, campos faltando) |
| `401` | Autenticação falhou |
| `404` | Recurso não encontrado |
| `500` | Erro interno do servidor |

---

## Notas Importantes

- **nano_banana_pro** requer Chrome aberto com extensão G-Labs conectada ao `labs.google`
- **imagen4** funciona sem extensão (gera direto)
- **Veo 3.1** requer Chrome aberto com extensão G-Labs (mesmo que nano_banana_pro)
- O servidor G-Labs roda **localmente** na máquina, acessível via Tailscale
- Para `nano_banana_pro` use `aspect_ratio: "16:9"` ou `"9:16"` (não suporta `1:1`, `4:3`, `3:4`)
- Para `nano_banana_pro` use `reference_images` como array de **strings** (não dict)
