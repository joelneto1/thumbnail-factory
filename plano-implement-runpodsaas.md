# Especificação Técnica — Plataforma de Geração de Thumbnails com IA

> Documento de transferência para implementação no Claude Code.
> Contém arquitetura, decisões técnicas, modelo de negócio e roadmap.

---

## 1. Visão Geral do Projeto

### 1.1. O que é
Plataforma SaaS de geração e remodelagem de thumbnails para YouTube, Instagram Reels e TikTok, usando modelos de IA generativa próprios (FLUX.2) com infraestrutura serverless de GPU (RunPod), em vez de depender de APIs caras como Nano Banana / Gemini Image.

### 1.2. Estado atual
- Frontend já desenvolvido e funcional.
- Backend em fase de testes usando API do Nano Banana Pro (custo alto, inviável pra escalar).
- VPS Hetzner contratada com Coolify configurado.
- Próximo passo: substituir API externa por infraestrutura própria no RunPod com FLUX.2.

### 1.3. Diferencial competitivo
- **Custo por thumbnail ~40x menor** que concorrentes (Pikzels $0,267, Thumbmagic $0,29, nosso ~$0,025).
- **Pricing acessível pro mercado brasileiro** (BRL com PPP) + **competitivo pro mercado internacional** (USD).
- **Múltiplos workflows**: geração do zero, remodelagem por URL de competidor, edição cirúrgica.

---

## 2. Arquitetura Geral

### 2.1. Três camadas isoladas

```
┌─────────────────────────────────────────────────────┐
│  FRONTEND (já existe)                               │
│  - UI de geração e remodelagem                      │
│  - Polling/WebSocket pra status de jobs             │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP/WebSocket
                   ▼
┌─────────────────────────────────────────────────────┐
│  BACKEND (Hetzner + Coolify)                        │
│  - API de aplicação (Fastify ou FastAPI)            │
│  - Auth, billing, créditos, histórico               │
│  - Postgres + Redis                                 │
│  - Fila assíncrona (BullMQ ou Arq)                  │
│  - LLM pra prompt enrichment (Claude Haiku)         │
│  - Pós-processamento de imagens (tipografia)        │
│  - Storage no Cloudflare R2                         │
└──────────────────┬──────────────────────────────────┘
                   │ HTTPS (RunPod API)
                   ▼
┌─────────────────────────────────────────────────────┐
│  WORKERS GPU (RunPod Serverless)                    │
│  - Docker custom com diffusers                      │
│  - FLUX.2 klein 9B FP8 nos pesos                    │
│  - Network Volume com modelos                       │
│  - Webhook callback pro backend                     │
└─────────────────────────────────────────────────────┘
```

### 2.2. Decisão importante — NÃO usar ComfyUI em produção

**ComfyUI é ótimo pra prototipar, mas em produção tem 3 problemas:**

1. Cold start lento (carrega todos os custom nodes).
2. Workflow JSON é frágil (quebra quando custom node atualiza).
3. API HTTP foi feita pro frontend visual, é desajeitada pra integração.

**Estratégia adotada:** worker custom em Python com `diffusers` puro. Mais simples, mais rápido, mais previsível. ComfyUI fica só pra R&D local.

---

## 3. Stack Técnica Detalhada

### 3.1. Backend de aplicação

**Servidor:** Hetzner CCX13 (2 vCPU, 8GB RAM, ~€13/mês) com Coolify.

**Framework:** Node.js + Fastify **OU** Python + FastAPI.

**Banco de dados:** PostgreSQL (no mesmo servidor inicialmente).

**Fila:** Redis + BullMQ (Node) ou Redis + Arq (Python).

**Storage:** Cloudflare R2 (sem egress fee, crítico pra economia em escala).

**Observabilidade:** Sentry (erros) + Better Stack ou Axiom (logs).

**LLM pra prompt enrichment:** Claude Haiku ou GPT-4o-mini via API (~$0,0003/chamada).

### 3.2. Workers de GPU

