# E-Marker

## Paystack payments

Configure `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`, and
`PAYSTACK_WEBHOOK_SECRET` in the web app environment. Register
`/api/webhooks/paystack` as a Paystack webhook URL. Checkout references and
prices are created on the server; the signed webhook is the source of truth for
credit and subscription activation. Monthly plans require a new payment each
month and do not auto-renew.

Install the web payment dependencies with:

```sh
npm install react-paystack @paystack/inline-js axios zod --workspace @exam-marker/web
```

Apply the database changes locally with:

```sh
cd packages/database
npx prisma migrate dev --name add_payment_system
```
