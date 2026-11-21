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
- O limite **geral** de requisições é por instância da função (aproximado). Os limites de criar/entrar/recuperar e o bloqueio por tentativas erradas ficam **no banco** e valem em qualquer instância.
- O plano gratuito da Vercel (Hobby) é para uso não comercial; confira os termos e os limites atuais de Vercel e Turso antes de divulgar.
- Backup: veja a seção "Backup do banco" (`server/backup.js` exporta o Turso). Confira também no painel do Turso o que o seu plano oferece de restauração.

## Opção A — Fly.io (modo servidor, já configurada em `fly.toml`)

Pré-requisitos: conta no Fly.io (pede cartão) e o `flyctl` instalado.

```bash
cd enfermagem-fcmscsp
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
| `TURSO_DATABASE_URL` | (vazio) | se definida, usa o Turso em vez do arquivo SQLite (obrigatória na Vercel) |
| `TURSO_AUTH_TOKEN` | (vazio) | token do banco Turso |

## Antes de divulgar

- [ ] Abrir a URL, criar um grupo e entrar com um segundo aparelho pelo código.
- [ ] Conferir `https://SEU-APP/api/health` → `{"ok":true}`.
- [ ] Testar o link de convite `https://SEU-APP/?convite=CÓDIGO` no celular.
- [ ] Combinar com a Enfermagem quem é o **administrador** de cada grupo (só ele gera novo código, inicia temporada, remove membros e exclui o grupo).
- [ ] Testar a **recuperação**: criar uma conta com PIN, limpar os dados do navegador e voltar por "Recuperar acesso".
- [ ] Preencher `PRIVACY_CONTACT` em `src/config.js` com o e-mail do responsável (aparece na Política de Privacidade) e pedir uma revisão jurídica do texto.
- [ ] Decidir sobre **LGPD**: o app guarda nome/apelido, avatar e métricas de saúde (água, sono, atividade). O IMC, o peso e a altura ficam só no aparelho, mas o ranking é visível ao grupo. O app já traz Política de Privacidade e aceite no cadastro; avise os participantes e tenha um responsável por pedidos de exclusão (o botão "Apagar todos os dados" já remove a pessoa do servidor).

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

**Turso (Vercel):** o mesmo script exporta o banco em SQL quando `TURSO_DATABASE_URL` está definida. Rode no seu computador:

```bash
# PowerShell
$env:TURSO_DATABASE_URL="libsql://SEU-BANCO.turso.io"; $env:TURSO_AUTH_TOKEN="SEU-TOKEN"; node server/backup.js backup-turso.sql

# bash
TURSO_DATABASE_URL=libsql://SEU-BANCO.turso.io TURSO_AUTH_TOKEN=SEU-TOKEN node server/backup.js backup-turso.sql
```

Para restaurar, rode o arquivo num banco vazio (`turso db shell NOVO-BANCO < backup-turso.sql`) ou em um SQLite local. O ciclo exportar → restaurar foi testado com um banco libSQL (nomes com acento e apóstrofo voltam intactos). **O arquivo contém nomes, hashes de token/PIN e o histórico de todos:** guarde-o fora do repositório (o `.gitignore` ignora `backup*.sql` e `*.backup`) e apague quando não precisar mais.

## Atualizar um app que já está no ar

Esta versão **altera o esquema do banco** (migração v2: PIN de recuperação, metas, registros brutos e tabela de limites). Antes de publicar:

1. **Faça um backup** (seção acima).
2. Publique (na Vercel, um `git push` na branch de produção; no Fly, `fly deploy`).
3. A migração roda sozinha na primeira requisição depois do deploy. Ela só **acrescenta** colunas e uma tabela; os dados existentes são mantidos (testado com um banco no formato antigo, nos dois motores).
4. Quem já usava o app: aceita a política uma vez ao abrir; mantém o acesso ao grupo e os códigos antigos continuam valendo; no Perfil aparece o aviso para **definir o PIN** (quem já estava no grupo ainda não tem um). Abas abertas com a versão antiga continuam sincronizando, com os pontos limitados a 100 por dia, até recarregar.
5. **Voltar atrás é possível:** como a migração é aditiva, a versão anterior continua funcionando no banco já migrado.

```bash
fly deploy       # build novo, troca a máquina, o volume permanece
```

Há uma breve indisponibilidade (segundos) durante a troca, porque só existe uma máquina. O app tolera isso: o ranking mostra "Tentar de novo" e o sync reenvia na próxima mudança.

## Limites a conhecer

- **Pontos e sequência são calculados no servidor**, mas a partir de registros que o aparelho informa (água, minutos etc.): quem quiser mentir ainda pode, com ganho limitado a 100 pts/dia. Para premiação real isso não basta.
- **Recuperação por PIN, sem e-mail:** quem esquece o PIN e perde o aparelho não recupera a conta (entra de novo como pessoa nova; o administrador pode remover a conta antiga).
- **Limites de requisições:** 1200/min por IP no geral (por instância), 30/min para criar/entrar/recuperar e 10 tentativas erradas de código ou PIN a cada 10 min (estes dois últimos no banco). Uma turma atrás do mesmo Wi-Fi compartilha o IP; se virar problema, ajuste `DEFAULT_LIMITS` em `server/app.js`.
- **Lembrete** só com o app aberto (sem push).
- Uma instância só (SQLite). Para centenas de grupos simultâneos, avaliar Postgres.