**Plataforma:** RunPod Serverless.

**Modelo principal:** FLUX.2 klein 9B FP8 (~12GB VRAM, gera em ~3s em RTX 4090).

**GPU:** RTX 4090 24GB (~$0,34/hora) com fallback pra L40 ou A40.

**Pesos:** armazenados em **Network Volume do RunPod** (~$0,07/GB/mês), montado em todos os workers. Nunca embutidos no Docker image, nunca baixados no startup.

### 3.3. Configuração inicial do RunPod Serverless

```
Min Workers: 0           (pode subir pra 1-3 com tráfego constante)
Max Workers: 3           (escala conforme demanda real)
Idle Timeout: 30s        (mantém quente entre requests)
FlashBoot: ON            (reduz cold start pra 1-3s)
Container Disk: 10GB     (temp workspace)
Network Volume: 30GB     (pesos do FLUX.2 + adapters futuros)
GPU Priority: RTX 4090 → L40 → A40
```

---

## 4. Modelo de IA — Por que FLUX.2 klein

### 4.1. Justificativa
- **Open source** com licença permissiva (4B em Apache 2.0; 9B em FLUX Non-Commercial — verificar licença comercial separadamente se necessário).
- **Sub-segundo de inferência** (4 steps com step distillation).
- **Multi-reference editing nativo** — perfeito pra remodelagem de thumbnails sem precisar de LoRA.
- **Quantização FP8 disponível** — roda em RTX 4090 com folga.

### 4.2. Variante recomendada
**FLUX.2 klein 9B FP8** (`black-forest-labs/FLUX.2-klein-9b-fp8`):
- ~12GB VRAM
- ~3s por imagem em RTX 4090
- Qualidade comparável a modelos 5x maiores
- Suporta text-to-image E image-to-image na mesma arquitetura

### 4.3. Decisão sobre LoRA

**NÃO precisa treinar LoRA pra:**
- Geração genérica de thumbnails (FLUX.2 já foi treinado em conteúdo web-scale).
- Remodelagem de thumbnails de competidores (multi-reference editing nativo resolve).
- Edições cirúrgicas em cor/objeto/fundo (inpainting + SAM 2 resolve).
- Trocar rosto/inserir criador (PuLID-FLUX ou InstantID — adapters, não LoRA).

**LoRA pode fazer sentido depois pra:**
- Identidade visual da marca (look consistente do produto).
- Personas recorrentes do criador (treinado on-demand pelo usuário, $2-5/treino).
- Nichos verticais específicos.

**Estratégia inicial: zero LoRA.** Só implementar quando tiver caso de uso real validado que prompt + adapters não resolvem.

### 4.4. Decisão sobre texto na thumbnail

**Texto principal da thumbnail NÃO deve ser gerado pelo modelo de imagem.**

A própria BFL avisa no model card: *"text rendered may be inaccurate or subject to distortion."*

**Pipeline correto:**
1. Modelo de imagem gera a base **sem texto** ou com placeholder.
2. **Camada de tipografia em código** (Pillow, Skia, Satori, ou node-canvas) renderiza o texto por cima.
3. Sistema de templates de tipografia combina com estilo da imagem.

**Vantagens:**
- Controle total de fontes, kerning, stroke.
- Suporte multilíngue trivial (inclusive acentos PT-BR).
- Trocar a frase é instantâneo (não chama o modelo de imagem).
- Ideal pra A/B testing de manchetes.

Texto **dentro de elementos da cena** (placa, livro, tela) — aí FLUX.2 é ótimo, usa direto.

---

## 5. Implementação do Worker RunPod

### 5.1. Setup do Network Volume

1. RunPod Dashboard → Storage → Network Volumes.
2. Criar volume de **30GB** na região com RTX 4090 disponível (ex: `EU-RO-1`).
3. Criar Pod temporário (Pod normal, não serverless) com qualquer GPU barata, montar volume.
4. Baixar pesos:

