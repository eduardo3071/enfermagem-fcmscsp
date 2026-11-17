# Desafio 30 Dias — Vida Saudável

Reconstrução do app da Enfermagem (originalmente no Base44) em React + Vite + Tailwind, com backend próprio (Node + SQLite) para grupos, convites e ranking compartilhado.

## Rodar

Requer Node 22.5+ (usa o `node:sqlite` embutido; não há dependências de backend).

```bash
npm install
npm run server     # API em http://localhost:3001 (banco: server/data.db)
npm run dev        # app em http://localhost:5173, com /api encaminhado ao servidor
```

Produção (um único processo serve o app e a API):

```bash
npm start          # build + servidor em http://localhost:3001
```

Variáveis: `PORT` (padrão 3001), `DB_PATH` (padrão `server/data.db`), `API_URL` (proxy do `npm run dev`).

Testes da API (22 casos, banco em memória): `npm test`.

**Publicar na internet:** veja [DEPLOY.md](DEPLOY.md) (Dockerfile e `fly.toml` prontos, backup, checklist e LGPD).

## Como funciona
- **Sem login.** Quem cria ou entra num grupo recebe um token guardado no aparelho (no servidor fica só o hash). Quem perde o token precisa entrar de novo pelo código.
- **O que sai do aparelho:** nome, avatar, pontos por dia, água, minutos de atividade, horas de sono e sequência. **Peso, altura e IMC nunca são enviados.**
- **Sincronização:** a cada mudança no registro, o app envia os dias da temporada (com 800 ms de espera) e recarrega o ranking. O ranking também atualiza a cada 20 s e ao trocar de aba.
- **Dono do grupo** (quem criou) pode gerar novo código (o antigo deixa de valer) e iniciar nova temporada, que zera os pontos de todos; os outros aparelhos adotam a nova temporada ao atualizar o ranking.
- **Compartilhar progresso no grupo** desligado: a pessoa some do ranking dos outros, mas continua vendo o próprio.
- **Convite por link:** `/?convite=CÓDIGO` abre direto a tela de entrada com o código preenchido.
- **Títulos do grupo** (Hidratação, Consistência, Treino, Sono) vão para quem lidera cada métrica na temporada.

## API
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/groups` | cria grupo e o primeiro membro (dono) |
| POST | `/api/groups/join` | entra com código |
| GET | `/api/groups/:code/ranking` | ranking geral, por semana, títulos |
| POST | `/api/groups/:code/code` | novo código (dono) |
| POST | `/api/groups/:code/season` | nova temporada (dono) |
| PUT | `/api/sync` | envia dias, sequência e preferência de compartilhar |
| DELETE | `/api/me` | apaga o membro e seus dados |

## Telas
Onboarding (4 passos) → criar/entrar em grupo → Início, Hoje, botão **+**, Ranking, Perfil. O resumo **KDIGO 2024** (DRC) fica no card "Aprender" do Início (`src/kdigo.js`).

## Limitações conhecidas
- **Os pontos são calculados no aparelho e confiados pelo servidor.** O servidor limita valores absurdos (200 pts/dia, datas só dentro da temporada), mas alguém técnico pode forjar a própria pontuação. Para um desafio entre colegas basta; para prêmios, o cálculo teria de ir para o servidor.
- Sem recuperação de conta e sem proteção contra abuso (rate limit). Há um teto de 100 membros por grupo.
- O SQLite do Node ainda é experimental (aviso no console, suprimido pelos scripts).
- Regras de pontos, conquistas e a tela de registro (+) foram inferidas dos prints (ver `src/store.js`).
- Conteúdo educativo não substitui orientação médica.
