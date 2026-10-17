# Quotestick

Quotestick is a working name for a small admin app for tradespeople anywhere in the UK. This first version gives a trader an account, a one-page website, a start-up checklist, and draft quotes. **Nothing is sent to a customer until the trader checks the quote and taps Approve.**

Plumbing and heating job templates are included. Electrical, building and other trades can still sign up; their drafts start from a blank labour and materials allowance until templates for those trades are added.

WhatsApp is not in this version. The quote is delivered by a web link, and by email when email is configured. The send step goes through one channel list so a WhatsApp sender can be added later without changing the approval rule.

This app does not give legal, tax or insurance advice. The cancellation wording on domestic quotes is a placeholder and is marked for a solicitor to review before anyone uses it with real customers.

## What you can do

- Create an account with email and password, or with a one-time sign-in link.
- Add a business name, trade, area, postcodes, phone, text logo and colour.
- Get a public page at `/t/your-name` with services, area, registration badges and an enquiry form.
- Turn each enquiry into a **draft** quote (labour and materials). A language model can adjust the draft when `OPENAI_API_KEY` is set. Without that key, a matching job template is used. If nothing matches, the draft is a blank allowance.
- Keep a price book. When a line matches a row, the quote uses your sell price and shows **last paid** where you have entered it.
- Approve the quote. Only then can the customer open `/q/…`, accept it, and (if Stripe keys are set) pay a deposit.
- Tick off a start-up checklist. Items you mark done, with a number, can show as badges. Quotestick does not check Gas Safe, NICEIC or any other register.

Starter prices on the templates are round placeholders so the draft is not empty. They are not merchant prices. Replace them.

## Run it locally

You need Node.js 22 and PostgreSQL.

1. Create a database and a user that can use it. On Ubuntu, for example:

   ```bash
   sudo -u postgres psql -c "CREATE USER quotestick WITH PASSWORD 'quotestick';"
   sudo -u postgres psql -c "CREATE DATABASE quotestick OWNER quotestick;"
   ```

2. Copy the environment file and adjust `DATABASE_URL` if your database details differ:

   ```bash
   cp .env.example .env
   ```