```bash
cd /runpod-volume
huggingface-cli download black-forest-labs/FLUX.2-klein-9b-fp8 \
  --local-dir ./flux2-klein-9b-fp8
```

5. Encerrar Pod. Volume fica populado pra ser montado em qualquer worker serverless.

### 5.2. Dockerfile

```dockerfile
FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

RUN pip install --no-cache-dir \
    runpod \
    git+https://github.com/huggingface/diffusers.git \
    transformers \
    accelerate \
    sentencepiece \
    pillow

COPY handler.py /app/handler.py

CMD ["python", "-u", "/app/handler.py"]
```

### 5.3. handler.py (versão inicial — text-to-image)

```python
import os
import runpod
import torch
from diffusers import Flux2KleinPipeline
from PIL import Image
from io import BytesIO
import base64

MODEL_PATH = "/runpod-volume/flux2-klein-9b-fp8"

# Carrega UMA vez no boot do container
print("Loading FLUX.2 klein 9B FP8...")
pipe = Flux2KleinPipeline.from_pretrained(
    MODEL_PATH,
    torch_dtype=torch.bfloat16,
).to("cuda")
print("Model loaded.")

def handler(job):
    inp = job["input"]
    mode = inp.get("mode", "generate")

    if mode == "generate":
        image = pipe(
            prompt=inp["prompt"],
            width=inp.get("width", 1280),
            height=inp.get("height", 720),
            num_inference_steps=4,
            guidance_scale=inp.get("guidance", 3.5),
            generator=torch.Generator(device="cuda").manual_seed(inp.get("seed", 0)),
        ).images[0]
    elif mode == "remodel":
        # TODO: implementar com Flux2KleinKVPipeline e reference image
        raise NotImplementedError("Remodel mode coming next iteration")
    else:
        raise ValueError(f"Unknown mode: {mode}")

    buffer = BytesIO()
    image.save(buffer, format="PNG")
    img_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return {"image": img_b64}

runpod.serverless.start({"handler": handler})
```

### 5.4. Build e deploy

```bash
docker build -t SEU_USUARIO/thumb-worker:v1 .
docker push SEU_USUARIO/thumb-worker:v1
```

Configurar Serverless Endpoint no RunPod com a imagem acima e o Network Volume.

---

## 6. Fluxo Completo Backend → RunPod → Frontend

```
[Frontend]
   ↓ POST /generate
[Backend]
   ├─ Valida usuário, plano, contador de thumbnails
   ├─ Enriquece prompt com LLM (Claude Haiku)
   ├─ Cria job no Postgres (status: queued)
   ├─ Coloca na fila Redis
   └─ Devolve job_id pro frontend (instantâneo)
        ↓
[Worker da fila]
   ├─ Pega job da fila
   ├─ POST /v2/{endpoint}/run no RunPod (com webhook URL)
   └─ Atualiza status pra "processing"
        ↓
[RunPod Serverless]
   ├─ Sobe worker se preciso (cold start invisível pro usuário)
   ├─ Carrega modelo (se cold start)
   ├─ Roda inferência (~3s)
   └─ POST no webhook do backend com a imagem em base64
        ↓
[Backend recebe webhook]
   ├─ Decoda base64
   ├─ Pós-processamento (renderiza tipografia)
   ├─ Upload pro Cloudflare R2
   ├─ Atualiza job no Postgres (status: completed, url: ...)
   ├─ Decrementa contador de thumbnails do usuário
   └─ Notifica frontend via WebSocket/SSE
        ↓
[Frontend exibe thumbnail]
```

### 6.1. Pontos críticos de implementação

**Fila assíncrona é OBRIGATÓRIA.** Cold start de 15-40s mata request HTTP síncrono. Frontend deve receber `job_id` imediatamente e fazer polling/WebSocket.

**Webhook do RunPod precisa:**
- Ser endpoint público no backend (`POST /webhook/runpod`).
- Validar header secreto pra confirmar origem.
- Ser idempotente (e se chegar 2x?).
- Tratar falhas (e se a inferência falhou?).

