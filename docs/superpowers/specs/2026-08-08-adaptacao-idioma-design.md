# Adaptação de idioma dos textos detectados — modo Remodelar

**Data:** 2026-08-08
**Status:** implementado

## Problema

No modo Remodelar, a análise da thumbnail concorrente detecta os textos e
preenche a lista de swaps com o campo de substituição **vazio**. O usuário
digita cada um à mão. Quem recria thumbnails de canais estrangeiros faz isso
dezenas de vezes por semana, e uma thumb no estilo "história" tem mais de doze
linhas.

Traduzir literalmente não serve: o gancho que funciona em inglês não é o mesmo
que funciona em italiano, e a frase traduzida costuma não caber no espaço.

## Decisões

### Uma chamada para todos os textos, não uma por frase

As frases dividem a mesma imagem e frequentemente formam uma narrativa contínua
que quebra entre linhas. Enviadas juntas, o modelo mantém a continuidade,
evita repetir palavras e preserva a hierarquia entre manchete e legenda.

Validado no teste: a frase `MANAGER, "FAMILY FIRST-SHE'LL THANK` / `US LATER."`
virou `DIRETTORE: "LA FAMIGLIA PRIMA, CI` / `RINGRAZIERÀ."` — a continuação
atravessa a quebra de linha corretamente, o que uma chamada por frase não teria
como acertar.

### Orçamento numérico de caracteres por item

`max(n + 3, ceil(n * 1.15))`, onde `n` é o comprimento do original.

A primeira versão usava instrução qualitativa ("mantenha próximo do original").
No teste com cinco textos, dois estouraram em 4-5 caracteres. Com o orçamento
explícito por item, doze de doze ficaram dentro.

A folga é proporcionalmente maior em textos curtos: `"TO"` não tem adaptação
possível em dois caracteres, enquanto uma manchete de trinta tem margem de
reescrita.

### Teto de tokens proporcional à quantidade de textos

`min(8000, 1500 + n * 300)`.

O teto fixo de 2000 truncava o JSON no meio da resposta com doze textos — o
raciocínio interno também consome desse orçamento. O erro de "JSON inválido"
apontava para formato quando o problema era tamanho, então a mensagem passa a
detectar truncagem e dizer isso.

### Escopo

Apenas textos com `action === "replace"`. Os marcados como *Keep* ficam de fora
de propósito: "manter" costuma ser nome de marca ou termo que o usuário quer
preservar no original. *Remove* também sai.

Objetos não entram. São descrição de cena para o gerador de imagem, não texto
que aparece na thumbnail.

### Sobrescrita

Clicar em um idioma sobrescreve todos os campos em Swap, inclusive os
editados à mão. Preservar edições manuais quebraria a troca de idioma: depois
de adaptar uma vez, clicar em outro idioma não faria mais nada, sem explicação
visível.

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/engines/claude-adapt.ts` | Prompt de transcriação, orçamento de caracteres, parsing |
| `app/api/adapt-text/route.ts` | Validação, chamada, log |
| `components/workbench/remodel-mode.tsx` | Barra de idiomas (`LanguageBar`) |

Idiomas com atalho: PT-BR, inglês, espanhol, italiano, francês, alemão,
polonês e sueco, mais um campo livre em "Outro".

## Verificação

`npm run build` mais teste manual contra o Claude real:

1. Cinco textos → PT-BR: `"PROPERTY"/"TO"/"UGC"` virou `"IMÓVEL"/"VIRA"/"UGC"`
   — a construção foi adaptada (literal seria "PARA", que não faz sentido) e a
   sigla preservada.
2. Doze textos de uma thumb no estilo "história" → italiano: doze de doze
   dentro do orçamento, narrativa contínua atravessando as quebras de linha, e
   `"A DOLLAR"` localizado como `"UN EURO"`.
3. Falha do modelo: campos preservados, toast com o erro, entrada no `/logs`.

## Fora de escopo

Adaptar objetos, detectar o idioma de origem automaticamente, e memorizar o
último idioma usado.
