# QuantumHost — External Integrations & Provider Selection

## 1. Selected Initial Stack for Static Website Hosting

| Subsystem | Selected Provider | Free Tier Suitability | Credentials Required |
| --- | --- | --- | --- |
| **Control Plane Hosting** | Next.js (Node.js / Vercel / Cloud Run) | Free Hobby / Always Free Cloud Run | `NEXT_PUBLIC_APP_URL` |
| **Database, Auth & Realtime** | **Supabase** (`ap-south-1`) | Yes (2 projects, 500 MB DB, 50k MAUs) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Source Code & Webhooks** | **GitHub App + REST API** | Yes (5,000 req/hr/installation) | `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET` |
| **Job Queue** | **Redis + BullMQ** | Free local Docker Redis / Redis Cloud 30 MB | `REDIS_URL` |
| **Build Execution** | **BullMQ Worker + Docker Isolation** (Cloud Run Jobs for managed scale) | $0 local/VPS; Cloud Run Always Free (240k vCPU-sec/mo) | `BUILD_TIMEOUT_MS`, `DOCKER_ISOLATION` |
| **Artifact Object Storage** | **Cloudflare R2** (Local / Supabase Storage dev fallbacks) | Yes (10 GB/mo, 1M Class A, 10M Class B, **$0 egress**) | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |
| **Edge Hosting, CDN & Domains** | **Cloudflare Workers + Custom Hostnames** | Yes (Unlimited static assets, 100k Worker req/day, 100 free Custom Hostnames) | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` |
| **AI Build Diagnostics** | **Google Gemini (`gemini-2.5-flash`)** via provider-independent adapter | Yes (Free Tier via Google AI Studio) | `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY` (optional OpenAI/Anthropic keys) |

---

## 2. Official API Endpoints & Scopes Used

### GitHub Apps & REST API (`https://api.github.com`)
- **Required App Permissions**: `Contents: Read-only`, `Metadata: Read-only`, `Webhooks: Read & write` (or user OAuth scope `repo read:user user:email`).
- **Endpoints**:
  - `POST /app/installations/{installation_id}/access_tokens` — Mint 1-hour installation token using `RS256` App JWT.
  - `GET /installation/repositories` / `GET /user/repos` — List connected repositories.
  - `GET /repos/{owner}/{repo}/branches` — List branches.
  - `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` — Inspect `package.json` for framework detection.
  - `POST /repos/{owner}/{repo}/hooks` — Register `push` webhook.
  - `GET /repos/{owner}/{repo}/tarball/{ref}` or authenticated `git clone` — Retrieve source archive for builds.

### Cloudflare R2 & Custom Hostnames (`https://api.cloudflare.com/client/v4`)
- **R2 S3 Endpoint**: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (`PutObject`, `GetObject`, `ListObjects` via `@aws-sdk/client-s3`).
- **Cloudflare for SaaS Custom Hostnames**: `POST /zones/{zone_id}/custom_hostnames` to issue automated TLS certificates and edge routing for verified custom domains (requires `SSL and Certificates: Edit` token permission).

### Google Gemini REST API (`https://generativelanguage.googleapis.com`)
- **Endpoint**: `POST /v1beta/models/{model}:generateContent` with `x-goog-api-key` header and `responseMimeType: "application/json"`.
- **Fallback Providers**:
  - OpenAI / OpenAI-compatible: `POST {base_url}/chat/completions`.
  - Anthropic: `POST https://api.anthropic.com/v1/messages` (`anthropic-version: 2023-06-01`).

---

## 3. Capabilities & Known Limitations

1. **Static Websites vs. Full-Stack SSR**: Cloudflare R2 + Workers Static Assets excels for static and JAMstack exports (`vite`, `astro`, `react`, `next export`). Dynamic Node.js SSR containers require Compute services (e.g., Cloud Run Services or Fly Machines) and are scoped as a future phase beyond initial static hosting.
2. **Upstash Redis + BullMQ**: Avoid Upstash PAYG for BullMQ due to constant polling commands; use self-hosted Redis (`redis:7-alpine`), Redis Cloud Free, or Upstash Fixed ($10/mo).
3. **Cloudflare for SaaS Prerequisite**: Creating Custom Hostnames via API requires an active domain zone on Cloudflare (even on the Free plan, though SaaS fallback origin configuration requires a payment method on file for SSL for SaaS activation — $0 for the first 100 hostnames).
4. **Supabase Free Tier Pausing**: Inactive free projects pause after 7 days; production workloads require Supabase Pro ($25/mo).
