# Desafio 30 Dias — Vida Saudável

Reconstrução do app da Enfermagem (originalmente no Base44) em React + Vite + Tailwind, com backend próprio (Node + SQLite ou Turso) para grupos, convites e ranking compartilhado.

## Rodar

Requer Node 22.5+ (usa o `node:sqlite` embutido; o único pacote do backend é o `@libsql/client`, usado só com Turso).

```bash
npm install
npm run server     # API em http://localhost:3001 (banco: server/data.db)
npm run dev        # app em http://localhost:5173, com /api encaminhado ao servidor
```

Produção (um único processo serve o app e a API):

```bash
npm start          # build + servidor em http://localhost:3001
```

Variáveis: `PORT` (padrão 3001), `DB_PATH` (padrão `server/data.db`), `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` (usa o Turso em vez do arquivo), `TRUST_PROXY`, `API_URL` (proxy do `npm run dev`).

Testes (39 casos, rodados nos dois motores de banco: SQLite e libSQL): `npm test`.

**Publicar na internet:** veja [DEPLOY.md](DEPLOY.md) (Vercel + Turso, Docker/Fly.io, backup, checklist e LGPD).

## Como funciona
- **Sem e-mail ou senha.** Quem cria ou entra num grupo recebe um token guardado no aparelho (no servidor fica só o hash). Para voltar à conta em outro aparelho existe o **PIN de recuperação** (4 a 8 números, guardado como hash com scrypt): "Recuperar acesso" pede código do grupo + nome + PIN, devolve pontos e registros e **invalida o token antigo**. Depois de 5 PINs errados a conta bloqueia por 15 min.
- **Pontos e sequência são calculados no servidor**, a partir dos registros brutos do dia, com o mesmo código do app (`shared/scoring.js`). O aparelho não consegue "informar" quantos pontos tem; o máximo possível é 100 por dia, só dentro dos 30 dias do desafio.
- **O que sai do aparelho:** nome, avatar, metas de água/sono e, por dia, refeições, água, minutos de atividade, horas de sono e se registrou peso e humor (**sem os valores**). **Peso, altura, IMC e idade nunca são enviados.**
- **Sincronização:** a cada mudança no registro o app envia os dias do desafio (espera de 800 ms) e recarrega o ranking, que também atualiza a cada 20 s e ao trocar de aba.
- **Administração (quem criou o grupo):** gerar novo código (o antigo deixa de valer; quem já está no grupo continua), iniciar nova temporada (zera os pontos de todos e **apaga a temporada anterior**), remover membros, passar a administração e excluir o grupo. Quem administra um grupo com outras pessoas precisa passar a administração antes de sair.
- **Códigos de convite** têm formato `ENFER-K7M2QX` (6 caracteres sem 0/O/1/I/L, ~887 milhões de combinações). Tentativas de código errado bloqueiam o IP por alguns minutos, o que impede varrer códigos.
- **Compartilhar progresso no grupo** desligado: a pessoa some do ranking dos outros, mas continua vendo o próprio.
- **Convite por link:** `/?convite=CÓDIGO` abre a tela de entrada com o código preenchido.
- **Títulos do grupo** (Hidratação, Consistência, Treino, Sono) vão para quem lidera cada métrica na temporada.
- **Fim do desafio:** depois do dia 30 o app mostra uma tela de encerramento com totais e pódio, bloqueia novos registros e oferece "nova temporada" ao administrador.
- **Lembrete diário:** aviso no app, e notificação do navegador se permitida, a partir do horário escolhido, quando nada foi registrado no dia. **Só funciona com o app aberto**; notificação com o app fechado exigiria push (não implementado).
- **Metas sugeridas** no cadastro: água ≈ 35 ml/kg (+250 ml para quem treina) e sono por faixa etária; objetivos escolhidos viram a marca "Foco" nos hábitos; o Perfil mostra a evolução do peso e o caminho até a meta (só no aparelho).
- **Privacidade:** política em `src/Privacy.jsx` e aceite no cadastro (quem já usava o app aceita ao abrir). Para aparecer um e-mail de contato na política, preencha `PRIVACY_CONTACT` em `src/config.js`.

