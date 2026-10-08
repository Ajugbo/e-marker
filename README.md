# E-Marker

## Google sign-in

Set `NEXTAUTH_SECRET` to a long, random secret and `GOOGLE_CLIENT_ID` to the
client ID of a Google OAuth web application in the web app environment. Add
the app's callback URL (`/api/auth/callback/google`) to the OAuth client's
authorized redirect URIs, and set `GOOGLE_CLIENT_SECRET`. The web app uses
Google's OAuth authorization-code flow with PKCE and stores its own signed
session cookie.

## Paystack payments

Configure `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` and `PAYSTACK_SECRET_KEY` in the web
app environment. Register
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
