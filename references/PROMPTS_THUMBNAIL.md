# Prompts do Thumbnail Factory — recriar (remodelar) uma thumbnail

Documento portátil: contém tudo que é preciso para reproduzir o fluxo de
"recriar thumbnail" em outro sistema. Extraído de
[`lib/prompt.ts`](../lib/prompt.ts) e
[`lib/engines/claude-analyze.ts`](../lib/engines/claude-analyze.ts).

O fluxo tem **duas etapas com modelos diferentes**:

| Etapa | Modelo | Entrada | Saída |
|---|---|---|---|
| 1. Análise | Claude Opus (visão) | thumbnail do concorrente | JSON com textos, cores, objetos |
| 2. Geração | Nano Banana Pro / GPT Image 2 | prompt montado + imagens | a thumbnail nova |

Entre as duas, um humano edita o que quer trocar. A etapa 1 só **pré-preenche**
as opções; ela não decide nada sozinha.

---

## Etapa 1 — Análise da thumbnail concorrente

### System prompt

```
You are a precise vision analyst. You always return valid, minified JSON and nothing else.
```

### User prompt

Enviado junto com a imagem da thumbnail concorrente anexada.

```
You are analyzing a YouTube thumbnail to help a content creator remodel it with their own persona and message.

Extract from the attached image and return ONLY a JSON object with EXACTLY this shape (no prose, no markdown fences):

{
  "detectedText": [ { "text": "<literal text>", "position": "<e.g. top-left, center, banner-top>", "color": "<e.g. white, yellow, white-on-red>", "style": "<e.g. bold-banner, main-headline, small-caption>" } ],
  "dominantColors": [ { "hex": "#1a4fa0", "name": "<short PT-BR name>", "role": "<background|accent|text|banner>" } ],
  "objects": [ { "name": "<short PT-BR description, NOT text>", "position": "<e.g. center, right-third, lower-left>" } ],
  "composition": "<one-sentence layout summary>",
  "suggestedHeadlineTop": "<top banner text in CAPS, or omit>",
  "suggestedHeadlineMainWhite": "<main white headline in CAPS, or omit>",
  "suggestedHeadlineMainYellow": "<main yellow headline in CAPS, or omit>",
  "suggestedConcept": "<one-sentence ENGLISH concept describing the central hero object/scene, ready to reuse as a prompt>"
}

Rules:
- "detectedText": every readable text block, with its literal text, position, color and style/role.
- "dominantColors": top 3-5 colors with hex, a short PT-BR name and role.
- "objects": distinct visual objects/elements (NOT text), short PT-BR descriptions.
- Copy the original headline text into the suggested* fields, in CAPS.
- Be concise. Return ONLY the JSON.
```

### Parâmetros

| Parâmetro | Valor |
|---|---|
| `temperature` | `0.2` |
| `reasoning effort` | `low` |
| `max tokens` | `1500` |

Temperatura baixa é intencional: aqui se quer extração fiel, não criatividade.

### Tratamento da resposta

O modelo às vezes devolve o JSON dentro de cercas markdown — extraia o bloco
antes de dar parse. E trate `detectedText`, `dominantColors` e `objects` como
opcionais: normalize para array vazio quando faltarem, senão a interface quebra
com uma análise incompleta.

---

## Etapa 2 — Geração da thumbnail

O prompt é **montado dinamicamente**. Os blocos entram na ordem abaixo,
separados por uma linha em branco. Blocos marcados como condicionais só
aparecem quando se aplicam.

### Bloco 1 — Abertura (sempre)

```
YouTube thumbnail, 16:9, 1920x1080. You are REMODELING the thumbnail in the LAST attached reference image.
```

### Bloco 2 — Preservação (sempre)

```
Preserve EXACTLY from the anchor reference: layout, color palette, gradient direction, font weight and treatment, banner shapes, arrows, warning triangles, drop shadows, overall composition and visual hierarchy.
```

### Bloco 3 — Troca de pessoa (só com persona)

```
Replace the person/face shown in the anchor with the FIRST attached face reference — match that person's face, hair, outfit, expression EXACTLY. Keep them in the same position and scale as the original.
```

