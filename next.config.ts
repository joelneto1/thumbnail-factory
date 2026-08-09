import type { NextConfig } from "next";

// Fixa a raiz do workspace no diretório DESTE arquivo (= raiz do projeto),
// nunca em cwd. Isso impede o Turbopack de inferir errado a raiz por causa
// de um package-lock.json órfão na pasta home (c:\Users\joeln), que fazia o
// build procurar 'tailwindcss' no lugar errado e quebrar a home.
const projectRoot = import.meta.dirname ?? process.cwd();

const nextConfig: NextConfig = {
  // Build standalone p/ Docker/Coolify: gera .next/standalone com server.js
  // e só as deps necessárias (imagem menor). better-sqlite3 fica external
  // (não é bundlado) e seu binário nativo é incluído no trace.
  output: "standalone",
  experimental: {
    // Com proxy.ts ativo, o Next bufferiza o corpo da requisição para permitir
    // leitura dupla — e o padrão de 10MB TRUNCA o que passar disso, sem erro:
    // o multipart chega cortado e o `formData()` simplesmente não acha o campo
    // "file". Foto de celular passa de 10MB com facilidade, então o upload de
    // persona quebrava com uma mensagem que apontava para o lugar errado.
    proxyClientMaxBodySize: "64mb",
  },
  turbopack: {
    root: projectRoot,
  },
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
