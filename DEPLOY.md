# Deploy — Desafio 30 Dias

O app tem dois modos de banco, escolhidos por variável de ambiente:

| Modo | Quando | Banco |
|---|---|---|
| **Vercel + Turso** | hospedagem serverless, sem disco persistente | Turso (SQLite hospedado), `TURSO_DATABASE_URL` obrigatório |
| **Servidor Node** (Docker, Fly.io, VPS) | um processo com disco persistente | arquivo SQLite em `/data` (uma única instância) |

O mesmo código de API roda nos dois. Os 26 testes passam nos dois motores (`npm test`); o que **não** foi testado é a conexão com um Turso remoto de verdade nem um deploy real na Vercel (isso exige contas suas).

Já validado localmente no modo servidor: a imagem Docker constrói, sobe como usuário não-root, passa no healthcheck, aceita SIGTERM (encerra limpo) e **os dados sobrevivem a reinício do container** quando `/data` é um volume.

## Opção Vercel + Turso

Na Vercel o disco some entre execuções, então um SQLite em arquivo perderia os dados. Por isso a função (`api/[...path].js`) **só funciona com o Turso** e responde 503 se `TURSO_DATABASE_URL` estiver ausente, em vez de gravar num banco que se perde.

**1. Criar o banco no Turso** (turso.tech, conta gratuita; instale o CLI `turso`):

```bash
turso auth login
turso db create enfermagem-fcmscsp          # escolha uma região próxima, se houver
turso db show enfermagem-fcmscsp --url      # → libsql://enfermagem-fcmscsp-SEU-USUARIO.turso.io
turso db tokens create enfermagem-fcmscsp   # → token (guarde, aparece uma vez)
```

As tabelas são criadas automaticamente na primeira requisição.

**2. Publicar na Vercel** (a forma mais simples é pelo GitHub):

1. Em vercel.com → *Add New… → Project* → importe o repositório `eduardo3071/enfermagem-fcmscsp`.
2. A Vercel detecta Vite (já definido no `vercel.json`). Não mude o comando de build.
3. Em *Environment Variables*, crie **`TURSO_DATABASE_URL`** e **`TURSO_AUTH_TOKEN`** com os valores do passo 1 (marque Production e Preview).
4. *Deploy*. Depois confira `https://SEU-PROJETO.vercel.app/api/health` → `{"ok":true}`.

Pelo terminal, o equivalente é `npm i -g vercel`, `vercel link`, `vercel env add TURSO_DATABASE_URL`, `vercel env add TURSO_AUTH_TOKEN` e `vercel --prod`.

**Pontos de atenção na Vercel**
- `vercel.json` fixa a região das funções em `gru1` (São Paulo). Se o seu plano não permitir escolher a região, remova a linha `"regions"`. Idealmente a região do Turso fica perto da das funções, porque cada requisição vai ao banco.
- O limite de requisições por IP é **por instância** da função (aproximado): serve contra abuso casual, não é uma barreira rígida.
- O plano gratuito da Vercel (Hobby) é para uso não comercial; confira os termos e os limites atuais de Vercel e Turso antes de divulgar.
- Backup: use `turso db shell enfermagem-fcmscsp .dump > backup.sql` (o `server/backup.js` é só para o SQLite local).

## Opção A — Fly.io (modo servidor, já configurada em `fly.toml`)

Pré-requisitos: conta no Fly.io (pede cartão) e o `flyctl` instalado.

```bash
cd desafio-30-dias
fly auth login
fly launch --no-deploy --copy-config --name SEU-NOME-UNICO --region gru
fly volumes create data --size 1 --region gru
fly deploy
fly open
```

- O volume `data` (1 GB, sobra de espaço) guarda o SQLite em `/data/data.db`.
- Mantenha **uma máquina só** (`fly scale count 1`): um volume não se monta em duas máquinas, e o SQLite não é compartilhado entre instâncias.
- Custo aproximado: uma máquina `shared-cpu-1x` com 256 MB + 1 GB de volume ficam na faixa de poucos dólares por mês. Confira o preço atual em fly.io/docs/about/pricing.
- Domínio próprio: `fly certs add seu.dominio.com.br` e aponte o DNS como o comando indicar.

