# Quotestick

Quotestick is a working name for a small admin app for tradespeople anywhere in the UK. This first version gives a trader an account, a one-page website, a start-up checklist, and draft quotes. **Nothing is sent to a customer until the trader checks the quote and taps Approve.**

Plumbing and heating job templates are included. Electrical, building and other trades can still sign up; their drafts start from a blank labour and materials allowance until templates for those trades are added.

Quotes and invoices go out by a web link, and by email when email is configured. A trader can also send a job or an invoice by WhatsApp. Nothing reaches the customer until the trader approves it.

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

The sample business is fictional plumbing and heating data: a public page, four enquiries, two drafts waiting for approval, one sent quote with a follow-up waiting to be sent, one accepted quote, three invoices (a draft, one sent with payment reminders on, and one already paid), a repeating boiler service that is due soon, a price book with last-paid figures, and a checklist that is only partly done. Registration numbers, bank details and prices are made up.

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

4. Click **Try the demo**. The same button is on the home page and the sign-in page. A banner stays on screen so the sample business is not mistaken for a real one.

**Try the demo** is shown whether or not `DEMO_MODE` is true. It resets only `sample.trader@example.com` and then signs you into that account. Other traders are left alone. The sample account has no password. Password and magic-link sign-in to that address are refused unless `DEMO_MODE` is `true`. Registering that address is always refused. Running `npm run demo` again resets only that account.

The public sample page is `/t/sample-harbour-heating`. Draft quotes on it stay hidden until you approve them inside the demo.

`npm start` (the Render start command) applies migrations, loads the job templates, then runs the same sample reset **only when `DEMO_MODE` is `true`**. Any other value leaves the sample account unchanged. A free Render service runs that start command again when it wakes, so the sample trader is reset on each wake while demo mode is on. Other traders are not touched.

After **Try the demo**, open `/whatsapp`. That page is a chat simulator on the sample account only. It does not call Meta, even if WhatsApp keys are set. The sample account already has a linked number, a paid invoice, an unpaid invoice with payment reminders switched on, and a draft invoice. Real email, WhatsApp and card payments are stubbed for that account.

## WhatsApp, invoices and reminders

A trader can message the Quotestick WhatsApp number. A job description becomes a **draft quote**. A line such as `Invoice Mrs Jones, replaced tap, £80` becomes a **draft invoice** and a PDF. Quotestick replies to the trader with a summary and an approve link. They can also reply `APPROVE` or `APPROVE I-0004`. **The customer is not emailed, and the public link does not open, until that approval.**

Voice notes are transcribed with OpenAI when `OPENAI_API_KEY` is set. Without that key, Quotestick asks the trader to type.

Link a phone from **Your page**. Create a code, then from that phone send `LINK` and the code to the Quotestick number. The code lasts 30 minutes.

Invoices use pounds. If the trader is not VAT registered, no VAT is added. If they are, the figure in the message is the total the customer pays, including VAT at 20%, unless the message says `plus VAT`. Bank details from **Your page** are printed on the PDF. Add them before you send a real invoice.

Card payments are created when the customer clicks Pay, on the trader's own Stripe Connect account. With no Stripe keys, the pay button is hidden and the page says card payments are not switched on. The trader can also mark an invoice paid (for a bank transfer). That stops payment reminders. See `LAUNCH_CHECKLIST.md` for the Stripe and Render steps.

Payment reminders are on for each new invoice. The trader can switch them off on that invoice. The sequence is the due date, 7 days later, and 14 days later. Wording gets more direct. They email the customer, and they stop when the invoice is paid. Invoice payment reminders do not use WhatsApp.

After an invoice is paid, or a job is marked complete, Quotestick can email up to three notes asking for a Google review. The link is the one saved on **Your page**. The notes stop if the customer opens the link, or if the trader switches them off for that job or for the whole business.

