# PR Review WhatsApp Relay

Microserviço externo para receber reviews consolidadas de PR via webhook e enviar notificações privadas no WhatsApp.

## Fluxo

```text
GitHub Action no repo principal
  -> POST /github/pr-review-notify
  -> mapeia authorLogin para telefone
  -> envia DM via WhatsApp Cloud API
```

## Endpoints

- `GET /health`
- `POST /github/pr-review-notify`

## Variáveis de ambiente

Veja `.env.example`.

Campos principais:

- `WEBHOOK_BEARER_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_SEND_MODE`
- `WHATSAPP_TEMPLATE_NAME`
- `WHATSAPP_TEMPLATE_LANGUAGE_CODE`
- `USER_PHONE_MAP_JSON`

## Modo de envio

### `WHATSAPP_SEND_MODE=text`

Envia mensagem de texto livre.

Bom para:
- testes rápidos
- cenários em que o destinatário já abriu a janela de atendimento

Risco:
- mensagens business-initiated fora da janela de atendimento podem falhar

### `WHATSAPP_SEND_MODE=template`

Envia template aprovado na WhatsApp Cloud API.

Recomendado para produção, porque notificações de review costumam ser iniciadas pelo sistema e podem cair fora da janela de atendimento.

Template sugerido:

Body:

```text
{{1}}
```

Ou um template mais estruturado, por exemplo:

```text
Atualização de review de PR:
{{1}}
```

Neste projeto, o serviço envia uma única variável com o texto consolidado da notificação.

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
    "channel": "whatsapp",
    "messageText": "Fala. Vi a atualização do PR #65..."
  }
}
```

## Desenvolvimento

```bash
npm install
npm run dev
```

## Healthcheck

```bash
curl http://localhost:8787/health
```

## Observações operacionais

- O serviço assume que os números estão em formato E.164, por exemplo `+5511999999999`.
- Se o autor do PR não estiver no `USER_PHONE_MAP_JSON`, o evento é aceito e marcado como `skipped`.
- O GitHub deve chamar este serviço com `Authorization: Bearer <WEBHOOK_BEARER_TOKEN>`.
