# E-Marker

## Google sign-in

Set `NEXTAUTH_SECRET` to a long, random secret and `GOOGLE_CLIENT_ID` to the
client ID of a Google OAuth web application in the web app environment. Add
the app's origin to the OAuth client's authorized JavaScript origins. The web
app uses Google Identity Services to verify sign-in credentials and stores its
own signed session cookie; no redirect URI or Google client secret is used by
this sign-in flow.

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