**Reconciliação de jobs órfãos:** cron rodando a cada 5min checa jobs em `processing` há mais de X minutos via `GET /v2/{endpoint}/status/{id}` do RunPod.

**Métricas a registrar no Postgres** (cada job):
- `created_at`, `started_at`, `finished_at`
- `cold_start: bool`
- `worker_id`
- `cost_usd`
- `mode` (generate/remodel)
- `variations_count`

---

## 7. Variações de Thumbnail

### 7.1. Decisão de produto
Usuário pode pedir 1, 2, 3 ou 4 variações por geração. **Cada variação consome 1 thumbnail do plano** (4 variações = 4 thumbnails).

### 7.2. Implementação técnica
**Abordagem escolhida:** N jobs paralelos.

```javascript
const jobs = await Promise.all(
  [seed1, seed2, seed3, seed4].map(seed =>
    queue.add('generate', { ...input, seed })
  )
);
```

Os 4 jobs caem na fila simultaneamente. Workers do RunPod processam em paralelo (até o `Max Workers`). Frontend recebe cada variação assim que chega (UX progressivo com placeholders cinzas + fade-in).

### 7.3. Diversidade entre variações
Usar seeds bem espalhados (`Math.random() * 1e9` em vez de seeds sequenciais).

**Opcional (V2):** prompt augmentation pra forçar diversidade visual real:
- Variação 1: prompt original.
- Variação 2: prompt + "wider shot, more background".
- Variação 3: prompt + "closer crop, dramatic lighting".
- Variação 4: prompt + "alternative composition, different angle".

Começar com seeds diferentes apenas; adicionar augmentation quando o pipeline estiver maduro.

---

## 8. Modelo de Negócio

### 8.1. Estrutura de planos

| Plano | Thumbnails/mês | BRL Mensal | BRL Anual (25% off) | USD Mensal | USD Anual (25% off) |
|---|---|---|---|---|---|
| Starter | 100 | R$29,90 | R$269 | $17 | $149 |
| Pro | 500 | R$89,90 | R$809 | $35 | $309 |
| Business | 3.000 | R$249,90 | R$2.249 | $75 | $669 |
| Enterprise | Custom | Sob consulta | Sob consulta | Custom | Custom |

### 8.2. Decisões de pricing

- **NÃO oferecer "Unlimited"** no Business. 3000 é alto o suficiente pra 99,9% dos usuários, mas protege contra abuso.
- **Pricing diferenciado por mercado** (PPP — Purchasing Power Parity): brasileiro paga em BRL com preços localizados, internacional em USD com preços de mercado global.
- **Anti-arbitragem:** plano BRL aceita só cartão emitido no Brasil ou Pix. Plano USD aceita cartão internacional.
- **25% de desconto anual** comunicado como **"3 meses grátis"** (mais persuasivo que percentual).
- **Lançamento como "early bird":** pricing atual é de lançamento; comunicar que vai subir em 6 meses (cria urgência genuína + grandfathering pra early adopters).

### 8.3. Custo real por thumbnail (margem)

| Componente | Custo |
|---|---|
| GPU (RTX 4090, 3s + idle) | ~$0,0015 |
| LLM enrichment (Claude Haiku) | ~$0,0003 |
| Storage + bandwidth (R2) | ~$0,0001 |
| **Total** | **~$0,002 por thumbnail** |

**Margem por plano (cenário extremo, uso 100%):**
- Starter ($17): margem ~98% ($16,80 lucro bruto)
- Pro ($35): margem ~97% ($34 lucro bruto)
- Business ($75): margem ~92% ($69 lucro bruto)

Realidade: usuários médios consomem 20-40% do limite. Margem real fica ainda mais alta.

### 8.4. Stripe — integração de billing