## Opção B — Qualquer lugar com Docker (VPS, Railway, Render)

```bash
docker build -t desafio30 .
docker run -d --name desafio30 --restart unless-stopped \
  -p 8080:8080 -v desafio30-data:/data desafio30
```

- Atrás de proxy/HTTPS (nginx, Caddy, Railway, Render): mantenha `TRUST_PROXY=1` (já é o padrão da imagem) para o limite de requisições enxergar o IP real. **Sem proxy, rode com `-e TRUST_PROXY=0`**, senão alguém poderia forjar o cabeçalho de IP.
- Railway/Render: monte um volume/disco em `/data`. Planos gratuitos sem disco persistente **apagam o banco a cada deploy**: não use.
- Expor na porta 80/443 direto é desaconselhado; coloque um proxy com HTTPS na frente.

## Variáveis de ambiente

| Variável | Padrão na imagem | O que faz |
|---|---|---|
| `PORT` | `8080` | porta do servidor |
| `DB_PATH` | `/data/data.db` | arquivo SQLite (a pasta é criada se faltar) |
| `TRUST_PROXY` | `1` | confia em `Fly-Client-IP` / `X-Forwarded-For` para o IP do cliente |

## Antes de divulgar

- [ ] Abrir a URL, criar um grupo e entrar com um segundo aparelho pelo código.
- [ ] Conferir `https://SEU-APP/api/health` → `{"ok":true}`.
- [ ] Testar o link de convite `https://SEU-APP/?convite=CÓDIGO` no celular.
- [ ] Combinar com a Enfermagem quem é o **dono** de cada grupo (só ele gera novo código e inicia temporada).
- [ ] Decidir sobre **LGPD**: o app guarda nome/apelido, avatar e métricas de saúde (água, sono, atividade). O IMC fica só no aparelho, mas o ranking é visível ao grupo. Avise os participantes e tenha um responsável por pedidos de exclusão (o botão "Apagar todos os dados" já remove a pessoa do servidor).

## Backup do banco

O SQLite usa modo WAL: **não copie o arquivo `data.db` à mão** com o app rodando (a cópia pode sair inconsistente). Use o script, que funciona com o app no ar:

```bash
# local / VPS com Docker
docker exec desafio30 node --no-warnings server/backup.js /data/backup.db
docker cp desafio30:/data/backup.db ./backup.db

# Fly.io
fly ssh console -C "node --no-warnings server/backup.js /data/backup.db"
fly ssh sftp get /data/backup.db ./backup.db
```

Para restaurar, pare o app, substitua `/data/data.db` pelo backup (apague também `data.db-wal` e `data.db-shm`) e suba de novo. O Fly também mantém snapshots automáticos do volume (`fly volumes snapshots list`); confira a retenção atual na documentação deles.

## Atualizar

```bash
fly deploy       # build novo, troca a máquina, o volume permanece
```

Há uma breve indisponibilidade (segundos) durante a troca, porque só existe uma máquina. O app tolera isso: o ranking mostra "Tentar de novo" e o sync reenvia na próxima mudança.

## Limites a conhecer

- **Pontos são calculados no aparelho** e o servidor confia neles (com tetos). Serve para desafio entre colegas; para premiação real, mover o cálculo para o servidor.
- **Sem login/recuperação de conta:** quem perde o aparelho entra de novo pelo código e começa do zero.
- **Limite de requisições:** 1200/min por IP no geral e 30/min para criar/entrar em grupos. Uma turma atrás do mesmo Wi-Fi compartilha esse IP; se virar problema, ajuste `DEFAULT_LIMITS` em `server/app.js`.
- Uma instância só (SQLite). Para centenas de grupos simultâneos, avaliar Postgres.
