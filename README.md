# PRISM - Price Index for TCG Market Intelligence

Standalone price tracking and market intelligence app for One Piece TCG cards.

**Live URL:** https://app.cambridgetcg.com

## Project Structure

```
prism-app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── cards/          # Card search and details
│   │   │   ├── crystal/        # Crystal visualization data
│   │   │   ├── cron/           # Scheduled jobs
│   │   │   ├── health/         # Health check
│   │   │   ├── history/        # Price history
│   │   │   ├── index/          # Market indices
│   │   │   ├── movers/         # Top movers
│   │   │   └── tcg100/         # TCG-100 index
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── lib/
│       ├── cards.ts            # Card queries
│       ├── db.ts               # Prisma client
│       └── price-index.ts      # Index calculations
├── prisma/
│   └── schema.prisma           # Database schema
├── vercel.json                 # Vercel config with crons
├── package.json
└── tsconfig.json
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/index` | GET | All price indices and market health |
| `/api/movers` | GET | Top gainers, losers, volume leaders |
| `/api/cards` | GET | Search cards with filters |
| `/api/cards/[cardId]` | GET | Single card details |
| `/api/history/[cardId]` | GET | Price history for a card |
| `/api/tcg100` | GET | TCG-100 index and constituents |
| `/api/crystal` | GET | Crystal visualization data |
| `/api/health` | GET | Health check |

## Setup

### 1. Install Dependencies

```bash
cd prism-app
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection string (same as CardForum)
- `CRON_SECRET` - Secret for authenticating cron jobs

### 3. Generate Prisma Client

```bash
npx prisma generate
```

### 4. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Deployment

### Deploy to Vercel

1. **Connect Repository**
   ```bash
   cd prism-app
   vercel
   ```

2. **Set Environment Variables in Vercel Dashboard:**
   - `DATABASE_URL`
   - `CRON_SECRET` (generate with: `openssl rand -hex 32`)

3. **Deploy:**
   ```bash
   vercel --prod
   ```

## DNS Configuration Guide

To set up `app.cambridgetcg.com` subdomain:

### Option A: Using Vercel Domains (Recommended)

1. **In Vercel Dashboard:**
   - Go to your project → Settings → Domains
   - Add `app.cambridgetcg.com`
   - Vercel will provide DNS records

2. **In Your DNS Provider (e.g., Cloudflare, Namecheap):**
   - Add a CNAME record:
     ```
     Type:  CNAME
     Name:  app
     Value: cname.vercel-dns.com
     TTL:   Auto (or 3600)
     ```

   - Or if using an A record:
     ```
     Type:  A
     Name:  app
     Value: 76.76.21.21
     TTL:   Auto (or 3600)
     ```

3. **Verify in Vercel:**
   - Wait for DNS propagation (up to 48 hours, usually minutes)
   - Vercel will automatically provision SSL

### Option B: Using Cloudflare Proxy

If using Cloudflare with proxy enabled:

1. **Add CNAME record:**
   ```
   Type:  CNAME
   Name:  app
   Value: cname.vercel-dns.com
   Proxy: ON (orange cloud)
   ```

2. **SSL Settings:**
   - Go to SSL/TLS → Overview
   - Set encryption mode to "Full (strict)"

3. **In Vercel:**
   - Add the domain `app.cambridgetcg.com`
   - It will show as pending until DNS propagates

### Verify DNS Setup

```bash
# Check DNS resolution
dig app.cambridgetcg.com +short

# Or using nslookup
nslookup app.cambridgetcg.com
```

Expected result: Should resolve to Vercel's IP or CNAME.

### Troubleshooting DNS

1. **DNS not propagating:**
   - Clear local DNS cache: `sudo dscacheutil -flushcache` (macOS)
   - Try different DNS resolver: `dig @8.8.8.8 app.cambridgetcg.com`

2. **SSL certificate issues:**
   - Wait for Vercel to provision (can take up to 24 hours)
   - Ensure no conflicting CAA records

3. **404 errors after DNS setup:**
   - Verify the domain is added in Vercel project settings
   - Check Vercel deployment logs

## Cron Jobs

The app runs three cron jobs (configured in `vercel.json`):

| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| 8:00, 20:00 UTC | `/api/cron/sync-prices` | Check price freshness |
| 8:15, 20:15 UTC | `/api/cron/calculate-tcg100` | Calculate index snapshots |
| 8:30, 20:30 UTC | `/api/cron/calculate-movers` | Calculate price changes |

Cron jobs are protected by `CRON_SECRET` environment variable.

## Database Access

This app uses **read-only** access to the shared CardForum database. The trading-card-pricer Lambda handles price updates twice daily.

For production, create a read-only PostgreSQL user:

```sql
-- Run on your PostgreSQL database
CREATE USER prism_readonly WITH PASSWORD 'your-secure-password';
GRANT CONNECT ON DATABASE cardforum TO prism_readonly;
GRANT USAGE ON SCHEMA public TO prism_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO prism_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO prism_readonly;
```

Then use this user in `DATABASE_URL` for production.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL via Prisma ORM
- **Styling:** Tailwind CSS
- **Deployment:** Vercel
- **Caching:** ISR (5 min index, 1 min cards)
