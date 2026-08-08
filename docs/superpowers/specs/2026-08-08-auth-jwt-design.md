# Autenticação (login + senha, sessão JWT) — Thumbnail Factory

**Data:** 2026-08-08
**Status:** aprovado, em implementação

## Problema

O app está deployado em `https://thumbnail-factory.rotaclubs.com` **sem
nenhuma autenticação**. Verificado em 2026-08-08 por requisição anônima:

```
GET /api/health  →  {"glabs":"up","claude":"configured",
                     "glabsBaseUrl":"https://joel.tail739437.ts.net", ...}
```

Consequências concretas do estado atual:

- Qualquer pessoa gera thumbnails consumindo as chaves G-Labs e CLI Proxy do dono.
- `GET /api/files/[...path]` serve qualquer arquivo sob `data/` sem verificação,
  com `Cache-Control: public` — expõe fotos de persona e thumbnails geradas.
- `POST /api/settings` permite reconfigurar as engines.
- `/api/health` vaza o hostname Tailscale da máquina do dono.

## Objetivo

Exigir login para todo acesso, com um único usuário. Nenhum segredo pode entrar
no repositório — ele é **público** desde 2026-08-08.

## Decisões

### Credenciais em variáveis de ambiente (não no banco)

`AUTH_USERNAME`, `AUTH_PASSWORD_HASH` (scrypt) e `AUTH_SECRET`, configuradas no
Coolify. Descartada a tabela `users` no SQLite: para um app single-user ela
exigiria uma tela de cadastro, que por sua vez precisaria ser protegida contra
quem chegasse primeiro. Trocar a senha = trocar a env var e redeployar.

O hash usa `scrypt` do `node:crypto` — sem `bcrypt`, evitando outra dependência
nativa a compilar no Docker (já temos o `better-sqlite3` dando trabalho).
Comparação com `timingSafeEqual`.

Formato do hash: `scrypt:<salt>:<hash>`, com `:` como separador. A primeira
versão usava `$`, o que quebrou na verificação: tanto o loader de env do Next
quanto o Docker Compose expandem `$NOME` como variável, e `scrypt$a$b` chegava
na aplicação como `"scrypt"` — login sempre negado, sem erro que apontasse a
causa. Salt e hash são hex, então `:` nunca colide.

### Sessão stateless via JWT em cookie httpOnly

JWT HS256 assinado com `jose`, validade de 7 dias com renovação deslizante.
Cookie `httpOnly` + `secure` + `sameSite=lax`. Sem estado no servidor: não cria
tabela nem depende do volume persistente.

`jose` é a única dependência nova, recomendada pela doc do próprio Next.

### Defesa em profundidade: `proxy.ts` + guarda nas rotas

A doc do Next 16 é explícita: Proxy serve para *optimistic check*, não como
solução de autorização. Somado ao histórico de bypass de middleware por header
(CVE-2025-29927), confiar só nele seria frágil.

Portanto:

- `proxy.ts` intercepta tudo — redireciona páginas para `/login`, devolve 401
  nas rotas `/api/*`.
- Cada rota de API chama `requireSession()`, que revalida o JWT por conta
  própria. Se o proxy for contornado, a rota ainda barra.

### Convenção de arquivo do Next 16

O arquivo é **`proxy.ts`** na raiz, não `middleware.ts` — renomeado no Next 16.
O runtime padrão dele passou a ser Node.js, e declarar `runtime` nele lança erro.

### Rotas públicas por necessidade

- `/login`, `/api/auth/login` — óbvio.
- `/api/health` — o healthcheck do Coolify depende dele. Sem sessão passa a
  devolver apenas `{"status":"ok"}`; com sessão, o payload completo. O
  healthcheck continua funcionando e o vazamento do hostname acaba.
- Assets estáticos (`/_next/*`, favicon, imagens do `public/`).

### Força bruta

Contador em memória: 5 tentativas por IP a cada 15 minutos, depois 429. A
aplicação roda em instância única, então memória basta — sem Redis.

## Arquivos

**Novos**

| Arquivo | Responsabilidade |
|---|---|
| `proxy.ts` | Intercepta requisições; redireciona ou devolve 401 |
| `lib/auth/session.ts` | Assina, verifica e grava/apaga o cookie de sessão |
| `lib/auth/password.ts` | Hash e verificação scrypt, em tempo constante |
| `lib/auth/guard.ts` | `requireSession()` para rotas de API |
| `lib/auth/rate-limit.ts` | Contador de tentativas por IP |
| `app/login/page.tsx` | Tela de login |
| `app/api/auth/login/route.ts` | Valida credenciais, cria sessão |
| `app/api/auth/logout/route.ts` | Destrói a sessão |

**Alterados**

- 16 arquivos de rota em `app/api/*` (22 handlers) — uma guarda em cada
- `app/api/health/route.ts` — payload reduzido quando sem sessão
- `app/layout.tsx` e `components/shared/top-nav.tsx` — sair; nav só quando logado
- `package.json` / `package-lock.json` — `jose`
- `.env.example`, `DEPLOY.md` — documentar as 3 variáveis

## Verificação

O projeto não tem framework de teste, e este trabalho não é o momento de
introduzir um. Verificação por `npm run build` mais roteiro manual:

1. Sem cookie, `GET /` → redireciona para `/login`
2. Sem cookie, `GET /api/personas` → 401 JSON
3. Sem cookie, `GET /api/files/<qualquer>` → 401
4. Sem cookie, `GET /api/health` → `{"status":"ok"}` apenas
5. Senha errada → 401; na 6ª tentativa → 429
6. Senha certa → cookie gravado, acesso liberado
7. Com sessão, `GET /api/health` → payload completo
8. Logout → volta a barrar

## Fora de escopo

Múltiplos usuários, recuperação de senha, 2FA, OAuth. O app é single-user e
continua assim.