```
CRITICAL — SKIN TONE FIDELITY: replicate the EXACT skin color and tone of the attached face reference across ALL visible skin — face, neck, ears, arms and ESPECIALLY the HANDS. Every visible body part must share the same skin tone as the reference person. NEVER lighten, whiten, desaturate or otherwise alter the skin color. If the reference person has dark/Black skin, the hands and all skin must render in that same dark tone — the hands must NEVER come out lighter or a different color than the face.
```

> O bloco de tom de pele é longo e repetitivo de propósito. Os modelos tendem a
> clarear a pele, e as **mãos** erram com muito mais frequência que o rosto —
> daí a ênfase explícita nelas.

### Bloco 4 — Composição original (condicional)

Só quando há descrição de composição vinda da etapa 1.

```
Original composition: {composition}.
```

### Bloco 5 — Trocas de texto (condicional)

Cabeçalho, seguido de uma linha por troca ativa:

```
TEXT REPLACEMENTS — preserve original position, color, font style and size:
- Replace "{original}" ({position}) [{style}] → "{replacement}"
- REMOVE the original text "{original}" ({position}) [{style}]
```

`({position})` e `[{style}]` são omitidos quando vazios.

Os textos marcados para manter viram uma linha única:

```
Keep the following text exactly as in the anchor: "{texto A}", "{texto B}"
```

### Bloco 6 — Trocas de objeto (condicional)

```
OBJECT/SCENE REPLACEMENTS — preserve original position, scale, lighting and visual treatment:
- Replace {original} ({position}) → {replacement}
- REMOVE the {original} ({position})
```

```
Keep the following objects unchanged: {objeto A}, {objeto B}
```

### Bloco 7 — Fechamento (sempre)

```
Result must read clearly at 320x180 on a phone. NO watermarks, NO logos, NO brand names, NO faces other than the attached face reference.
```

### Bloco 8 — Instruções extras (condicional)

```
Additional instructions: {texto livre do usuário}
```

---

## ⚠️ A ordem das imagens é contratual

Este é o ponto que mais quebra ao portar para outro sistema, e quebra **em
silêncio** — sem erro, só resultado errado.

O prompt referencia as imagens **por posição**:

- `FIRST attached face reference` → a face da persona
- `LAST attached reference image` → a thumbnail a ser remodelada

Portanto o array de imagens deve ser sempre:

```
[ face da persona, ...imagens de estilo, thumbnail do concorrente ]
   ↑ primeira                              ↑ última
```

Se a engine impuser um teto de imagens, **descarte apenas as de estilo, do
meio**. Remover a face ou o concorrente — ou trocá-los de posição — faz o
modelo remodelar a imagem errada.

Sem persona, o bloco 3 não entra e a primeira posição some; a última continua
sendo a thumbnail a remodelar.

---

## Parâmetros das engines de imagem

### Nano Banana Pro (Google, via G-Labs)

```json
{
  "prompt": "<o prompt montado acima>",
  "model": "nano_banana_pro",
  "aspect_ratio": "16:9",
  "reference_images": ["data:image/...", "..."]
}
```

Até 10 imagens de referência.

### GPT Image 2 (OpenAI, via G-Labs)

```json
{
  "prompt": "<o prompt montado acima>",
  "aspect_ratio": "16:9",
  "quality": "high",
  "prompt_mode": "direct",
  "reasoning": "medium",
  "web_search": false,
  "reference_images": ["data:image/...", "..."]
}
```

Até 5 imagens de referência. Saída limitada a ~1.57 MP.

> **`prompt_mode: "direct"` é essencial.** No default (`auto`) a OpenAI
> reescreve o prompt antes de gerar, o que desmonta toda a estrutura acima —
> posições, blocos de preservação e as referências por posição. Se você portar
> isso e deixar `auto`, o resultado degrada sem mensagem de erro.

---

## Exemplo completo montado

Persona presente, quatro trocas de texto, um texto mantido, cinco objetos
mantidos:

