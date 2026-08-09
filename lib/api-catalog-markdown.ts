import { API_GROUPS, TOTAL_ENDPOINTS, type Endpoint } from "./api-catalog";

/**
 * Gera a documentação completa em Markdown a partir do mesmo catálogo que
 * alimenta a tela. Fonte única: acrescentar um endpoint atualiza os dois.
 *
 * Usado pelo botão de copiar, pelo download .md e pela versão de impressão.
 */

function paramTable(
  title: string,
  rows: Array<{ name: string; type: string; required: boolean; description: string }>
): string {
  const linhas = rows
    .map(
      (r) =>
        `| \`${r.name}\`${r.required ? " **\\***" : ""} | \`${r.type}\` | ${
          r.description || "—"
        } |`
    )
    .join("\n");
  return `**${title}**\n\n| Campo | Tipo | Descrição |\n|---|---|---|\n${linhas}\n`;
}

function endpointToMarkdown(ep: Endpoint): string {
  const partes: string[] = [`### \`${ep.method}\` ${ep.path}\n`, `${ep.summary}\n`];

  if (ep.notes) partes.push(`> ${ep.notes}\n`);
  if (ep.params?.length) partes.push(paramTable("Parâmetros de query", ep.params));
  if (ep.body?.length) {
    partes.push(
      paramTable(ep.multipart ? "Campos (multipart/form-data)" : "Corpo (JSON)", ep.body)
    );
  }

  partes.push(`**Resposta**\n\n\`\`\`json\n${ep.response}\n\`\`\`\n`);
  partes.push(`**Exemplo**\n\n\`\`\`bash\n${ep.curl}\n\`\`\`\n`);
  return partes.join("\n");
}

export function buildApiMarkdown(baseUrl = "https://thumbnail-factory.rotaclubs.com"): string {
  const partes: string[] = [];

  partes.push(`# ThumbFast — API\n`);
  partes.push(
    `Documentação dos ${TOTAL_ENDPOINTS} endpoints para consumo externo.\n`
  );
  partes.push(`**Base URL:** \`${baseUrl}\`\n`);

  partes.push(`## Autenticação\n`);
  partes.push(
    `Todo endpoint aceita o header \`X-API-Key\`. A chave tem os mesmos poderes do login pela interface — inclusive apagar personas e alterar configurações. Trate-a como senha.\n`
  );
  partes.push(
    `\`\`\`bash\ncurl -H "X-API-Key: tf_live_..." \\\n  ${baseUrl}/api/personas\n\`\`\`\n`
  );
  partes.push(
    `Sem credencial a resposta é **401**. A única exceção é \`/api/health\`, que responde sem autenticação — mas só com \`{"status":"ok"}\`.\n`
  );
  partes.push(
    `Gere e revogue chaves na aba **API** do sistema. O valor completo aparece na criação e pode ser copiado depois pela própria tela.\n`
  );

  partes.push(`## Fluxo típico de recriação\n`);
  partes.push(
    [
      "1. `GET /api/youtube?url=…` → devolve `thumbRelPath`",
      "2. `POST /api/analyze-image` com esse caminho → devolve os textos, linha a linha",
      "3. `POST /api/adapt-text` com os textos e o idioma de destino → devolve as adaptações",
      "4. `POST /api/generate` com os `textSwaps` já adaptados → devolve `generationId`",
      "5. `GET /api/status/{generationId}` a cada 3–5s até `completed`",
      "6. `GET /api/files/{outputPath}` → baixa a imagem",
    ].join("\n") + "\n"
  );

  for (const g of API_GROUPS) {
    partes.push(`## ${g.title}\n`);
    partes.push(`${g.description}\n`);
    for (const ep of g.endpoints) partes.push(endpointToMarkdown(ep));
  }

  partes.push(`---\n`);
  partes.push(
    `Gerado pelo ThumbFast. Os contratos acima refletem o código em produção.\n`
  );

  return partes.join("\n");
}
