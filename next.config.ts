import type { NextConfig } from "next";

// Fixa a raiz do workspace no diretório DESTE arquivo (= raiz do projeto),
// nunca em cwd. Isso impede o Turbopack de inferir errado a raiz por causa
// de um package-lock.json órfão na pasta home (c:\Users\joeln), que fazia o
// build procurar 'tailwindcss' no lugar errado e quebrar a home.
const projectRoot = import.meta.dirname ?? process.cwd();

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