The same daily job that checks the compliance checklist also sends these reminders: `npm run reminders`, or `GET /api/cron/reminders` with `Authorization: Bearer <CRON_SECRET>`.

## Jobs, customers and photos

**Jobs** is a three-column board: Booked, In progress and Done. Tap a button to move a job. There is no drag. When a customer accepts a quote, Quotestick adds a Booked job. If that job is linked to an invoice, the card shows Invoiced once the invoice is sent, or Paid once it is paid. A draft invoice stays marked as not sent.

**Customers** has a search box. Type part of a name, phone, email, postcode or address. Open a customer to see their jobs, quotes, invoices, and yearly service reminders.

On a job, add before and after photos from a phone camera or photo library. Pictures the customer attached to the enquiry are copied onto the job when it is booked. Photos are stored in the database, the same way enquiry photos are, and they are resized and compressed on upload so a free Render database can hold them. Job photos are not shown to the customer.

With `DEMO_MODE=true`, sign in with **Try the demo**. The sample trader has a booked job, a job in progress, a done job that is invoiced, and a done job that is paid, each with sample photos. Search Customers for `Sample Street` or `07700`. Jordan Sample also has an annual boiler service due soon, and a gas safety check due later in the year.

## RAMS

A RAMS is a risk assessment and method statement. Main contractors often ask for one before a job. Open **RAMS** and start from a job, a customer, a template, or a short description. Quotestick fills hazards, who might be harmed, a 5×5 likelihood × severity rating before and after controls, the method, PPE, COSHH substances, permits, and emergency, first aid and welfare wording from a checked library for the trade (plumbing and heating, electrical, roofing, carpentry and joinery, decorating, groundworks and landscaping, or general building). You edit every line. The library works with no OpenAI key. If `OPENAI_API_KEY` is set, the model may only choose hazards that are already in that library. It does not invent controls.

The nearest A&E is suggested from the site postcode. Quotestick asks postcodes.io where the postcode is, then OpenStreetMap for hospitals tagged as emergency. NHS Service Search needs a subscription key, so it is not used. You get the nearest hospital and two alternatives, with the distance. It is a suggestion: check it is the right 24-hour A&E before work starts. If the lookup is down, type the hospital yourself.

The competent person and each operative sign with a finger or a mouse. **Send for signatures on WhatsApp** gives each person a link that works with no login. The RAMS is fully signed only when everyone has signed the current version. If you edit the RAMS after that, every signature is cleared, the status goes back to awaiting signatures, and Quotestick offers to send the links again. Old signatures stay in an audit note. They are not treated as valid and they are not on the PDF.

**Download PDF** uses the business name, text logo and colour from **Your page**, and draws the current signatures. **Save as template** keeps a copy that is not tied to a job. The RAMS stays on the job.

Nothing is sent to the client or the main contractor until you forward the PDF yourself. The screen and the PDF say you must check that the RAMS suits the site. It is a drafting aid, not health and safety advice, and it does not report anything to the HSE.

**Company documents** stores public liability, employers' liability, trade cards, training records and a health and safety policy, with expiry dates, and the PDF or photo of each one. Files are private. With `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` set (Cloudflare R2 uses these), the file is stored in that bucket. Leave them empty and the file stays in Postgres, which is what demo mode does. `S3_REGION` can stay `auto`. Those records and the RAMS you issue are shaped so a later accreditation pack could reuse them. This version does not fill in CHAS, SafeContractor, SMAS or Constructionline, and it does not say the business is accredited.

On WhatsApp, send `RAMS for the outside tap` (or `RAMS roofing for the Smith job`). Quotestick matches a job you already have and replies with the draft and a PDF link. With Meta connected, it also sends the PDF back to you. The customer is not messaged.

With `DEMO_MODE=true`, the sample trader has a draft RAMS on the outside-tap job, company documents (one training record due soon), and the same RAMS reply in the WhatsApp simulator. Open **RAMS**, then **Download PDF**. Or open **WhatsApp** and send `RAMS for the outside tap`.