```
YouTube thumbnail, 16:9, 1920x1080. You are REMODELING the thumbnail in the LAST attached reference image.

Preserve EXACTLY from the anchor reference: layout, color palette, gradient direction, font weight and treatment, banner shapes, arrows, warning triangles, drop shadows, overall composition and visual hierarchy.

Replace the person/face shown in the anchor with the FIRST attached face reference — match that person's face, hair, outfit, expression EXACTLY. Keep them in the same position and scale as the original.

CRITICAL — SKIN TONE FIDELITY: replicate the EXACT skin color and tone of the attached face reference across ALL visible skin — face, neck, ears, arms and ESPECIALLY the HANDS. Every visible body part must share the same skin tone as the reference person. NEVER lighten, whiten, desaturate or otherwise alter the skin color. If the reference person has dark/Black skin, the hands and all skin must render in that same dark tone — the hands must NEVER come out lighter or a different color than the face.

Original composition: Split before/after image of old house transforming into modern interior with a presenter on the right, headline across the bottom and a blue banner on top.

TEXT REPLACEMENTS — preserve original position, color, font style and size:
- Replace "PROPERTY" (bottom-left) [main-headline] → "PRÓPRIO"
- Replace "TO" (bottom-center) [main-headline] → "PARA"
- Replace "AI Intro Video" (bottom-center) [small-caption] → "Introdução de IA"

Keep the following text exactly as in the anchor: "REAL ESTATE AI ADS"

Keep the following objects unchanged: mansão antiga de tijolos, sala de estar moderna com sofá branco, seta branca, planta em vaso

Result must read clearly at 320x180 on a phone. NO watermarks, NO logos, NO brand names, NO faces other than the attached face reference.
```

---

## Etapa opcional: adaptar os textos para outro idioma

Roda entre a análise e a geração, quando se quer a thumbnail em outro idioma.
Não é tradução — é reescrita nativa.

### System prompt

```
You are a native YouTube thumbnail copywriter for the target language and country — not a translator. You write the hook the way a local creator in that country would have written it from scratch, using the slang, idioms and everyday references that actually circulate there. Word-by-word translation is a failure, not a fallback. You always return valid, minified JSON and nothing else.
```

### Blocos do user prompt

Cada item entra numerado, com posição, papel e **orçamento de caracteres**:

```
1. "STATE INSPECTORS WALKED INTO MY COFFEE SHOP"  [top-left, main-headline]  — MAX 49 characters
```