3. Install, create the tables, and load the ten plumbing and heating templates:

   ```bash
   npm install
   npx prisma migrate deploy
   npm run db:seed
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000), create an account, and finish the short setup form.

`npm test` runs the unit tests. They do not need the database. The approval tests check that a draft cannot be turned into a customer link, and that a known token is still hidden until the quote is approved.

## Try the demo

The sample business is fictional plumbing and heating data: a public page, four enquiries, two drafts waiting for approval, one sent quote, one accepted quote, a price book with last-paid figures, and a checklist that is only partly done. Registration numbers and prices are made up.

You only need `DATABASE_URL`. Leave `OPENAI_API_KEY`, the Stripe keys and SMTP empty. Locally you can also leave `SESSION_SECRET` empty; a development fallback signs the cookie. In production that secret is required.

1. In `.env`, set `DATABASE_URL` and `DEMO_MODE=true`.
2. Load the sample trader (this also applies migrations and the job templates):

   ```bash
   npm run demo
   ```

3. Start the app and open [http://localhost:3000](http://localhost:3000):

   ```bash
   npm run dev
   ```

4. Click **Try the demo**. The same button is on the sign-in page. A banner stays on screen so the sample business is not mistaken for a real one.

`DEMO_MODE` must be the string `true`. Anything else hides the button, and password or magic-link sign-in to `sample.trader@example.com` is refused. The sample account has no password. Running `npm run demo` again resets only that account.

The public sample page is `/t/sample-harbour-heating`. Draft quotes on it stay hidden until you approve them inside the demo.

`npm start` (the Render start command) applies migrations, loads the job templates, then runs the same sample reset **only when `DEMO_MODE` is `true`**. Any other value leaves the sample account unchanged. A free Render service runs that start command again when it wakes, so the sample trader is reset on each wake while demo mode is on. Other traders are not touched.

## Deploy on Render

This app is set up for [Render](https://render.com), not Vercel. `render.yaml` describes a free web service and a free Postgres database. It does not create a cron job.

1. Push this repository to GitHub.
2. In the Render dashboard, choose **New → Blueprint**.
3. Connect the GitHub account and select this repository. Render reads `render.yaml`.
4. Set the web service environment as follows. The blueprint fills the generated values. You only need to change `DEMO_MODE` if you want the sample business.
   - `DEMO_MODE` — set to `true` to click around the sample trader. The blueprint default is `false`. Change it on the blueprint review screen, or later under **Environment**, then use **Manual Deploy** so the new value is picked up at start.
   - Leave empty: `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SPLITSTICK_WEBHOOK_SECRET`.
   - Leave the blueprint values: `DATABASE_URL` (from Postgres), `SESSION_SECRET` (generated), `APP_URL` (from `RENDER_EXTERNAL_URL`), `CRON_SECRET` (generated), `SHOW_DEV_LINKS` = `false`, `NODE_ENV` = `production`, `NODE_VERSION` = `22`, `OPENAI_MODEL` = `gpt-4o-mini`, `SMTP_PORT` = `587`.
5. Apply the blueprint. You do not need a Render shell. The start command is `npm start`, which runs `prisma migrate deploy`, loads the job templates, and resets the sample trader when `DEMO_MODE` is `true`.
6. Open the `onrender.com` address and click **Try the demo**.

No shell is required. Migrations run at the start of every deploy and every cold start, before the site listens. A pre-deploy command is not used, because the free web service runs the start command and that is enough.

`SHOW_DEV_LINKS` stays false, so magic links are not printed on the sign-in page.

The blueprint uses Render’s **free** web service and **free** Postgres. A free web service sleeps when it is idle, and the next visit runs `npm start` again. While `DEMO_MODE` is `true`, that also resets the sample trader. Before real customers use the site, set `DEMO_MODE` back to `false` and change the web service plan to `0.5c-512mb` (or larger). If a free database is not available on the account, set the database plan to `0.1c-256mb`.

Daily reminder emails are optional and are not in the default blueprint, because a Render cron job has no free plan (smallest is `0.5c-512mb`). The HTTP check is free aside from the web service itself: `GET` or `POST` `https://<your-app>/api/cron/reminders` with header `Authorization: Bearer <CRON_SECRET>`. To add the paid cron later, paste the service from `render.cron.yaml` into `render.yaml` and sync the blueprint, or create a cron job in the dashboard with those settings.

Postgres only accepts connections from inside Render (`ipAllowList: []`). The web service uses the internal database URL.

Region is Frankfurt. You can change `region` before the first deploy. You cannot move a service or database afterwards without creating a new one.

## Environment variables

Every variable is listed in `.env.example`.