## Quote follow-ups and service reminders

A sent quote that has not been accepted or declined gets a polite follow-up after the number of days on **Your page** (3 by default), then a second note (on by default, at 7 days). You can turn chasing off for the whole business, or for one quote. Both notes land in **Follow-ups**, and you get an email when one is ready. The customer is not messaged until you tap Send, unless **Auto-send quote chasers and service reminders to the customer** is switched on. That switch is off by default.

The customer note is emailed when they have an email address. It is also sent on WhatsApp when Meta is connected and they have a mobile number. In demo mode, with no Meta keys, the same note appears in the WhatsApp simulator on the trader’s linked number. Chasing stops when the customer accepts or declines, when the trader marks the quote lost, or when the quote expires. New quotes stay open for 30 days unless you change that on **Your page** (0 means they do not expire). After that the customer can still open the link, but they cannot accept it.

On a job, tick **This job repeats**, set the gap in months (12 by default) and the next due date. Marking a repeating job done sets the next due date from that gap. On a customer, add a reminder such as a gas safety check. The due date starts at 12 months after the last finished job, or 12 months from today if there is not one yet. **Upcoming reminders** on the dashboard and **Follow-ups** lists services due in the next 18 months. **Due soon** on the job board lists ones inside the lead time (4 weeks by default). The reminder invites them to the trader’s enquiry page and says it does not book the visit. It uses the same Follow-ups queue, the same email and WhatsApp paths, and the same auto-send switch. You are emailed when it is ready, whether or not the customer is messaged.

The daily reminder job creates these notes: `npm run reminders`, or `GET /api/cron/reminders` with `Authorization: Bearer <CRON_SECRET>`.

With `DEMO_MODE=true`, sign in with **Try the demo**. **Follow-ups** already has Jordan Sample’s unanswered quote and a boiler service reminder. **Upcoming reminders** lists that boiler service and a gas safety check. Open Jordan Sample from Customers to see both dates.

### Meta WhatsApp setup

