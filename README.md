# PRISM private opportunity engine bootstrap

This private repository preserves a dormant January PRISM prototype and now
contains an isolated, fixture-only opportunity-provider bootstrap. There is no
verified live PRISM home or deployment.

> **Runtime status:** the legacy PRISM application remains dormant. The only
> active development slice in this branch is a pure, fixture-only private
> opportunity provider. It does not read the legacy database, call a network,
> load environment variables, expose an API/UI, or schedule work.

## Private opportunity provider (fixture only)

`src/private-engine/` is the private counterpart to the public kingdom-109
`@cambridge-tcg/opportunity-signal` contract. It accepts an already validated
`cambridgetcg.opportunity-signal-input/1` fixture and returns only the exact
`cambridgetcg.opportunity-signal-provider-result/1` seam. The public package is
the sole owner of final `cambridgetcg.opportunity-signal/1` projection and
redaction.

The current provider is deterministic contract scaffolding, not a live deal
service or a calibrated model. It uses integer GBP minor units and `BigInt`
internally. Low spread pairs the low exit with high costs; high spread pairs
the high exit with low costs. Margin is net transaction spread divided by
total acquisition outlay, rounded down. Signed margin extrema evaluate every
net-exit/acquisition endpoint pair so loss and zero-crossing ranges stay
ordered. Unknown costs, invalid or expired rights, expired evidence,
incomplete FX, mismatched assets, low confidence, and numeric envelope failures
fail closed.

Every `not_applicable` cost includes an explicit assertion reason, and native
GBP includes `all_inputs_native_gbp`. Release eligibility carries an
`evidence_bundle_digest`; the public package verifies that binding before it
calls PRISM. PRISM receives a separate full-request SHA-256 digest in frozen
provider context and echoes it unchanged, preventing a result from being
replayed against another validated request.

Confidence remains an evidence-quality band, never a probability. Unknown
liquidity stays unknown for the public projector; PRISM neither upgrades it
nor adds a liquidity field to its provider result. All three classifications
carry no economics across the private seam. Every projected result retains the
three inherent non-executing risks, and the pinned standalone public parser
rejects an output if any one is removed. For a `potential_deal`, the public
projector independently recomputes transparent conservative economics and may
publish only coarse spread and margin bands—never PRISM's exact ranges.

Private thresholds live only in `src/private-engine/policy.ts`. Provider output
never contains the gross-exit input, a fair-value range, source rows, features,
weights, thresholds, rights digests, or debug data. Its exact seven fields are
schema, candidate binding, evaluation time, request digest, expiry,
classification, and reason codes.

The local wire mirror and `src/contracts/opportunity-signal-v1.pin.json` pin all
four v1 schema strings, public commit
`042aa9085150d5ad3e80a3bf3595439b24bf81f7`, and package tree
`cb287cf64c70454035b535e2ff088a779dc16c62`. A mutable branch or sibling path
is not a release pin. Private CI checks out that exact public commit into an
ephemeral location, verifies both Git identities, and runs the real
parser/projector bridge against the synthetic golden vector without uploading
artifacts. Replace the mirror with a published immutable package when one
exists.

Run the isolated checks with:

```bash
npm run test:private-engine
npm run typecheck:private-engine
npm run test:contract-conformance -- /path/to/pinned-public-checkout
```

The conformance command accepts only a caller-supplied checkout, verifies its
HEAD and package tree against the JSON pin, and does all cross-repository
compilation in a disposable OS temporary directory. It performs no clone,
fetch, commit, push, or artifact upload itself. CI supplies a fresh checkout of
the exact pinned commit with credentials disabled.

The focused TypeScript config deliberately excludes the dormant legacy app,
whose pre-existing Prisma generation and type debt are outside this slice.
The legacy app's root TypeScript config reciprocally excludes the private
contract/engine directories, so a dormant Next build cannot silently absorb or
transpile the trade-secret module into its application bundle.

## Dormant legacy prototype — historical reference only

Everything below this heading describes the archived January application
source and its old setup/deployment instructions. It is retained for context;
it is not a current service inventory, runbook, deployment claim, or authority
to activate the old database, APIs, UI, or cron jobs.

### Historical project structure

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

### Historical API endpoints

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

### Historical setup

#### 1. Install dependencies

```bash
cd prism-app
npm install
```

#### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection string (same as CardForum)
- `CRON_SECRET` - Secret for authenticating cron jobs

#### 3. Generate Prisma Client

```bash
npx prisma generate
```

#### 4. Run development server

```bash
npm run dev
```

Visit http://localhost:3000

### Historical deployment notes

#### Deploy to Vercel

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

### Historical DNS configuration guide

To set up `app.cambridgetcg.com` subdomain:

#### Option A: Using Vercel Domains

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

#### Option B: Using Cloudflare Proxy

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

#### Verify DNS setup

```bash
# Check DNS resolution
dig app.cambridgetcg.com +short

# Or using nslookup
nslookup app.cambridgetcg.com
```

Expected result: Should resolve to Vercel's IP or CNAME.

#### Troubleshooting DNS

1. **DNS not propagating:**
   - Clear local DNS cache: `sudo dscacheutil -flushcache` (macOS)
   - Try different DNS resolver: `dig @8.8.8.8 app.cambridgetcg.com`

2. **SSL certificate issues:**
   - Wait for Vercel to provision (can take up to 24 hours)
   - Ensure no conflicting CAA records

3. **404 errors after DNS setup:**
   - Verify the domain is added in Vercel project settings
   - Check Vercel deployment logs

### Historical cron jobs

The app runs three cron jobs (configured in `vercel.json`):

| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| 8:00, 20:00 UTC | `/api/cron/sync-prices` | Check price freshness |
| 8:15, 20:15 UTC | `/api/cron/calculate-tcg100` | Calculate index snapshots |
| 8:30, 20:30 UTC | `/api/cron/calculate-movers` | Calculate price changes |

Cron jobs are protected by `CRON_SECRET` environment variable.

### Historical database-access notes

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

### Historical tech stack

- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL via Prisma ORM
- **Styling:** Tailwind CSS
- **Deployment:** Vercel
- **Caching:** ISR (5 min index, 1 min cards)