Orçamento: `max(n + 3, ceil(n * 1.15))`. Instrução qualitativa ("mantenha
próximo") é cumprida mal; número explícito por item funciona.

Depois, na ordem:

```
GOLDEN RULE — NEVER TRANSLATE WORD BY WORD:
Direct, mechanical translation is forbidden. Do not map English words onto {IDIOMA} words. Instead, ask what a native {IDIOMA} creator would have written to provoke the same reaction, and write THAT. If a native reader could tell the text was translated, you failed.

USE NATIVE IDIOM AND SLANG:
- Replace generic verbs and phrases with the vivid, colloquial expressions that circulate in everyday {IDIOMA} — the ones locals actually say, not textbook equivalents.
- Prefer a well-known local idiom over a literal phrase, whenever it carries the same drama.
- Localise references so they feel domestic: currency, institutions, units, everyday objects. Nothing should read as imported.

Worked example (English → French), showing the standard expected:

  Original:  "State inspectors walked into my coffee shop mid-rush"
  BAD  (literal):  "LES INSPECTEURS DE L'ÉTAT SONT ENTRÉS DANS MON CAFÉ"
  GOOD (native):   "LES INSPECTEURS ONT DÉBARQUÉ EN PLEIN COUP DE FEU"

Why the good one works: "ont débarqué" is how a French speaker says someone showed up unannounced, and "en plein coup de feu" is the standard restaurant-trade expression for the peak rush. Neither is a translation of the English words — both are what a French creator would have typed. Apply this same standard to {IDIOMA}.

KEEP THE SET COHERENT:
- The items share one image and often form a sentence that breaks across lines. Read them in order and make the continuation work grammatically from one line to the next.
- Preserve each item's role: a main-headline stays punchy, a small-caption stays secondary, a banner stays a label.
- Avoid repeating the same word across items.

HARD CONSTRAINT — LENGTH:
Each item above has a "MAX N characters" budget. Every adapted text MUST be at or under its budget — count the characters before answering. Shorter is always better.

PUNCTUATION — KEEP IT CLEAN FOR A THUMBNAIL:
- Use ONLY straight quotes (") when a quote is needed, and drop them entirely when the line reads fine without. NEVER use locale quote marks such as « », „ ", ‹ ›, 「 」, or curly quotes.
- Keep punctuation that carries emphasis (?, !, …). Drop decorative punctuation.
- No emoji, no markdown, no bold markers.

OTHER RULES:
- Return every item in UPPERCASE. Uppercase it in {IDIOMA}'s own rules, keeping accents (É, À, Ü, Ñ).
- Keep numbers as digits, and keep proper names and brand names unchanged.
```

Saída: `{"adaptations":[{"original":"...","adapted":"..."}]}`, na mesma ordem
da entrada.

### Parâmetros

`temperature 0.7` (transcriação exige escolher entre formulações),
reasoning `medium`, e `maxTokens = min(8000, 1500 + n * 300)` — teto fixo
trunca o JSON em thumbnails com muitas linhas.

### Duas coisas que o prompt sozinho não garante

**Sanitize a pontuação no código.** Mesmo proibido, o modelo às vezes devolve
guillemets. Normalize `« » „ " ‹ › 「 」` e aspas curvas para `"` reto antes de
usar.

**Case a resposta por posição, não pelo campo `original` devolvido.** O modelo
pode alterar levemente o texto original ao repeti-lo. Use sempre o original que
VOCÊ enviou.

### Resultado real deste prompt

Mesma frase, três idiomas:

| | Adaptação |
|---|---|
| Original | STATE INSPECTORS WALKED INTO MY COFFEE SHOP MID-RUSH |
| Francês | LES INSPECTEURS ONT DÉBARQUÉ EN PLEIN COUP DE FEU |
| Alemão | KONTROLLEURE PLATZTEN MITTEN IM ANSTURM IN MEIN CAFÉ |
| Espanhol LATAM | SE METIERON LOS INSPECTORES A MI CAFÉ EN PLENA HORA PICO |
| Japonês | 満席のカフェに保健所がいきなり乗り込んできた |
| Turco | YOĞUN SAATTE DENETÇİLER KAFEME DALDI |
| Nigerian Pidgin | NAFDAC PIPO BURST MY COFFEE SHOP FOR RUSH HOUR |

Repare que a **instituição** acompanha o país: 保健所 é a vigilância sanitária
japonesa e NAFDAC é a agência reguladora nigeriana real — nenhuma das duas é
tradução de "state inspectors".

O mesmo vale para moeda. `"I PULLED OUT ONE DOLLAR"` virou `1 EURO` em francês
e alemão, `UN PESO` em espanhol, `1円` em japonês, `1 LİRA` em turco e
`1 NAIRA` em pidgin nigeriano.

E a gíria regional aparece onde tradução nenhuma chegaria: `"YOU'RE DONE HERE"`
virou `AQUÍ YA VALISTE` em espanhol latino e `YOU DON FINISH HERE!` em pidgin.

### Funciona com qualquer idioma

Nada no prompt é específico dos idiomas oferecidos como atalho: o nome do
idioma é interpolado e o modelo faz o resto. Variantes regionais ("espanhol
rioplatense", "inglês britânico"), crioulos e línguas de escrita não-latina
funcionam igual. Os exemplos de japonês, turco e pidgin acima vieram todos por
texto livre.

Nota para escrita não-latina: a regra de CAIXA ALTA vira inócua em japonês,
chinês e árabe, que não têm distinção de caixa — o texto volta correto do
mesmo jeito. E o orçamento de caracteres fica folgado nesses idiomas, já que
eles são mais compactos que o inglês.

---

## Modo alternativo: gerar do zero

Quando não há thumbnail de referência, o prompt **não usa template nenhum**.
Entrega o conceito do usuário literal, com no máximo dois adendos:

```
{conceito do usuário, literal}

Use the person from the attached face reference — match their face, hair and outfit. Do not invent a different person. Replicate their EXACT skin tone across all visible skin including the HANDS — never lighten or whiten it; hands must match the same skin color as the face.

Use the attached competitor thumbnail only as a visual mood reference; do not copy its text or composition literally.
```

O segundo bloco só entra com persona; o terceiro só quando existe uma thumbnail
de referência servindo de inspiração (sem ser remodelada).

A ausência de template aqui é deliberada: instruções de layout e cor injetadas
automaticamente acabavam **virando texto dentro da imagem gerada** ou
enviesando a composição para longe do que o usuário pediu.