## API
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/groups` | cria grupo e o primeiro membro (administrador) |
| POST | `/api/groups/join` | entra com código |
| POST | `/api/recover` | recupera acesso com código + nome + PIN |
| GET | `/api/groups/me/ranking` | ranking geral e por semana, títulos |
| GET | `/api/groups/me/members` | lista de membros (admin) |
| POST | `/api/groups/me/code` | novo código (admin) |
| POST | `/api/groups/me/season` | nova temporada (admin) |
| POST | `/api/groups/me/owner` | passa a administração (admin) |
| DELETE | `/api/groups/me/members/:id` | remove membro (admin) |
| DELETE | `/api/groups/me` | exclui o grupo (admin) |
| PUT | `/api/sync` | envia registros do dia; o servidor recalcula pontos e sequência |
| PUT | `/api/me/pin` | define o PIN de recuperação |
| DELETE | `/api/me` | apaga o membro e seus dados |

`me` é o grupo de quem está logado (também aceita o código do grupo). Usar `me` mantém o app funcionando quando o administrador troca o código.

## Banco de dados
Esquema versionado em `server/db.js` (tabela `schema_migrations`). Ao subir, o servidor aplica as migrações que faltam, inclusive em bancos criados antes do controle de versão. **Para mudar o esquema, acrescente uma migração nova no fim; nunca edite as já publicadas.** Backup: `server/backup.js` (SQLite local e Turso, ver [DEPLOY.md](DEPLOY.md)).

## Telas
Cadastro (4 passos, com aceite da política) → criar/entrar/recuperar grupo → Início, Hoje, botão **+**, Ranking, Perfil. O resumo **KDIGO 2024** (DRC) fica no card "Aprender" do Início (`src/kdigo.js`).

## Acessibilidade
Conferido por auditoria automática em tamanho de celular (375 px), nos temas claro e escuro, em todas as telas: contraste mínimo de 4,5:1, alvos de toque de pelo menos 40 px, texto de pelo menos 11 px e sem rolagem horizontal. A paleta do Tailwind foi ajustada em `tailwind.config.js` para isso; ao mexer em cores, refaça a verificação.

## Limitações conhecidas
- **Peso e humor não são recuperáveis por completo:** o servidor só sabe que foram registrados. Na recuperação voltam como "registrados" (peso do cadastro, humor neutro); os pontos se mantêm.
- **Registros só do dia de hoje, de propósito.** Lançar dias passados anularia o "resgate de sequência" do app original; um dia esquecido se salva com o resgate (2 por temporada).
- **Os registros brutos ainda vêm do aparelho:** o servidor recalcula os pontos, mas alguém técnico pode informar, por exemplo, água falsa. O ganho fica limitado a 100 pts/dia.
- **Notificação com o app fechado não existe** (exigiria push e um serviço agendado).
- **Filtro de nomes é mínimo** (palavras inteiras, lista curta). A moderação de verdade é o administrador remover membros.
- **Sexo e nível de atividade** são coletados (existem no app original) mas só o nível de atividade influencia (sugestão de água); o sexo não muda nada.
- Limite geral de requisições é por instância na Vercel (aproximado); os limites de criar/entrar/recuperar e de tentativas erradas ficam no banco e valem em qualquer ambiente.
- O SQLite do Node ainda é experimental (aviso no console, suprimido pelos scripts).
- Regras de pontos, conquistas e a tela de registro (+) foram inferidas dos prints (ver `shared/scoring.js`).
- A Política de Privacidade descreve o que o app faz; não substitui revisão jurídica.
- Conteúdo educativo não substitui orientação médica.
