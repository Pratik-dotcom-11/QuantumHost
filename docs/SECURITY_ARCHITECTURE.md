# QuantumHost — Security Architecture

## 1. Threat Model & Trust Boundaries

| Boundary | Threat | Mitigation |
| --- | --- | --- |
| **Untrusted User Code** | RCE, SSRF, or credential theft during `npm install` / `npm run build` | Control plane never executes user code. Builds run in isolated workers/containers with stripped platform env vars, non-root execution, CPU/RAM/time caps, and workspace path-traversal checks. |
| **Multi-Tenant Data Access** | IDOR / BOLA accessing another user's projects, logs, or tokens | Server-side `supabase.auth.getUser()` verification, never trusting frontend `userId` payloads, enforced in depth by PostgreSQL RLS (`(select auth.uid()) = user_id`). |
| **Webhook Spoofing** | Forged GitHub push payloads triggering unauthorized builds | `X-Hub-Signature-256` verified against raw request bytes using `HMAC-SHA256` and `crypto.timingSafeEqual()` prior to JSON parsing or job creation. |
| **Secret Exposure** | Leakage of GitHub tokens, env vars, AI keys, or `SUPABASE_SERVICE_ROLE_KEY` | AES-256-GCM authenticated encryption at rest (`ENCRYPTION_MASTER_KEY`), masked previews in UI, automatic token redaction in build logs, strict separation of `NEXT_PUBLIC_*` variables. |
| **Path Traversal in Hosting** | Requests like `/sites/app/../../etc/passwd` reading host files | Artifact resolver strips `.` / `..` segments and verifies `path.resolve(root, rel)` stays strictly within the deployment's artifact prefix. |

---

## 2. Authentication & Session Controls

1. **Edge / Proxy Session Refresh (`proxy.ts`)**: Uses `@supabase/ssr` `createServerClient` + `supabase.auth.getClaims()` to verify JWT signatures locally and refresh auth cookies.
2. **Authoritative Server Checks**: Every Route Handler and Server Component calls `supabase.auth.getUser()` (which validates against Supabase Auth) — never `getSession()`.
3. **No `user_metadata` Authorization**: Authorization decisions never rely on `raw_user_meta_data` (which is user-editable).

---

## 3. Secrets & Cryptography

- **Algorithm**: `aes-256-gcm` with a 12-byte random `crypto.randomBytes(12)` IV per encryption call and a 16-byte authentication tag (`v1:<iv>:<tag>:<ciphertext>`).
- **Master Key**: 32-byte key supplied via `ENCRYPTION_MASTER_KEY` environment variable (never committed to source control or stored in Supabase).
- **Protected Fields**:
  - `github_connections.encrypted_access_token`
  - `environment_variables.encrypted_value`
  - `projects.webhook_secret_encrypted`
  - `ai_configurations.encrypted_api_key`

---

## 4. Build Worker Sandboxing Controls

1. **Environment Sanitization**: Worker builds a minimal allowlisted `env` (`PATH`, `HOME`, `TMP`, `NODE_ENV=production`, `CI=true`) plus decrypted `environment_variables` for the target project/environment. `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_MASTER_KEY`, `REDIS_URL`, `GITHUB_APP_PRIVATE_KEY`, and `AI_API_KEY` are never present in the build child process.
2. **Resource & Time Limits**:
   - Hard timeout (`BUILD_TIMEOUT_MS`, default 180s) terminating the full process tree on expiration.
   - Artifact size cap (`BUILD_MAX_OUTPUT_BYTES`, default 50 MiB).
   - Container flags (`--memory=1g --cpus=1 --pids-limit=256`) when `DOCKER_ISOLATION=true` or Cloud Run Jobs limits in managed cloud.
3. **Log Redaction**: GitHub access tokens and decrypted project secrets are scrubbed (`[REDACTED]`) before writing to `build_logs`.
