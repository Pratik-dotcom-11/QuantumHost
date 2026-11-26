# QuantumHost — Technology Stack & Research Findings

Every component below was selected after reviewing current official documentation, API capabilities, rate limits, pricing models, and security constraints.

---

## 1. Frontend & Control Plane

| Layer | Selection | Official Documentation Notes |
| --- | --- | --- |
| **Framework** | **Next.js 16 (App Router)** | Uses `proxy.ts` (replacing `middleware.ts` on Node.js runtime) for coarse pre-flight session refresh; authoritative auth checks live in Server Components and Route Handlers. |
| **UI Library** | **React 19 + TypeScript (strict)** | `strict: true` and `noUncheckedIndexedAccess: true` eliminate runtime null/index surprises. |
| **Styling & UI** | **Tailwind CSS v4 + shadcn/ui + Lucide** | Composable accessible primitives (`@radix-ui/*`) with full design ownership and dark cloud console ergonomics. |
| **Validation** | **Zod** | Validates all API JSON payloads, webhook bodies, and environment configurations at runtime. |

---

## 2. Database, Auth & Realtime

- **Provider**: **Supabase** (`PostgreSQL 17`, `Supabase Auth`, `Supabase Realtime`, `Supabase Storage`).
- **Official SSR Pattern**: `@supabase/ssr` with `createBrowserClient` (client components), `createServerClient` (server components/route handlers), `supabase.auth.getClaims()` in `proxy.ts` for fast cryptographic JWT verification without network roundtrips, and `supabase.auth.getUser()` for authoritative mutations.
- **Free Tier Limits (Verified)**:
  - Up to **2 active free projects** per organization (paused after **7 days of inactivity**).
  - **500 MB** PostgreSQL database, **500 MB** shared RAM.
  - **50,000 MAUs** on Supabase Auth.
  - **1 GB** Storage (50 MB max file size, 5 GB standard + 5 GB cached egress/month).
  - **2 million** Realtime messages/month, 200 concurrent connections.
- **Scaling Path**: Supabase Pro ($25/mo) removes 7-day inactivity pausing, expands DB to 8 GB, Storage to 100 GB, and adds daily backups + PITR.

---

## 3. Source Code Integration

- **Provider**: **GitHub Apps + GitHub REST API (`2022-11-28`) + Webhooks**.
- **Authentication**:
  - **GitHub App**: Signs a short-lived `RS256` JWT with the App private key and calls `POST /app/installations/{installation_id}/access_tokens` to obtain a 1-hour scoped installation token (`Contents: read`, `Metadata: read`, `Webhooks: write`).
  - **GitHub OAuth / PAT Fallback**: Supports user-to-server OAuth or fine-grained PAT for immediate developer onboarding.
- **Repository Cloning / Archive**:
  - Supports `git clone https://x-access-token:<TOKEN>@github.com/owner/repo.git` or `GET /repos/{owner}/{repo}/tarball/{ref}` (`Contents: read`, follows `302` redirect; private archive URLs expire in 5 minutes).
- **Rate Limits (Verified)**:
  - Baseline **5,000 requests/hour** per installation (+50/hr per repo/user above 20; 15,000/hr on GitHub Enterprise Cloud).
- **Webhooks**:
  - Must read **exact raw body bytes** and verify `X-Hub-Signature-256` (`sha256=<hex>`) using `crypto.createHmac('sha256', secret)` + `crypto.timingSafeEqual` before parsing JSON or queuing jobs. Must respond `2xx` within 10 seconds.

---

## 4. Job Queue & Orchestration

- **Technology**: **Redis + BullMQ (`ioredis`)**.
- **Official Requirement**: `ioredis` must set `maxRetriesPerRequest: null` for BullMQ `Worker` blocking commands.
- **Provider Evaluation (Upstash vs. Self-Hosted Redis)**:
  - **Upstash Redis Free Tier** offers 250 MB storage and **500,000 commands/month** (PAYG is $0.20 / 100K commands).
  - **Critical Limitation ("BullMQ Trap")**: Official Upstash docs explicitly warn that BullMQ workers continuously poll Redis even when idle, rapidly exhausting the 500k/mo free cap or inflating PAYG bills.
  - **Recommendation**: Run **self-hosted Redis (`redis:7-alpine`)** during development and on the worker VPS, or use **Upstash Fixed Plan ($10/mo)** / **Redis Cloud Free 30 MB** when deploying managed serverless queues.