| Variable | Required | What it does |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string. Render fills this in. |
| `SESSION_SECRET` | Yes in production | Signs session cookies. At least 16 characters. |
| `APP_URL` | Yes for links in emails | Public site URL, no trailing slash. |
| `OPENAI_API_KEY` | No | Adjusts draft quote wording. Templates are used when this is empty. |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o-mini`. |
| `STRIPE_SECRET_KEY` | No | Turns on Stripe Checkout for the deposit after a customer accepts. |
| `STRIPE_WEBHOOK_SECRET` | No | Marks the deposit paid when Stripe calls `/api/stripe/webhook`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | No | Sends mail. Without `SMTP_HOST`, messages are logged only. |
| `CRON_SECRET` | For the HTTP reminder | Bearer token for `/api/cron/reminders`. |
| `SPLITSTICK_WEBHOOK_SECRET` | No | Bearer token for a future receipt feed. |
| `SHOW_DEV_LINKS` | Local only | When `true` (and not production), the sign-in page shows the magic link. |
| `DEMO_MODE` | No | When `true`, **Try the demo** is shown and `npm start` creates or resets the sample trader. Any other value does neither. |

## Quotes

1. An enquiry (from the public page, or from **New draft** inside the app) creates a quote with status **Draft**.
2. The draft is built from a job template when the description matches, then from the price book when a line matches a row. OpenAI, if configured, may change descriptions and quantities. It does not replace a template price, and the price book is applied after that.
3. The trader edits lines, the deposit percentage, and whether the job is domestic.
4. **Approve and send** is the only step that changes the status to **Sent**. The customer link is refused while the status is still Draft, even if someone already has the token.
5. The customer can accept or decline. Accepting does not take a card payment. The deposit is a second step, and only if Stripe is configured.
6. Domestic quotes include the cancellation notice placeholder. It is labelled for legal review. It is not the prescribed form under the Consumer Contracts Regulations 2013.

If the customer left a phone number rather than an email, approval still opens the link, but no email is sent. Share the link yourself. That is the gap a later WhatsApp channel would fill: register a sender with `registerDeliverySender("whatsapp", …)` in `src/lib/channels.ts`. Do not send before approval. `deliveryForCustomer` throws if the quote is still a draft.

## Price book and Splitstick

The price book is a table the trader edits. **Sell price** is what goes on the quote. **Last paid** is what they last paid for that item, with a date. The source is “entered by you” until a receipt feed updates it.

Splitstick is a separate app and is not called from here. The hook is:

- `applySplitstickReceipt` in `src/lib/price-book/splitstick.ts` — updates last paid, and only sets a sell price when the trader has not set one (last paid plus 30%).
- `POST /api/integrations/splitstick` with `Authorization: Bearer <SPLITSTICK_WEBHOOK_SECRET>` and JSON:

  ```json
  {
    "email": "trader@example.com",
    "receipt": {
      "source": "splitstick",
      "receiptId": "receipt-123",
      "merchant": "Example Merchant",
      "description": "15mm isolation valve",
      "paidPence": 320,
      "paidAt": "2026-10-01T09:00:00.000Z"
    }
  }
  ```

Until the secret is set, that endpoint returns 501 and stores nothing.

## Checklist and reminders

The checklist is created from the trade chosen at setup. Links go to GOV.UK where there is an official page. CSCS links to the scheme site because it is not a GOV.UK licence. Gas Safe links to the GOV.UK gas work licence page, and the badge links to the Gas Safe Register so a customer can check the number themselves.

Reminders look at expiry dates. An item is due from `reminderDays` before it expires (30 days unless the trader changes it), including after it has expired. Each item is emailed at most once a week.

Two ways to run the check:

- HTTP, which works on the free web service: `POST /api/cron/reminders` or `GET /api/cron/reminders` with header `Authorization: Bearer <CRON_SECRET>`. The route does nothing useful until `CRON_SECRET` is set. The blueprint generates that secret.
- Optional paid Render cron, every day at 08:00 UTC: `npm run reminders` (`scripts/reminders.ts`). It is described in `render.cron.yaml` and is not created by the default blueprint. It logs the result and emails the trader when SMTP is set. Otherwise it logs the email.

Updating `lastRemindedAt` happens after a successful log or send, so a failed send is tried again on the next run.

## Card payments

Stripe Checkout is used only after the customer has accepted, and only for the deposit. Money would go to the Stripe account whose secret key you set. This version does **not** use Stripe Connect, so do not point it at a platform account that should pay traders separately. If the keys are missing, the quote page says card payments are not switched on and that no payment has been taken.

The webhook is `POST /api/stripe/webhook`. In Stripe, send `checkout.session.completed` to `https://<your-app>/api/stripe/webhook` and put the signing secret in `STRIPE_WEBHOOK_SECRET`.

## Tests

```bash
npm test
```

`tests/approval.test.ts` is the approval gate: a draft is not publicly viewable, a customer link cannot be built for it, and approval is what moves it to sent.
