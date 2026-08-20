/**
 * Catálogo dos endpoints, usado pela página /api-docs.
 *
 * Dado, não texto solto: a página renderiza a partir daqui, então acrescentar
 * uma rota é acrescentar um objeto — a documentação não sai do lugar sozinha.
 *
 * Os contratos abaixo foram extraídos dos schemas reais em `lib/schema.ts` e
 * das próprias rotas, não escritos de memória.
 */

export interface EndpointParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface Endpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  /** Detalhe longo, quando o comportamento não é óbvio pelo resumo. */
  notes?: string;
  params?: EndpointParam[];
  body?: EndpointParam[];
  /** multipart/form-data em vez de JSON. */
  multipart?: boolean;
  response: string;
  curl: string;
}

export interface EndpointGroup {
  id: string;
  title: string;
  description: string;
  endpoints: Endpoint[];
}

const H = `-H "X-API-Key: SUA_CHAVE" -H "Content-Type: application/json"`;
const HK = `-H "X-API-Key: SUA_CHAVE"`;
const BASE = "https://thumbnail-factory.rotaclubs.com";

export const API_GROUPS: EndpointGroup[] = [
  // ────────────────────────────────────────────────────────────────────
  {
    id: "fluxo",
    title: "Fluxo de recriação",
    description:
      "A sequência completa para recriar a thumbnail de um concorrente com o seu texto, em qualquer idioma. É o caminho que o Hermes deve seguir.",
    endpoints: [
      {
        method: "GET",
        path: "/api/youtube",
        summary: "Baixa a thumbnail de um vídeo do YouTube",
        notes:
          "Aceita qualquer formato de URL do YouTube (youtu.be, watch?v=, shorts). Devolve o caminho relativo da imagem salva, que é o que os passos seguintes consomem.",
        params: [
          { name: "url", type: "string", required: true, description: "URL do vídeo" },
        ],
        response: `{
  "videoId": "wrQc-kgbVp0",
  "thumbRelPath": "competitors/wrQc-kgbVp0_1786243596046.jpg",
  "suggestedTitle": "I opened my banking app and saw…",
  "resolution": "max"
}`,
        curl: `curl ${HK} \\\n  "${BASE}/api/youtube?url=https%3A%2F%2Fyoutu.be%2FwrQc-kgbVp0"`,
      },
      {
        method: "POST",
        path: "/api/competitors/upload",
        summary: "Envia uma thumbnail de referência por arquivo",
        notes:
          "Alternativa ao /api/youtube quando a imagem não vem do YouTube. multipart/form-data, campo `file`. Limite de 64 MB.",
        multipart: true,
        body: [
          { name: "file", type: "arquivo", required: true, description: "PNG, JPG ou WebP" },
        ],
        response: `{ "path": "competitors/upload_1786243596046.jpg" }`,
        curl: `curl -X POST ${HK} \\\n  -F "file=@thumb.jpg" \\\n  ${BASE}/api/competitors/upload`,
      },
      {
        method: "POST",
        path: "/api/analyze-image",
        summary: "Lê a thumbnail e extrai textos, cores, objetos e composição",
        notes:
          "Usa Claude Opus 4.8 com visão. Devolve UMA ENTRADA POR LINHA de texto, na ordem de leitura — é isso que permite substituir linha a linha preservando o layout. O campo `composition` descreve apenas o layout; pessoas aparecem por papel, nunca por aparência.",
        body: [
          {
            name: "imagePath",
            type: "string",
            required: true,
            description: "Caminho devolvido por /api/youtube ou /api/competitors/upload",
          },
        ],
        response: `{
  "analysis": {
    "detectedText": [
      { "text": "MY PARENTS CUT ME OFF FOR 4", "position": "top-left",
        "color": "red", "style": "story-line" }
    ],
    "dominantColors": [ { "hex": "#000000", "name": "preto", "role": "background" } ],
    "objects": [ { "name": "cafeteria ao fundo", "position": "right-third" } ],
    "composition": "Left panel holds the story text; the right third holds the presenter",
    "suggestedHeadlineMainWhite": "…"
  }
}`,
        curl: `curl -X POST ${H} \\\n  -d '{"imagePath":"competitors/wrQc-kgbVp0_1786243596046.jpg"}' \\\n  ${BASE}/api/analyze-image`,
      },
      {
        method: "POST",
        path: "/api/adapt-text",
        summary: "Adapta os textos detectados para outro idioma",
        notes:
          "NÃO é tradução: reescreve o gancho com a gíria e os idiomatismos do país de destino, localizando moeda e instituições. Aceita QUALQUER idioma — os atalhos da interface são conveniência, e o campo é texto livre (\"Japonês\", \"espanhol rioplatense\", \"nigerian pidgin\"). Envie TODOS os textos numa chamada só: eles dividem a mesma imagem e frequentemente formam uma frase que quebra entre linhas, e o modelo precisa vê-los juntos para a continuação funcionar.",
        body: [
          {
            name: "targetLanguage",
            type: "string (2–60)",
            required: true,
            description:
              'Idioma de destino em texto livre. Ex.: "Brazilian Portuguese", "English (US)", "Latin American Spanish", "Italian", "French", "German", "Polish", "Swedish", "Japanese", "Turkish"…',
          },
          {
            name: "texts",
            type: "array (1–30)",
            required: true,
            description:
              "Itens { original, position?, style? }. `original` até 600 caracteres. `position` e `style` vêm da análise e melhoram o resultado, pois informam o papel de cada linha.",
          },
        ],
        response: `{
  "adaptations": [
    { "original": "MY PARENTS CUT ME OFF FOR 4",
      "adapted": "MIS PADRES ME BORRARON POR 4" }
  ]
}`,
        curl: `curl -X POST ${H} \\\n  -d '{
    "targetLanguage": "Latin American Spanish",
    "texts": [
      { "original": "MY PARENTS CUT ME OFF FOR 4",
        "position": "top-left", "style": "story-line" },
      { "original": "YEARS LIKE I DIDN'"'"'T EXIST. THEN",
        "position": "upper-left", "style": "story-line" }
    ]
  }' \\\n  ${BASE}/api/adapt-text`,
      },
      {
        method: "POST",
        path: "/api/generate",
        summary: "Dispara a geração das variantes",
        notes:
          "Responde 202 imediatamente; a geração roda em segundo plano. Acompanhe por /api/status/{id}. Em `remodel`, `competitorPath` é obrigatório; em `from-scratch`, `concept`.",
        body: [
          {
            name: "mode",
            type: '"remodel" | "from-scratch"',
            required: false,
            description: 'Padrão "from-scratch".',
          },
          {
            name: "engine",
            type: '"auto" | "glabs"',
            required: true,
            description:
              'auto = cascata automática. glabs = Nano Banana Pro (Google), hoje o único provedor ativo — auto e glabs dão no mesmo. "chatgpt-auto" e "gpt-image-2" estão desativados temporariamente e devolvem 400.',
          },
          {
            name: "variantCount",
            type: "int 1–4",
            required: true,
            description: "Quantas variantes gerar.",
          },
          {
            name: "competitorPath",
            type: "string",
            required: false,
            description: "Obrigatório no modo remodel. Caminho da thumbnail de referência.",
          },
          {
            name: "personaId",
            type: "string",
            required: false,
            description:
              "Sem persona, a pessoa é inventada (mesmo gênero e faixa etária da referência, indivíduo diferente).",
          },
          {
            name: "textSwaps",
            type: "array",
            required: false,
            description:
              'Itens { original, action: "replace"|"keep"|"remove", replacement?, position?, style? }. É aqui que entram os textos adaptados.',
          },
          {
            name: "objectSwaps",
            type: "array",
            required: false,
            description: "Mesma forma dos textSwaps, para objetos da cena.",
          },
          {
            name: "concept",
            type: "string (≤800)",
            required: false,
            description: "Obrigatório no modo from-scratch. Vai literal para o gerador.",
          },
          {
            name: "extraInstructions",
            type: "string (≤500)",
            required: false,
            description: "Instruções adicionais livres.",
          },
          {
            name: "title",
            type: "string (≤200)",
            required: false,
            description: "Rótulo interno do batch. Não entra no prompt.",
          },
        ],
        response: `{ "generationId": "a99ke211ou1Q" }

// com aviso, quando referências foram cortadas pelo teto da engine:
{ "generationId": "…", "warnings": ["2 imagens de estilo foram descartadas…"] }`,
        curl: `curl -X POST ${H} \\\n  -d '{
    "mode": "remodel",
    "engine": "glabs",
    "variantCount": 4,
    "competitorPath": "competitors/wrQc_1786243596046.jpg",
    "textSwaps": [
      { "original": "MY PARENTS CUT ME OFF FOR 4",
        "action": "replace", "replacement": "MIS PADRES ME BORRARON POR 4",
        "position": "top-left", "style": "story-line" }
    ]
  }' \\\n  ${BASE}/api/generate`,
      },
      {
        method: "GET",
        path: "/api/status/{generationId}",
        summary: "Consulta o andamento da geração",
        notes:
          "Chame a cada 3–5 segundos. O status da geração é `pending`, `partial`, `completed` ou `failed`; cada variante tem o seu. Em falha, `errorDetail` traz a causa provável já interpretada.",
        response: `{
  "generation": { "id": "…", "status": "completed", "engineRequested": "glabs" },
  "variants": [
    { "variantIndex": 0, "status": "completed",
      "outputPath": "output/a99ke211ou1Q/variant_0.jpg" },
    { "variantIndex": 1, "status": "failed",
      "errorDetail": "400: INVALID ARGUMENT — Recusado por política…" }
  ],
  "persona": null
}`,
        curl: `curl ${HK} ${BASE}/api/status/a99ke211ou1Q`,
      },
      {
        method: "GET",
        path: "/api/files/{caminho}",
        summary: "Baixa a imagem gerada",
        notes:
          "O caminho é o `outputPath` devolvido pelo status. Responde com os bytes da imagem, não com JSON.",
        response: "Binário (image/jpeg ou image/png)",
        curl: `curl ${HK} -o variante.jpg \\\n  ${BASE}/api/files/output/a99ke211ou1Q/variant_0.jpg`,
      },
      {
        method: "DELETE",
        path: "/api/status/{generationId}",
        summary: "Apaga a geração e seus arquivos",
        response: `{ "ok": true }`,
        curl: `curl -X DELETE ${HK} ${BASE}/api/status/a99ke211ou1Q`,
      },
      {
        method: "DELETE",
        path: "/api/variants/{variantId}",
        summary: "Apaga uma variante específica",
        response: `{ "ok": true }`,
        curl: `curl -X DELETE ${HK} ${BASE}/api/variants/VARIANT_ID`,
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  {
    id: "personas",
    title: "Personas",
    description:
      "O apresentador do canal. Com persona, a pessoa gerada é a da foto anexada; sem persona, é inventada.",
    endpoints: [
      {
        method: "GET",
        path: "/api/personas",
        summary: "Lista as personas",
        response: `{ "personas": [ { "id": "…", "name": "Dr. Sara Maya",
  "channel": "…", "facePath": "personas/…/face.jpg",
  "stylePaths": ["…"], "lastUsedAt": 1786243596046 } ] }`,
        curl: `curl ${HK} ${BASE}/api/personas`,
      },
      {
        method: "POST",
        path: "/api/personas",
        summary: "Cria uma persona",
        notes:
          "Cria só o registro. A face precisa ser enviada em seguida por /api/personas/{id}/refs?kind=face — sem ela a persona não pode ser usada para gerar.",
        body: [
          { name: "name", type: "string (1–80)", required: true, description: "Nome" },
          { name: "channel", type: "string (≤80)", required: false, description: "Canal" },
          { name: "notes", type: "string (≤500)", required: false, description: "Observações" },
        ],
        response: `{ "persona": { "id": "jURIiAh5nF", "name": "…", "facePath": "" } }`,
        curl: `curl -X POST ${H} \\\n  -d '{"name":"Dr. Sara Maya","channel":"Saúde"}' \\\n  ${BASE}/api/personas`,
      },
      {
        method: "GET",
        path: "/api/personas/{id}",
        summary: "Detalha uma persona",
        response: `{ "persona": { … } }`,
        curl: `curl ${HK} ${BASE}/api/personas/PERSONA_ID`,
      },
      {
        method: "PATCH",
        path: "/api/personas/{id}",
        summary: "Edita nome, canal ou observações",
        body: [
          { name: "name", type: "string (1–80)", required: false, description: "" },
          { name: "channel", type: "string | null", required: false, description: "" },
          { name: "notes", type: "string | null", required: false, description: "" },
        ],
        response: `{ "persona": { … } }`,
        curl: `curl -X PATCH ${H} \\\n  -d '{"channel":"Novo canal"}' \\\n  ${BASE}/api/personas/PERSONA_ID`,
      },
      {
        method: "DELETE",
        path: "/api/personas/{id}",
        summary: "Apaga a persona e suas imagens",
        response: `{ "ok": true }`,
        curl: `curl -X DELETE ${HK} ${BASE}/api/personas/PERSONA_ID`,
      },
      {
        method: "POST",
        path: "/api/personas/{id}/refs",
        summary: "Envia a face ou uma imagem de estilo",
        notes:
          "multipart/form-data, campo `file`. `kind=face` substitui a face; `kind=style` acrescenta à lista. Limite de 64 MB por arquivo.",
        multipart: true,
        params: [
          {
            name: "kind",
            type: '"face" | "style"',
            required: true,
            description: "Qual papel a imagem cumpre",
          },
        ],
        body: [
          { name: "file", type: "arquivo", required: true, description: "PNG, JPG ou WebP" },
        ],
        response: `{ "persona": { … }, "path": "personas/…/face.jpg" }`,
        curl: `curl -X POST ${HK} \\\n  -F "file=@rosto.jpg" \\\n  "${BASE}/api/personas/PERSONA_ID/refs?kind=face"`,
      },
      {
        method: "DELETE",
        path: "/api/personas/{id}/refs",
        summary: "Remove uma imagem da persona",
        params: [
          {
            name: "path",
            type: "string",
            required: true,
            description: "Caminho relativo da imagem a remover",
          },
        ],
        response: `{ "persona": { … } }`,
        curl: `curl -X DELETE ${HK} \\\n  "${BASE}/api/personas/PERSONA_ID/refs?path=personas/ID/style_ab12.jpg"`,
      },
      {
        method: "POST",
        path: "/api/personas/{id}/refs/clone",
        summary: "Reaproveita uma imagem já gerada como estilo da persona",
        notes:
          "Copia um arquivo que já existe em data/ (tipicamente uma variante gerada) para a pasta da persona.",
        body: [
          {
            name: "fromPath",
            type: "string",
            required: true,
            description: "Ex.: output/a99ke211ou1Q/variant_0.jpg",
          },
        ],
        response: `{ "persona": { … }, "path": "personas/…/style_ab12.jpg" }`,
        curl: `curl -X POST ${H} \\\n  -d '{"fromPath":"output/a99ke211ou1Q/variant_0.jpg"}' \\\n  ${BASE}/api/personas/PERSONA_ID/refs/clone`,
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  {
    id: "apoio",
    title: "Apoio e consulta",
    description: "Histórico, sugestão de prompt e verificação de saúde.",
    endpoints: [
      {
        method: "GET",
        path: "/api/history",
        summary: "Lista as gerações, da mais recente para a mais antiga",
        params: [
          { name: "limit", type: "int", required: false, description: "Padrão 30" },
          { name: "cursor", type: "int", required: false, description: "Paginação (timestamp)" },
          { name: "personaId", type: "string", required: false, description: "Filtra por persona" },
        ],
        response: `{ "items": [ { "generation": { … }, "persona": { … },
  "thumbnail": "output/…/variant_0.jpg",
  "variantCount": 4, "completedCount": 4 } ], "nextCursor": 1786243596046 }`,
        curl: `curl ${HK} "${BASE}/api/history?limit=10"`,
      },
      {
        method: "POST",
        path: "/api/prompt-suggest",
        summary: "Sugere um conceito visual a partir de um rascunho",
        body: [
          { name: "draft", type: "string (≤2000)", required: false, description: "Rascunho" },
          { name: "personaName", type: "string (≤120)", required: false, description: "" },
          { name: "language", type: '"pt-BR" | "en"', required: false, description: "" },
        ],
        response: `{ "suggestion": "…" }`,
        curl: `curl -X POST ${H} \\\n  -d '{"draft":"médico apontando para exame","language":"pt-BR"}' \\\n  ${BASE}/api/prompt-suggest`,
      },
      {
        method: "GET",
        path: "/api/health",
        summary: "Estado das engines",
        notes:
          "Único endpoint que responde sem credencial — é o healthcheck do Coolify. Sem autenticação devolve apenas {\"status\":\"ok\"}; com chave ou sessão, o payload completo.",
        response: `{ "glabs": "up", "claude": "configured",
  "glabsBaseUrl": "https://…", "checkedAt": 1786243596046 }`,
        curl: `curl ${HK} ${BASE}/api/health`,
      },
      {
        method: "POST",
        path: "/api/settings/test",
        summary: "Testa a conexão com uma engine",
        body: [
          {
            name: "engine",
            type: '"glabs" | "claude"',
            required: true,
            description: "Qual engine testar",
          },
        ],
        response: `{ "ok": true, "detail": "Conectado em … (142ms)", "latency": 142 }`,
        curl: `curl -X POST ${H} \\\n  -d '{"engine":"glabs"}' \\\n  ${BASE}/api/settings/test`,
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  {
    id: "admin",
    title: "Administração",
    description:
      "Configuração, trilha de eventos e gestão das próprias chaves. Uma chave de API tem os mesmos poderes da sessão, então ela também alcança tudo aqui.",
    endpoints: [
      {
        method: "GET",
        path: "/api/settings",
        summary: "Lê a configuração das engines",
        notes:
          "Os valores secretos (chaves do G-Labs e do CLI Proxy) saem sempre MASCARADOS. Não há endpoint que devolva o texto puro.",
        response: `{ "settings": { "glabsBaseUrl": { "masked": "https://…", "source": "env" },
  "glabsApiKey": { "masked": "Jl7d••••••••yojE", "source": "db" } } }`,
        curl: `curl ${HK} ${BASE}/api/settings`,
      },
      {
        method: "POST",
        path: "/api/settings",
        summary: "Altera a configuração das engines",
        body: [
          { name: "glabsBaseUrl", type: "string", required: false, description: "" },
          { name: "glabsApiKey", type: "string", required: false, description: "" },
          { name: "cliProxyBaseUrl", type: "string", required: false, description: "" },
          { name: "cliProxyApiKey", type: "string", required: false, description: "" },
          { name: "cliProxyModel", type: "string", required: false, description: "" },
          { name: "cliProxyReasoningEffort", type: "string", required: false, description: "" },
        ],
        response: `{ "settings": { … } }`,
        curl: `curl -X POST ${H} \\\n  -d '{"cliProxyReasoningEffort":"high"}' \\\n  ${BASE}/api/settings`,
      },
      {
        method: "GET",
        path: "/api/logs",
        summary: "Consulta a trilha de eventos",
        params: [
          { name: "level", type: '"info"|"warn"|"error"', required: false, description: "" },
          { name: "scope", type: "string", required: false, description: "Ex.: engine, generation, auth" },
          { name: "q", type: "string", required: false, description: "Busca em mensagem e detalhe" },
          { name: "generationId", type: "string", required: false, description: "" },
          { name: "limit", type: "int (≤200)", required: false, description: "Padrão 100" },
          { name: "before", type: "int", required: false, description: "Paginação por id" },
        ],
        response: `{ "entries": [ { "level": "error", "scope": "engine",
  "message": "…", "errorCode": 400 } ],
  "counts": { "total": 128, "errors": 3, "warns": 9 }, "nextCursor": null }`,
        curl: `curl ${HK} "${BASE}/api/logs?level=error&limit=20"`,
      },
      {
        method: "DELETE",
        path: "/api/logs",
        summary: "Limpa a trilha de eventos",
        response: `{ "ok": true, "deleted": 128 }`,
        curl: `curl -X DELETE ${HK} ${BASE}/api/logs`,
      },
      {
        method: "GET",
        path: "/api/api-keys",
        summary: "Lista as chaves de API",
        notes: "Nunca devolve o valor da chave — apenas nome, prefixo e datas.",
        response: `{ "keys": [ { "id": "…", "name": "Hermes Agent",
  "prefix": "tf_live_a1b2c3", "createdAt": 1786243596046,
  "lastUsedAt": 1786299999999, "revokedAt": null } ] }`,
        curl: `curl ${HK} ${BASE}/api/api-keys`,
      },
      {
        method: "POST",
        path: "/api/api-keys",
        summary: "Cria uma chave de API",
        notes:
          "O campo `plaintext` aparece SÓ nesta resposta. Guarde na hora — não há como recuperá-lo depois.",
        body: [
          {
            name: "name",
            type: "string (1–60)",
            required: true,
            description: "Nome do sistema que vai usar a chave",
          },
        ],
        response: `{ "key": { "id": "…", "name": "Hermes Agent", "prefix": "tf_live_a1b2c3" },
  "plaintext": "tf_live_a1b2c3d4e5f6…" }`,
        curl: `curl -X POST ${H} \\\n  -d '{"name":"Hermes Agent"}' \\\n  ${BASE}/api/api-keys`,
      },
      {
        method: "DELETE",
        path: "/api/api-keys/{id}",
        summary: "Revoga uma chave",
        notes: "Efeito imediato e irreversível. O registro permanece, para preservar o rastro.",
        response: `{ "key": { …, "revokedAt": 1786299999999 } }`,
        curl: `curl -X DELETE ${HK} ${BASE}/api/api-keys/KEY_ID`,
      },
      {
        method: "POST",
        path: "/api/auth/login",
        summary: "Autentica por usuário e senha (cookie de sessão)",
        notes:
          "Usado pela interface. Um sistema externo não precisa disto — basta o header X-API-Key. Limite de 5 tentativas por IP a cada 15 minutos.",
        body: [
          { name: "username", type: "string", required: true, description: "" },
          { name: "password", type: "string", required: true, description: "" },
        ],
        response: `{ "ok": true }   // + cookie tf_session (httpOnly)`,
        curl: `curl -X POST -H "Content-Type: application/json" \\\n  -d '{"username":"…","password":"…"}' \\\n  ${BASE}/api/auth/login`,
      },
      {
        method: "POST",
        path: "/api/auth/logout",
        summary: "Encerra a sessão do navegador",
        response: `{ "ok": true }`,
        curl: `curl -X POST ${BASE}/api/auth/logout`,
      },
    ],
  },
];

export const TOTAL_ENDPOINTS = API_GROUPS.reduce(
  (n, g) => n + g.endpoints.length,
  0
);
