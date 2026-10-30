# Launch checklist

Prices below were read from [Render pricing](https://render.com/pricing) and [Render free plan limits](https://render.com/docs/free) on 18 October 2026. Check those pages again before you pay, because Render can change them.

## Done in the app

- Stripe Connect for the UK uses Accounts v2. **Your page** creates an Express-dashboard merchant account and shows whether card payments are enabled.
- Deposit and invoice pay buttons open Checkout on the trader's connected account. The payment goes to the trader. The platform pays Stripe's card fee and covers a negative balance. `STRIPE_PLATFORM_FEE_BPS` defaults to 0.
- Card is the only payment method requested. Apple Pay and Google Pay can appear inside Checkout. Bacs is not requested.
- The webhook marks a deposit or an invoice paid. The job board then shows Paid, and payment reminders stop. Plan events use `STRIPE_WEBHOOK_SECRET`. Deposit and invoice events use `STRIPE_CONNECT_WEBHOOK_SECRET`. Both destinations use the same URL.
- Plans: Free, Solo at £14 a month, Pro at £24 a month. Checkout and the customer portal are used once the test secret and both price ids are set. Until then the Plans page says billing is not configured, upgrade buttons stay hidden, and paid features stay available. A live secret key does not start a subscription.
- Free keeps the public page, checklist, enquiries, quotes, customers from those quotes, the booked job created when a quote is accepted, RAMS, and WhatsApp receipt photos.
- Solo is the working plan for one person: invoices (40 a month), WhatsApp drafts, jobs, photos (150), a diary of visits, reminders and card payments. Pro removes the caps, adds Splitstick last-paid prices, and adds CIS deduction records. Receipt photos stay on every plan. There is no third Splitstick subscription.
- CIS figures are the rate the trader chooses (0%, 20% or 30%) on labour only, shown on the invoice PDF, plus a CSV and PDF statement for an accountant. Nothing is filed with HMRC. A CIS status and a contractor tick can be saved on every plan. Quote deposits and the platform fee are unchanged.
- An existing Trade row becomes Solo and is marked unlimited, so the new caps do not apply. An existing Splitstick bundle row becomes Pro. Stripe keeps charging the old price until the trader changes it in the portal.
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
3. Settings → Connect. Turn Connect on for the **United Kingdom**. Set the platform name, a support email, and the branding traders see during onboarding. You do not paste an account id or a Connect client id into Render. **Connect Stripe** creates the account with Accounts v2 (Express dashboard, merchant card payments). Do not turn Accounts v1 back on.
4. Stay in **test mode**. Products → add two recurring **GBP** prices. Do not turn on Stripe Tax. VAT on these amounts is still to be decided, and the app does not claim that the price includes or excludes it.
   - Solo, £14.00 every month. Put that price id in `STRIPE_PRICE_SOLO`.
   - Pro, £24.00 every month. Put that price id in `STRIPE_PRICE_PRO`.
   - If anyone is already subscribed to the old Trade (£11.99) or Splitstick bundle (£16.99) prices, leave those prices active. Put the old price ids in `STRIPE_PRICE_TRADE` and `STRIPE_PRICE_SPLITSTICK`. Do not archive them until those subscriptions have ended. New checkout does not sell them.
5. Settings → Billing → Customer portal. Turn the portal on. Let customers update their payment method, switch plan, and cancel. Add the Solo and Pro prices to the products they can switch between. Cancellation can take effect at the end of the period Stripe already uses; the webhook then sets the account back to Free.
6. Developers → Event destinations. Add these destinations. They use the same URL: `https://<your Render app host>/api/stripe/webhook`. Each one has its own signing secret (`whsec_...`).
   - **Your account**. Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Copy this signing secret into `STRIPE_WEBHOOK_SECRET`. This is how a plan payment updates the account. A failed payment leaves the plan on and sets the status to past due.
   - **Connected accounts**. Event: `checkout.session.completed`. Copy this signing secret into `STRIPE_CONNECT_WEBHOOK_SECRET`. Deposit and invoice payments are charges on the trader's account, so Stripe only sends them here. Without this secret those payments stay unpaid in the app. Payload style stays **Snapshot**.
   - **Your account**, a separate destination, payload style **Thin**. Events: `v2.core.account[configuration.merchant].capability_status_updated`, `v2.core.account[configuration.merchant].updated`, `v2.core.account[requirements].updated`, `v2.core.account.updated`. Copy this signing secret into `STRIPE_V2_ACCOUNT_WEBHOOK_SECRET`. These are the account updates for Accounts v2, and Stripe sends them on your account, not on connected accounts. The URL is the same. Without this secret, status still refreshes when the trader comes back from Stripe, but a later approval will not show until they open Your page again.
7. Leave `STRIPE_PLATFORM_FEE_BPS` at `0` unless you have decided to keep a fee. `100` would be 1%.
8. Settings → Payment methods → Apple Pay → add your domain when you want Apple Pay to show. Google Pay is offered by Checkout on supported devices once card payments work. Do not turn on Bacs.
9. Redeploy the Render web service after the env vars are saved.
10. Create a real test trader (not the sample account), click **Connect Stripe**, finish onboarding with Stripe's test details, then pay a test invoice with card `4242 4242 4242 4242`. The invoice should show paid after the webhook. Connect is separate from the subscription: the deposit still goes to the trader's account, and `STRIPE_PLATFORM_FEE_BPS` is unchanged.
11. On **Plans**, choose Solo. Stripe Billing Checkout should open in test mode. Pay with `4242 4242 4242 4242`. After the webhook, the plan shows Solo and the "Stripe is confirming the plan" note is gone. **Manage billing in Stripe** opens the customer portal. Use a test clock, or the dashboard, to send `invoice.payment_failed` and confirm the plan stays on with status past due. Cancel at the period end and confirm Plans names the end date and still offers **Undo cancellation in Stripe**. Undo it in the portal and confirm that note disappears. Cancel immediately and confirm the account returns to Free.

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
- `STRIPE_CONNECT_WEBHOOK_SECRET`
- `STRIPE_V2_ACCOUNT_WEBHOOK_SECRET`
- `STRIPE_PRICE_SOLO`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_TRADE` and `STRIPE_PRICE_SPLITSTICK` only while an old subscription is still billing
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
