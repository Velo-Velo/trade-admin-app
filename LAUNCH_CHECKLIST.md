# Launch checklist

Prices below were read from [Render pricing](https://render.com/pricing) and [Render free plan limits](https://render.com/docs/free) on 18 October 2026. Check those pages again before you pay, because Render can change them.

## Done in the app

- Stripe Connect Express for the UK. **Your page** has Connect Stripe, and it shows whether charges are enabled.
- Deposit and invoice pay buttons open Checkout on the trader's connected account. The payment goes to the trader. `STRIPE_PLATFORM_FEE_BPS` defaults to 0.
- Card is the only payment method requested. Apple Pay and Google Pay can appear inside Checkout. Bacs is not requested.
- The webhook marks a deposit or an invoice paid. The job board then shows Paid, and payment reminders stop.
- Plans: Free, Trade at £11.99 a month, Splitstick bundle at £16.99 a month. Checkout and the customer portal are used once price ids are set. Until then, upgrade buttons stay hidden and paid features stay available.
- Free keeps the public page, checklist, enquiries, quotes, customers from those quotes, and the booked job created when a quote is accepted.
- **Try the demo** works when `DEMO_MODE` is false. It resets only the fictional sample trader. That account does not send real email, WhatsApp or payments.
- `npm start` still resets the sample trader only when `DEMO_MODE` is exactly `true`.
- Rate limits on sign-in, registration and the public enquiry form.
- Enquiry spam checks: a hidden honeypot, a very fast submit, and a description full of links.
- Session cookie is `httpOnly`, `SameSite=Lax`, and `Secure` in production. Security headers are set. There is no cookie banner, because the only cookie is the essential sign-in cookie.
- Password reset by email, and email confirmation before a quote or invoice is sent to a customer.
- Account page: download a JSON export, or delete the account by typing the email.
- A 404 page, an error page, and `GET /api/health` (already used by the Render health check).
- Optional error reporting when `ERROR_WEBHOOK_URL` is set. With it empty, errors are only written to the log.

## What you do in Stripe (test mode first)

Use test mode until a test card payment and a test subscription both succeed. Live keys are a later switch, with a separate webhook endpoint.

1. Open the Stripe dashboard and turn on **test mode**.
2. Copy the secret key (`sk_test_...`) into Render as `STRIPE_SECRET_KEY`.
3. Settings → Connect → open **Express** accounts for the **United Kingdom**. Set the platform name, a support email, and the branding you want traders to see during onboarding. You do not paste an account id or a Connect client id into Render. The app creates the Express account when the trader clicks **Connect Stripe**.
4. Products → add two recurring **GBP** prices in test mode:
   - Trade, £11.99 every month. Put that price id in `STRIPE_PRICE_TRADE`.
   - Splitstick bundle, £16.99 every month. Put that price id in `STRIPE_PRICE_SPLITSTICK`.
5. Developers → Webhooks → Add endpoint.
   - URL: `https://<your Render app host>/api/stripe/webhook`
   - Listen to events on **your account and connected accounts**. The connected-account switch is required or invoice and deposit payments will not be marked paid.
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
   - Copy the signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.
6. Leave `STRIPE_PLATFORM_FEE_BPS` at `0` unless you have decided to keep a fee. `100` would be 1%.
7. Settings → Payment methods → Apple Pay → add your domain when you want Apple Pay to show. Google Pay is offered by Checkout on supported devices once card payments work. Do not turn on Bacs.
8. Redeploy the Render web service after the env vars are saved.
9. Create a real test trader (not the sample account), click **Connect Stripe**, finish onboarding with Stripe's test details, then pay a test invoice with card `4242 4242 4242 4242`. The invoice should show paid after the webhook.
10. On **Plans**, choose Trade. Stripe Billing Checkout should open. After payment, the webhook sets the plan. **Manage billing in Stripe** opens the customer portal.

The sample account will not open Stripe. That is deliberate.

## What you do in Render

The blueprint still creates a **free** web service and a **free** Postgres database so the first deploy has no paid service. Do not leave those free plans in place for real traders.

Free Postgres (checked 18 October 2026): $0, 256 MB RAM, 1 GB storage, **no backups**, one free database per workspace. It **expires 30 days after creation**. You then have 14 days to upgrade. After that, Render deletes it and the data.

Free web: $0, 512 MB RAM. It sleeps after 15 minutes with no traffic, and the next visit waits while it wakes. It cannot send email on ports 25, 465 or 587. Port 25 is blocked on every Render service, including paid ones.

| What | Plan id | Price on 18 Oct 2026 | Why |
| --- | --- | --- | --- |
| Web service | `0.5c-512mb` | $7 a month | Stays awake, and SMTP on port 587 or 465 can leave. |
| Postgres | `0.1c-256mb` | $6 a month | Does not expire, and paid databases have logical backups. 1 GB SSD is included. Extra storage is $0.30 per GB. |
| Larger database, if 256 MB RAM is not enough | `0.5c-1g` | $19 a month | 1 GB RAM. |
| Workspace | Hobby | $0 | Enough. Pro is $25 a month and is not required to upgrade the web service or the database. Hobby point-in-time recovery is 3 days. Pro is 7 days. |
| Custom domain | Included | 2 domains on Hobby, then $0.25 a domain a month | Add it on the web service after the paid web plan is on. |
| Cron | `0.5c-512mb` | $0.00016 a minute | Optional. A daily HTTPS call to `/api/cron/reminders` avoids this. |

A practical production pair is the $7 web service plus the $6 database, about $13 a month before bandwidth or a domain, on the Hobby workspace. Upgrade the database **before** the free one expires.

In the Render dashboard, on the web service **Environment** tab, set:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_TRADE`
- `STRIPE_PRICE_SPLITSTICK`
- `STRIPE_PLATFORM_FEE_BPS` as `0` unless you want a fee
- `DEMO_MODE` as `false`
- `SMTP_HOST`, `SMTP_PORT` (587 or 465), `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` once the web service is on a paid plan
- `ERROR_WEBHOOK_URL` only if you have somewhere to send error JSON
- `APP_URL` to the public `https://` address, with no trailing slash

Then **Manual Deploy**. Health checks use `GET /api/health`.

## Still for you, not for the code

- Custom domain and TLS (Render can issue the certificate once the domain points at the service).
- An SMTP provider that uses port 587 or 465. Port 25 will not work.
- Meta WhatsApp later, when you want real customer messages. Until then the sample account has a simulator, and a real account simply has no WhatsApp number linked.
- A solicitor reviews the terms, the privacy page, and the cooling-off notice before a real customer relies on them. The pages in the app say they are not a solicitor's draft.
- ICO registration and the data protection fee, if it applies to you. Quotestick does not register you.
- A trade mark search for the name Quotestick before you print it on vans or pay for a domain you cannot bear to change.