1. Go to [developers.facebook.com](https://developers.facebook.com) and create an app. Add the WhatsApp product.
2. In the WhatsApp API setup screen, copy the **phone number ID** (a long number, not the phone number itself) into `WHATSAPP_PHONE_NUMBER_ID`.
3. Create a permanent token with a system user that can send WhatsApp messages. Put it in `WHATSAPP_TOKEN`. A temporary token from the API setup screen expires within a day, so it is only useful for a first test.
4. Choose a verify token, any private string. Put the same string in `WHATSAPP_VERIFY_TOKEN` and in the Meta webhook form.
5. Open App settings, Basic, and copy the app secret into `WHATSAPP_APP_SECRET`.
6. Set the webhook URL to `https://<your-app>/api/whatsapp/webhook` and subscribe to the **messages** field.
7. Deploy again so the env vars are present. Send `LINK` and the code from **Your page**.

Leave all four WhatsApp variables empty if you only want the simulator. The webhook then refuses posts until the app secret is set, which stops unsigned requests being accepted.

## Deploy on Render

This app is set up for [Render](https://render.com), not Vercel. `render.yaml` describes a free web service and a free Postgres database. It does not create a cron job.

1. Push this repository to GitHub.
2. In the Render dashboard, choose **New → Blueprint**.
3. Connect the GitHub account and select this repository. Render reads `render.yaml`.
4. Set the web service environment as follows. The blueprint fills the generated values. You only need to change `DEMO_MODE` if you want the sample business.
   - `DEMO_MODE` — set to `true` to click around the sample trader. The blueprint default is `false`. Change it on the blueprint review screen, or later under **Environment**, then use **Manual Deploy** so the new value is picked up at start.
   - Leave empty unless you are connecting them: `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_V2_ACCOUNT_WEBHOOK_SECRET`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SPLITSTICK_WEBHOOK_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`.
   - Leave the blueprint values: `DATABASE_URL` (from Postgres), `SESSION_SECRET` (generated), `APP_URL` (from `RENDER_EXTERNAL_URL`), `CRON_SECRET` (generated), `SHOW_DEV_LINKS` = `false`, `NODE_ENV` = `production`, `NODE_VERSION` = `22`, `OPENAI_MODEL` = `gpt-4o-mini`, `SMTP_PORT` = `587`.
5. Apply the blueprint. You do not need a Render shell. The start command is `npm start`, which runs `prisma migrate deploy`, loads the job templates, and resets the sample trader when `DEMO_MODE` is `true`.
6. Open the `onrender.com` address and click **Try the demo**. That works with `DEMO_MODE` left at `false`. It does not reset real traders.

No shell is required. Migrations run at the start of every deploy and every cold start, before the site listens. A pre-deploy command is not used, because the free web service runs the start command and that is enough.

`SHOW_DEV_LINKS` stays false, so magic links are not printed on the sign-in page.

The blueprint uses Render’s **free** web service and **free** Postgres. A free web service sleeps when it is idle, and the next visit runs `npm start` again. While `DEMO_MODE` is `true`, that also resets the sample trader. Before real customers use the site, keep `DEMO_MODE` at `false` and move off the free plans. The prices and the reasons are in `LAUNCH_CHECKLIST.md`. Short version, checked on the Render pricing page on 18 October 2026: web `0.5c-512mb` is $7 a month, Postgres `0.1c-256mb` is $6 a month, and the free database expires 30 days after it is created.

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
| `STRIPE_SECRET_KEY` | No | Stripe secret key. Test key first (`sk_test_...`). Hides card buttons when empty. |
| `STRIPE_WEBHOOK_SECRET` | No | Signing secret for the Your account event destination on `POST /api/stripe/webhook`. |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | No | Signing secret for the Connected accounts destination. Same URL. Needed so deposit and invoice payments are marked paid. |
| `STRIPE_V2_ACCOUNT_WEBHOOK_SECRET` | No | Signing secret for the thin-event destination that updates Connect status. Same URL. Events are on Your account. |
| `STRIPE_PRICE_TRADE` | No | Stripe price id for Trade, £11.99 a month. |
| `STRIPE_PRICE_SPLITSTICK` | No | Stripe price id for the Splitstick bundle, £16.99 a month. |
| `STRIPE_PLATFORM_FEE_BPS` | No | Platform fee in basis points. `0` leaves the full card payment with the trader. |
| `ERROR_WEBHOOK_URL` | No | Optional URL that receives JSON when a page error is reported. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | No | Sends mail. Without `SMTP_HOST`, messages are logged only. |
| `CRON_SECRET` | For the HTTP reminder | Bearer token for `/api/cron/reminders`. |
| `SPLITSTICK_WEBHOOK_SECRET` | No | Bearer token for a future receipt feed. |
| `SHOW_DEV_LINKS` | Local only | When `true` (and not production), the sign-in page shows the magic link. |
| `DEMO_MODE` | No | When `true`, `npm start` resets the sample trader. **Try the demo** is available either way and only resets that one account. |
| `WHATSAPP_TOKEN` | No | Meta system-user token for the WhatsApp Business account. |
| `WHATSAPP_PHONE_NUMBER_ID` | No | Phone number ID from the WhatsApp API setup screen. |
| `WHATSAPP_VERIFY_TOKEN` | No | String you choose. Meta sends it when subscribing the webhook. |
| `WHATSAPP_APP_SECRET` | No | App secret used to check `X-Hub-Signature-256` on webhook posts. |

## Quotes

1. An enquiry (from the public page, or from **New draft** inside the app) creates a quote with status **Draft**.
2. The draft is built from a job template when the description matches, then from the price book when a line matches a row. OpenAI, if configured, may change descriptions and quantities. It does not replace a template price, and the price book is applied after that.
3. The trader edits lines, the deposit percentage, and whether the job is domestic.
4. **Approve and send** is the only step that changes the status to **Sent**. The customer link is refused while the status is still Draft, even if someone already has the token.
5. The customer can accept or decline. Accepting does not take a card payment. The deposit is a second step, and only if Stripe is configured.
6. Domestic quotes include the cancellation notice placeholder. It is labelled for legal review. It is not the prescribed form under the Consumer Contracts Regulations 2013.

If the customer left a phone number rather than an email, approval still opens the link, but no email is sent. Share the link yourself. WhatsApp replies go to the trader, not the customer. Quote follow-ups and service reminders can use email and WhatsApp, as described above. Invoice payment reminders stay on email. `deliveryForCustomer` throws if the quote is still a draft. A quote marked lost can still be opened, and it shows as closed.

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

## Card payments and plans

Deposits and invoice payments use Stripe Checkout on the trader's connected account (United Kingdom). The account is created with Accounts v2: an Express dashboard, merchant card payments, and the platform responsible for Stripe's processing fee and for a negative balance. The charge stays a direct charge: Checkout sends the account id on the `stripeAccount` header, and `application_fee_amount` is only `STRIPE_PLATFORM_FEE_BPS` (default `0`, so the trader receives the full payment). Checkout asks for card, which is also how Apple Pay and Google Pay appear. Bacs is not requested.

The pay button is hidden when `STRIPE_SECRET_KEY` is missing, when the trader has not finished Connect, or on the sample account. A customer then sees that card payments are not switched on and that no payment has been taken.

Subscriptions for Trade (£11.99 a month) and the Splitstick bundle (£16.99 a month) use Stripe Billing Checkout and the customer portal, on the platform account. Price ids come from `STRIPE_PRICE_TRADE` and `STRIPE_PRICE_SPLITSTICK`. Until the secret key and both price ids are set, paid features stay available and the upgrade buttons stay hidden. Once billing is configured, Free keeps the website, checklist, enquiries, quotes, the booked job from an accepted quote, and RAMS. Trade adds invoices, WhatsApp, photos, reminders and card payments. The Splitstick bundle adds the receipt feed.

The webhook is `POST /api/stripe/webhook`. Create the event destinations below and give each that same URL. Each destination has its own signing secret.

- **Your account** sends plan changes. Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Put that signing secret in `STRIPE_WEBHOOK_SECRET`.
- **Connected accounts** sends deposit and invoice payments, because those are direct charges on the trader's account. Event: `checkout.session.completed`. Put that signing secret in `STRIPE_CONNECT_WEBHOOK_SECRET`.

The app checks the signature against either secret. A connected-account event includes the trader's account id. The payment is then matched by the checkout metadata or the payment link.

Connect status uses a third destination on that same URL. In Stripe, create an event destination for **Your account**, choose the **thin** payload, and send `v2.core.account[configuration.merchant].capability_status_updated`, `v2.core.account[configuration.merchant].updated`, `v2.core.account[requirements].updated` and `v2.core.account.updated`. Put that signing secret in `STRIPE_V2_ACCOUNT_WEBHOOK_SECRET`. Those events are thin, so they are not covered by the two snapshot secrets above. Returning from Stripe still refreshes the status if this secret is empty.

The exact clicks in Stripe and Render are in `LAUNCH_CHECKLIST.md`.

## Tests

Launch checks covered by the app: rate limits on sign-in, registration and public enquiries; a honeypot and a short-fill check on the enquiry form; secure cookies and security headers; password reset by email; email confirmation before a customer is sent a quote or invoice; a JSON data export and account deletion; a 404 page, an error page, and `GET /api/health`. The session cookie is essential, so there is no cookie banner. `ERROR_WEBHOOK_URL` is optional.

```bash
npm test
```

`tests/approval.test.ts` is the approval gate: a draft is not publicly viewable, a customer link cannot be built for it, and approval is what moves it to sent.