- **Stripe Checkout** (página hospedada) na fase inicial — PCI compliance trivial, suporta Pix, cartão, boleto.
- **Webhooks essenciais:**
  - `customer.subscription.created` → libera plano.
  - `customer.subscription.updated` → mudança de plano.
  - `customer.subscription.deleted` → revoga acesso.
  - `invoice.payment_failed` → dunning.
  - `invoice.payment_succeeded` → reseta contador mensal de thumbnails.
- **Reset de contador:** baseado no `billing_cycle_anchor` do Stripe (dia da assinatura, não dia 1 do mês).
- **Trial:** 7 dias grátis no Starter, exigindo cartão (filtra ruído, conversão típica 15-30%).

### 8.5. Schema Postgres mínimo

```sql
-- users
id                          uuid PK
email                       text UNIQUE
created_at                  timestamp
stripe_customer_id          text
subscription_id             text
subscription_status         text  -- active, past_due, canceled
plan                        text  -- starter, pro, business, enterprise
thumbnails_used_this_cycle  int
plan_limit                  int   -- 100, 500, 3000, custom
cycle_resets_at             timestamp

-- jobs
id                  uuid PK
user_id             uuid FK
status              text  -- queued, processing, completed, failed
mode                text  -- generate, remodel
variations_count    int
prompt              text
enriched_prompt     text
reference_url       text  -- pra remodelagem
result_urls         jsonb -- array de URLs no R2
cost_usd            decimal
created_at          timestamp
started_at          timestamp
finished_at         timestamp
cold_start          boolean
worker_id           text
runpod_job_id       text
```

---

## 9. Roadmap de Implementação

### Fase 1 — Infra base (Semana 1-2)
- [ ] Subir backend Fastify/FastAPI no Coolify.
- [ ] Configurar Postgres + Redis.
- [ ] Implementar fila assíncrona (BullMQ/Arq).
- [ ] Implementar fluxo síncrono de signup, plano, billing via Stripe.
- [ ] Webhooks do Stripe funcionando.
- [ ] **Manter Nano Banana** ainda como provider de imagem nessa fase.

### Fase 2 — Worker RunPod (Semana 3)
- [ ] Criar Network Volume no RunPod e popular com FLUX.2 klein 9B FP8.
- [ ] Escrever Dockerfile + handler.py (modo `generate`).
- [ ] Build, push, criar Serverless Endpoint.
- [ ] Testar via API direto (Postman/curl).
- [ ] Integrar como segundo provider no backend (flag `provider`).

### Fase 3 — Migração progressiva (Semana 4)
- [ ] Rotear 10% do tráfego pro RunPod, 90% Nano Banana.
- [ ] Comparar qualidade, latência, custo lado a lado.
- [ ] Subir gradualmente (10% → 50% → 100%).
- [ ] Manter Nano Banana como fallback.

### Fase 4 — Remodelagem (Mês 2)
- [ ] Implementar modo `remodel` no handler com `Flux2KleinKVPipeline`.
- [ ] Adicionar yt-dlp ou fetch direto do `i.ytimg.com` no backend.
- [ ] ControlNet pra preservar composição da thumbnail original.
- [ ] Testar com casos reais.

### Fase 5 — Otimizações (Mês 3+)
- [ ] Min Workers = 1 em horário de pico (com base em analytics).
- [ ] Quantização NVFP4 (RTX 5090) se latência precisar baixar mais.
- [ ] Cache de prompts comuns (hash → R2).
- [ ] Pré-geração de "thumbnails base" populares.
- [ ] Top-up packs (créditos avulsos via Stripe).
- [ ] Considerar PuLID/InstantID pra feature de "personas" (avatares do usuário).

---

## 10. UX e Comportamento Esperado

### 10.1. Tempo de geração aceitável
- **Promessa ao usuário:** "até 1 minuto."
- **Realidade típica:** 3-10s (warm) ou 15-30s (cold start).
- **Estratégia:** sob-promete, sobre-entrega.