---

## 5. Isolated Build Execution Providers

| Option | Isolation Model | Free Tier & Pricing | Capability Verdict |
| --- | --- | --- | --- |
| **Dedicated Docker Build Worker** | Container per job (`docker run --rm --memory=1g --cpus=1 --pids-limit=256`) | **$0** software cost on local/VPS | Best immediate control, full BullMQ streaming, zero cold-start vendor lock-in. |
| **Google Cloud Run Jobs** | Ephemeral gVisor sandbox per execution | **Always Free**: 240,000 vCPU-sec + 450,000 GiB-sec/mo | Best managed serverless cloud runner with true always-free quota and no idle billing. |
| **Fly.io Machines API** | Firecracker micro-VMs via HTTP REST | No permanent free tier ($5/mo trial credit with card; ~$0.15/GB rootfs + per-sec compute) | Strong Firecracker isolation, ideal for paid multi-tenant scale. |
| **GitHub Actions** | Managed CI runners | 2,000 min/mo free (public repos unlimited) | Couples hosting to GitHub-hosted minutes and slows custom log streaming. |

**Selected Strategy**: BullMQ Worker executing builds inside **isolated ephemeral workspaces / Docker containers** for local & VPS environments, with an execution adapter ready for **Google Cloud Run Jobs** in managed production.

---

## 6. Object Storage Providers

| Provider | S3 API | Free Tier | Egress Pricing | Verdict |
| --- | --- | --- | --- | --- |
| **Cloudflare R2** | Yes (`PutObject`, `GetObject`, `ListObjects`) | **10 GB/mo**, 1M Class A ops, 10M Class B ops | **$0.00 (Free forever)** | **Selected Primary** for production static artifacts. |
| **Supabase Storage** | S3 protocol + REST | 1 GB storage, 50 MB max file | 5 GB/mo free, then $0.09/GB | Good zero-extra-account option for small prototypes. |
| **AWS S3** | Native | 5 GB (12-mo trial only) | ~$0.09/GB after 100 GB | Expensive egress for static website hosting. |
| **Local Disk Store** | Filesystem adapter | Unlimited (local disk) | $0 | **Selected Dev Fallback** for offline/local builds. |

---

## 7. Hosting, CDN & Custom Domains

- **Provider**: **Cloudflare (Workers Static Assets + R2 + Cloudflare for SaaS)**.
- **Official Capabilities & Limits (Verified)**:
  - **Static Assets**: Unlimited free requests and bandwidth on Free tier (up to 20,000 files per version, 25 MiB max per file).
  - **Workers Free Tier** (for dynamic edge routing / R2 origin lookup): **100,000 requests/day**, 10 ms CPU time, 128 MB RAM, 50 subrequests/request.
  - **Cloudflare for SaaS (Custom Hostnames)**: **100 free custom hostnames** with automated SSL/TLS certificate issuance on Free/Pro/Business plans ($0.10/mo per additional hostname beyond 100).
- **Note on Cloudflare Pages Direct Upload**: Supports programmatic static deployment via API, while **R2 + Worker Edge Router** gives QuantumHost unlimited deployment retention, instant multi-tenant custom-hostname routing, and atomic pointer rollbacks without per-project Pages limits.

---

## 8. AI API Providers (Provider-Independent Layer)

| Provider | Free Tier Availability | Pricing (Paid) | Notes |
| --- | --- | --- | --- |
| **Google Gemini (`gemini-2.5-flash`)** | **Yes** — Permanent Free Tier via Google AI Studio (RPM/RPD capped, no card required) | ~$0.30/1M input, ~$1.50/1M output (Flash) | **Selected Default**. Note: Free tier prompts may be used by Google for model improvement; Paid tier removes training usage. |
| **OpenAI (`gpt-4o-mini`)** | No permanent free tier (paid / limited onboarding credits) | Pay-per-token | Supported via `OpenAiCompatibleProvider`. |
| **Anthropic (`claude-3-5-haiku`)** | No permanent free tier (paid / limited onboarding credits) | Pay-per-token | Supported via `AnthropicProvider`. |
| **OpenAI-Compatible (OpenRouter/Groq/Ollama)** | Provider-dependent (Groq/Ollama free local) | Provider-dependent | Supported via configurable `base_url`. |
