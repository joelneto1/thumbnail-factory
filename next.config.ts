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
  turbopack: {
    root: projectRoot,
  },
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
