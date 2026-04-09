# PR Review Slack Relay

Microserviço externo para receber reviews consolidadas de PR via webhook e enviar notificações privadas no Slack.

## Fluxo

```text
GitHub Action no repo principal
  -> POST /github/pr-review-notify
  -> mapeia authorLogin para Slack user ID
  -> envia DM via Slack Web API
```

## Endpoints

- `GET /health`
- `POST /github/pr-review-notify`

Na Vercel, os rewrites mantêm exatamente esses caminhos públicos.

## Variáveis de ambiente

Veja `.env.example`.

Campos principais:

- `WEBHOOK_BEARER_TOKEN`
- `SLACK_BOT_TOKEN`
- `SLACK_USER_MAP_JSON`

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

- O serviço assume que o mapa usa `Slack user ID`, por exemplo `U0123456789`.
- Se o autor do PR não estiver no `SLACK_USER_MAP_JSON`, o evento é aceito e marcado como `skipped`.
- O bot do Slack precisa ter permissão `chat:write`.
- O GitHub deve chamar este serviço com `Authorization: Bearer <WEBHOOK_BEARER_TOKEN>`.
