"use client";

import * as React from "react";

import { API_GROUPS, TOTAL_ENDPOINTS } from "@/lib/api-catalog";

/**
 * Versão para impressão / salvar em PDF.
 *
 * Abre em aba própria e chama window.print(), deixando o próprio navegador
 * gerar o PDF — sem biblioteca de PDF no bundle, e com o resultado
 * selecionável e pesquisável, que um PDF rasterizado não seria.
 *
 * Fundo branco e tinta preta de propósito: o app é escuro, e imprimir tema
 * escuro desperdiça toner e sai ilegível.
 */
export default function ApiPrintPage() {
  React.useEffect(() => {
    // Espera a fonte e o layout assentarem antes de abrir o diálogo.
    const id = window.setTimeout(() => window.print(), 700);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="print-root">
      <style>{`
        .print-root {
          background: #fff;
          color: #111;
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 11pt;
          line-height: 1.5;
          max-width: 190mm;
          margin: 0 auto;
          padding: 12mm 8mm;
        }
        .print-root h1 { font-size: 20pt; margin: 0 0 4pt; }
        .print-root h2 {
          font-size: 14pt; margin: 18pt 0 4pt;
          border-bottom: 1px solid #ddd; padding-bottom: 3pt;
          page-break-after: avoid;
        }
        .print-root h3 {
          font-size: 11pt; margin: 12pt 0 3pt; font-family: ui-monospace, monospace;
          page-break-after: avoid;
        }
        .print-root .ep { page-break-inside: avoid; margin-bottom: 10pt; }
        .print-root code, .print-root pre {
          font-family: ui-monospace, "Cascadia Code", monospace; font-size: 9pt;
        }
        .print-root pre {
          background: #f6f7f9; border: 1px solid #e3e6ea; border-radius: 4px;
          padding: 6pt; white-space: pre-wrap; word-break: break-word;
          page-break-inside: avoid;
        }
        .print-root table { width: 100%; border-collapse: collapse; margin: 4pt 0; }
        .print-root td, .print-root th {
          border: 1px solid #e3e6ea; padding: 3pt 5pt; font-size: 9pt;
          text-align: left; vertical-align: top;
        }
        .print-root .meth {
          display: inline-block; min-width: 46pt; font-weight: 700; font-size: 9pt;
        }
        .print-root .muted { color: #555; }
        .print-root .note {
          background: #fbfbe8; border-left: 3px solid #d9d06a;
          padding: 4pt 7pt; margin: 4pt 0; font-size: 9.5pt;
        }
        @media print {
          @page { margin: 12mm; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print" style={{ marginBottom: 16 }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Salvar em PDF
        </button>
        <span style={{ marginLeft: 10, fontSize: 12, color: "#555" }}>
          Escolha &ldquo;Salvar como PDF&rdquo; no destino da impressão.
        </span>
      </div>

      <h1>ThumbFast — API</h1>
      <p className="muted">
        {TOTAL_ENDPOINTS} endpoints · Base URL{" "}
        <code>https://thumbnail-factory.rotaclubs.com</code>
      </p>

      <h2>Autenticação</h2>
      <p>
        Todo endpoint aceita o header <code>X-API-Key</code>. A chave tem os mesmos
        poderes do login pela interface — inclusive apagar personas e alterar
        configurações. Trate-a como senha.
      </p>
      <pre>{`curl -H "X-API-Key: tf_live_..." \\
  https://thumbnail-factory.rotaclubs.com/api/personas`}</pre>
      <p className="muted">
        Sem credencial a resposta é <b>401</b>. A única exceção é{" "}
        <code>/api/health</code>, que responde sem autenticação — mas só com{" "}
        <code>{`{"status":"ok"}`}</code>.
      </p>

      <h2>Fluxo típico de recriação</h2>
      <ol>
        <li>
          <code>GET /api/youtube?url=…</code> → devolve <code>thumbRelPath</code>
        </li>
        <li>
          <code>POST /api/analyze-image</code> → devolve os textos, linha a linha
        </li>
        <li>
          <code>POST /api/adapt-text</code> → devolve as adaptações no idioma escolhido
        </li>
        <li>
          <code>POST /api/generate</code> → devolve <code>generationId</code>
        </li>
        <li>
          <code>GET /api/status/{"{id}"}</code> a cada 3–5s até <code>completed</code>
        </li>
        <li>
          <code>GET /api/files/{"{outputPath}"}</code> → baixa a imagem
        </li>
      </ol>

      {API_GROUPS.map((g) => (
        <section key={g.id}>
          <h2>{g.title}</h2>
          <p className="muted">{g.description}</p>
          {g.endpoints.map((ep) => (
            <div className="ep" key={`${ep.method} ${ep.path}`}>
              <h3>
                <span className="meth">{ep.method}</span> {ep.path}
              </h3>
              <p>{ep.summary}</p>
              {ep.notes && <p className="note">{ep.notes}</p>}

              {[
                ep.params?.length
                  ? { titulo: "Parâmetros de query", linhas: ep.params }
                  : null,
                ep.body?.length
                  ? {
                      titulo: ep.multipart
                        ? "Campos (multipart/form-data)"
                        : "Corpo (JSON)",
                      linhas: ep.body,
                    }
                  : null,
              ]
                .filter(Boolean)
                .map((bloco) => (
                  <div key={bloco!.titulo}>
                    <b style={{ fontSize: "9.5pt" }}>{bloco!.titulo}</b>
                    <table>
                      <tbody>
                        {bloco!.linhas.map((r) => (
                          <tr key={r.name}>
                            <td>
                              <code>{r.name}</code>
                              {r.required && <b> *</b>}
                            </td>
                            <td>
                              <code>{r.type}</code>
                            </td>
                            <td>{r.description || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

              <b style={{ fontSize: "9.5pt" }}>Resposta</b>
              <pre>{ep.response}</pre>
              <b style={{ fontSize: "9.5pt" }}>Exemplo</b>
              <pre>{ep.curl}</pre>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