### 10.2. Frontend durante a espera
- Posição na fila visível ("você é o 3º na fila").
- Tempo estimado dinâmico (`fila × tempo_médio ÷ workers_ativos`).
- Placeholders cinzas pras variações solicitadas, fade-in conforme cada uma chega.
- Tipografia já aplicada num placeholder antes da imagem chegar (pra dar sensação de progresso instantâneo).

### 10.3. Fairness na fila
- **Round-robin por usuário:** intercala jobs entre usuários (evita 1 usuário com 5 jobs bloquear outros).
- **Tier-based priority:** paid prioritário sobre free.
  ```js
  await queue.add('generate', jobData, {
    priority: user.tier === 'paid' ? 1 : 10,
  });
  ```

---

## 11. Decisões NÃO tomadas (precisam ser definidas)

- [ ] **Linguagem do backend:** Node.js (Fastify) vs Python (FastAPI)?
- [ ] **Trial vs Freemium:** 7 dias grátis com cartão? Ou X thumbnails grátis pra sempre? Ou só pago?
- [ ] **Watermark no Starter:** sim ou não?
- [ ] **API pública:** apenas Enterprise inicialmente, ou Pro também (V2)?
- [ ] **Personas/avatares treináveis:** quando lançar essa feature?
- [ ] **Suporte a Instagram Reels (9:16):** já no MVP ou V2?

---

## 12. Estimativa de Custo Operacional (MVP)

Cenário: ~5.000 thumbnails geradas por dia (~150k/mês).

| Item | Custo mensal |
|---|---|
| Hetzner CCX13 + Coolify | ~€15 (~$16) |
| Cloudflare R2 (storage + egress) | ~$5 |
| RunPod Serverless RTX 4090 | ~$85 |
| Claude Haiku (LLM enrichment) | ~$45 |
| Stripe (taxa transação, ~3% receita) | variável |
| Sentry + Better Stack | ~$30 |
| **Total infra** | **~$181** |

Receita estimada com 200 clientes Pro ativos: 200 × $35 = $7.000/mês.

**Margem operacional bruta: ~97%.**

---

## 13. Recursos e Referências

### Modelos
- FLUX.2 klein 9B FP8: https://huggingface.co/black-forest-labs/FLUX.2-klein-9b-fp8
- FLUX.2 klein 9B KV (multi-reference otimizado): https://huggingface.co/black-forest-labs/FLUX.2-klein-9b-kv-fp8
- Repo oficial: https://github.com/black-forest-labs/flux2

### Infra
- RunPod Serverless: https://docs.runpod.io/serverless/overview
- Cloudflare R2: https://developers.cloudflare.com/r2/
- Coolify: https://coolify.io/docs/

### Billing
- Stripe Checkout: https://docs.stripe.com/payments/checkout
- Stripe Webhooks: https://docs.stripe.com/webhooks

### Adapters (pra fases futuras)
- PuLID-FLUX: identity preservation pra rostos.
- InstantID: alternativa ao PuLID.
- IP-Adapter: referência visual genérica.
- ControlNet: controle estrutural (pose, depth, canny).
- SAM 2: segmentação automática pra inpainting.

---

## 14. Próximas Ações Imediatas (Claude Code)

1. **Confirmar stack do backend** (Node ou Python) e gerar boilerplate inicial.
2. **Setup do Postgres** com schema da seção 8.5.
3. **Setup do Redis + fila assíncrona**.
4. **Endpoints da API:**
   - `POST /auth/signup`
   - `POST /auth/login`
   - `POST /generate` (cria job, retorna job_id)
   - `GET /jobs/:id` (status do job)
   - `POST /webhook/stripe`
   - `POST /webhook/runpod`
5. **Worker da fila:** consome jobs, chama RunPod, processa webhook.
6. **Integração Stripe:** Checkout, webhooks, sync de subscription.
7. **Em paralelo:** preparar Network Volume e Docker do worker no RunPod.

---

*Documento gerado a partir de discussão técnica completa sobre arquitetura, modelo de IA, infraestrutura, pricing e roadmap. Pronto pra implementação no Claude Code.*
