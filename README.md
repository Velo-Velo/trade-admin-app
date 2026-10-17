# Quotestick

Quotestick is a working name for a small admin app for UK tradespeople. This first version gives a trader an account, a one-page website, a start-up checklist, and draft quotes. **Nothing is sent to a customer until the trader checks the quote and taps Approve.**

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

## Deploy on Render

This app is set up for [Render](https://render.com), not Vercel. `render.yaml` describes the web service, a Postgres database, and a daily reminder job.

1. Push this repository to GitHub.
2. In the Render dashboard, choose **New → Blueprint**.
3. Connect the GitHub account and select this repository. Render reads `render.yaml`.
4. When Render asks for environment variables marked “sync: false”, you can leave the optional ones empty:
   - `OPENAI_API_KEY` — leave empty to use templates only.
   - `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` — leave empty and deposits stay as a note, with no card payment.
   - `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` — leave empty and emails are written to the service logs instead of being sent.
   - `SPLITSTICK_WEBHOOK_SECRET` — leave empty. The Splitstick endpoint stays switched off.
5. Apply the blueprint. The first deploy runs `npm start`, which applies database migrations and loads the job templates before the site starts.
6. Open the `onrender.com` address Render gives the web service and create an account.

`APP_URL` is set from Render’s own `RENDER_EXTERNAL_URL`, so quote links use the public address. `SESSION_SECRET` and `CRON_SECRET` are generated for you. `SHOW_DEV_LINKS` is false, so magic links are not printed on the sign-in page.

The blueprint uses Render’s **free** web service and **free** Postgres so you can try it without picking a larger plan. A free web service sleeps when it is idle, which makes the trader’s public page slow to wake up. Before real customers use it, change the web service plan to `0.5c-512mb` (or larger) in `render.yaml` or in the dashboard. If a free database is not available on the account, set the database plan to `0.1c-256mb`.

The reminder cron job cannot be free. The smallest cron plan is `0.5c-512mb`. If you do not want that service, delete `quotestick-reminders` from the blueprint before you apply it, and use the HTTP reminder endpoint below instead.

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

- Render cron, from `render.yaml`, every day at 08:00 UTC: `npm run reminders` (`scripts/reminders.ts`). It logs the result and emails the trader when SMTP is set. Otherwise it logs the email.
- HTTP: `POST /api/cron/reminders` or `GET /api/cron/reminders` with header `Authorization: Bearer <CRON_SECRET>`. The route does nothing useful until `CRON_SECRET` is set.

Updating `lastRemindedAt` happens after a successful log or send, so a failed send is tried again on the next run.

## Card payments

Stripe Checkout is used only after the customer has accepted, and only for the deposit. Money would go to the Stripe account whose secret key you set. This version does **not** use Stripe Connect, so do not point it at a platform account that should pay traders separately. If the keys are missing, the quote page says card payments are not switched on and that no payment has been taken.

The webhook is `POST /api/stripe/webhook`. In Stripe, send `checkout.session.completed` to `https://<your-app>/api/stripe/webhook` and put the signing secret in `STRIPE_WEBHOOK_SECRET`.

## Tests

```bash
npm test
```

`tests/approval.test.ts` is the approval gate: a draft is not publicly viewable, a customer link cannot be built for it, and approval is what moves it to sent.
