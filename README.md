# EDXSO Communication Platform

Internal tool for sending email & WhatsApp campaigns to event registrants.

---

## Stack

- **Next.js 14** (App Router)
- **Supabase** (PostgreSQL + Auth)
- **ZeptoMail** (Email)
- **BagaChat** (WhatsApp)
- **Vercel** (Hosting)

---

## Setup

### 1. Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase-schema.sql`  
   This creates all tables AND seeds the DRIP 1 email + WhatsApp templates
3. Copy your **Project URL** and **anon key** from Settings → API

### 2. ZeptoMail

1. Log in to ZeptoMail at [zeptomail.in](https://www.zeptomail.in)
2. Go to **Mail Agents** → copy your **Zoho-enczapikey**
3. Verify your sending domain (noreply@edxso.com)

### 3. BagaChat

- Your BagaChat API token is already available (from Shrey)

### 4. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...

ZEPTO_API_KEY=PHtE6r0IEb3q3jYv8BAEt6O6Qs...
ZEPTO_FROM_EMAIL=noreply@edxso.com
ZEPTO_FROM_NAME=Team EDXSO

NEXG_API_KEY=ab027dd3571c47d0b45fa0eb991e7b72
NEXG_FROM_NUMBER=919217028443
NEXG_TEMPLATE_ID=your-approved-template-id
NEXG_MESSAGE_ID=3fbdd0b1-030f-4359-b21c-3202f6762088
```

### 5. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Workflow

```
1. Events → Create Event (add joining link)
2. Upload CSV → Select Event → Drop CSV → Import
3. Send Campaign → Select Event + Template → Send
4. Logs → View delivery status
```

---

## CSV Format

```csv
full_name,email,phone
John Doe,john@example.com,9199999999
Jane Smith,jane@example.com,
```

- `phone` is optional
- Duplicates (same email + event) are automatically skipped
- Country code (91) is added automatically if missing

---

## Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set env vars in Vercel dashboard:
# Project → Settings → Environment Variables
```

---

## Roadmap

- [ ] WhatsApp sending from dashboard
- [ ] Supabase Cron for drip automation (3-day / 1-day reminders)
- [ ] Auth (admin login)
- [ ] Resend failed messages
- [ ] Export logs as CSV
