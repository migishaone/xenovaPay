Xenova Pay — Reusable Integration Guide

Overview

- This project implements a PawaPay deposit flow using a hosted payment page.
- It opens a centered, responsive popup, monitors status, auto‑closes the popup, and redirects the main tab to a receipt page.
- The server handles return URLs and webhooks to keep status in sync.

Key Endpoints (server)

- `POST /api/hosted-payment` — Creates a PawaPay widget session and returns `{ transactionId, redirectUrl }`.
- `GET /api/payment-status/:id` — Checks the current status for a deposit.
- `GET /payment-return` — Handles the return from PawaPay and redirects to `/receipt?id=...` (COMPLETED/ACCEPTED/PENDING) or `/payment-failed?id=...` (FAILED).
- `POST /api/callback` — Webhook endpoint PawaPay calls with final statuses.

Required Environment

- `PAWAPAY_API_TOKEN` — Bearer token from PawaPay Dashboard.
- `PAWAPAY_API_URL` — `https://api.sandbox.pawapay.io` or `https://api.pawapay.io`.
- `CLIENT_URL` — Base URL of the site to return to, e.g. `https://xenovalabs.com`.

PawaPay Dashboard Config

- System Configuration → Callback URLs → Deposits: `https://<your-domain>/api/callback`
- Refunds: optional.

Embed Into Another Website (no server changes)

1) Host this service on a public HTTPS domain and set `CLIENT_URL` accordingly.
2) From any website, include `docs/snippets/embed.js` (copy or bundle) and call:

```
XenovaPay.open({
  apiBase: 'https://xenovalabs.com',
  phone: '250783456789',
  amount: 1000,        // number or string
  currency: 'RWF',
  country: 'RWA',
  description: 'Order #123',
});
```

Behavior

- Opens a centered popup → navigates to PawaPay hosted page → on completion, popup closes automatically → main tab redirects to `/receipt?id=...`. The receipt page live‑polls status and auto‑opens the print dialog on success.

Mount Into Existing Express App

- Copy `server/routes.ts`, `server/storage.ts`, and `shared/schema.ts`.
- Call `registerRoutes(app)` in your server after JSON middleware.
- Keep the same envs and callback URL.

Notes

- Many payment pages block iframes; popup + auto‑close is the most robust UX.
- If PawaPay exposes an auto‑redirect flag in the session API later, you can add it without changing the client popup flow.

