# PR Review Slack Relay

Microserviço externo para receber eventos consolidados do GitHub/Trello via webhook e publicar alertas ou snapshots em canais do Slack.

## Fluxo

```text
GitHub Action no repo principal
  -> POST /github/pr-review-notify
  -> publica alerta no canal de PR via Slack Web API

Workflow de sync no repo principal
  -> POST /slack/sync-snapshot
  -> atualiza snapshot operacional no canal de backlog ou de PR
```

## Endpoints

- `GET /health`
- `POST /github/pr-review-notify`
- `POST /slack/sync-snapshot`
- `GET /cron/backlog-sync`
- `GET /cron/pr-queue-sync`
- `GET /cron/deploy-status-sync`

Na Vercel, os rewrites mantêm exatamente esses caminhos públicos.

## Variáveis de ambiente

Veja `.env.example`.

Campos principais:

- `WEBHOOK_BEARER_TOKEN`
- `SLACK_BOT_TOKEN`
- `SLACK_PR_ALERTS_CHANNEL_ID`
- `SLACK_BACKLOG_CHANNEL_ID`
- `SLACK_DEPLOY_CHANNEL_ID` (canal dedicado para status de deploy)
- `VERCEL_API_TOKEN` (para monitorar deploys)
- `VERCEL_PROJECT_ID` (para monitorar deploys)

## Exemplo de payload recebido

```json
{
  "event": "pull_request_review.submitted",
  "pullRequest": {
    "number": 65,
    "title": "Feat/self update credentials",
    "htmlUrl": "https://github.com/org/repo/pull/65",
    "authorLogin": "FelipePacheco30"
  },
  "review": {
    "state": "approved",
    "reviewerLogin": "JV-L0pes"
  },
  "notification": {
    "channel": "slack",
    "messageText": "Fala. Vi a atualização do PR #65..."
  }
}
```

## Desenvolvimento

```bash
npm install
npm run dev
```

## Deploy na Vercel

O projeto já está preparado para Vercel:
- funções em `api/`
- rewrites em `vercel.json`
- compatível com os mesmos paths do modo local

Depois do deploy, configure as env vars do `.env.example` no painel da Vercel.

## Healthcheck

```bash
curl http://localhost:8787/health
```

## Observações operacionais

- O serviço usa dois canais:
  - `SLACK_PR_ALERTS_CHANNEL_ID` para reviews de PR
  - `SLACK_BACKLOG_CHANNEL_ID` para snapshot de backlog/sprint
- Opcionalmente usa `SLACK_DEPLOY_CHANNEL_ID` para o snapshot de deploy (fallback para `SLACK_PR_ALERTS_CHANNEL_ID` se ausente).
- O endpoint `GET /cron/deploy-status-sync` consulta a API da Vercel e publica um snapshot de deploy no canal definido por `DEPLOY_SNAPSHOT_CHANNEL_TARGET` (`deploy` por padrão).
- O endpoint `/slack/sync-snapshot` aceita `snapshot.channelTarget`:
  - `backlog`
  - `pr_alerts`
  - `deploy`
- O bot do Slack precisa ter permissão `chat:write`. Se ele não estiver no canal público, `chat:write.public` simplifica a postagem.
- O GitHub deve chamar este serviço com `Authorization: Bearer <WEBHOOK_BEARER_TOKEN>`.
