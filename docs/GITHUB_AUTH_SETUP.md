# GitHub Authentication Setup & Architecture

## Why `Unsupported provider: provider is not enabled` occurred

When clicking **Continue with GitHub**, `@supabase/supabase-js` `signInWithOAuth({ provider: "github" })` navigates the browser to Supabase Auth (`https://ufmfbsrthpjahrnawirg.supabase.co/auth/v1/authorize?provider=github`).

If the GitHub OAuth provider is disabled in your Supabase project, Supabase GoTrue responds with HTTP `400`:

```json
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```

## How QuantumHost Fixes This

QuantumHost implements a resilient dual-mode GitHub authentication layer:

1. **Pre-Flight Provider Check (`/api/auth/github/check`)**:
   Before redirecting away from the app, `GithubAuthButton` queries `/api/auth/github/check`, which probes Supabase GoTrue and inspects server OAuth credentials.
2. **Guided Setup Modal (`GithubAuthSetupModal`)**:
   If neither Supabase GitHub OAuth nor direct server OAuth credentials are configured yet, QuantumHost stays on `/login` or `/register` and opens an interactive setup dialog with copyable callback URLs, dashboard shortcuts, and one-click verification instead of stranding users on a raw HTTP 400 JSON page.
3. **Direct GitHub OAuth Bridge (`/api/auth/github/start` & `/api/auth/github/callback`)**:
   If `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` are configured in `.env.local` / Vercel, QuantumHost can complete GitHub OAuth directly on the server, upsert `profiles` and `github_connections`, and issue a verified Supabase session via `verifyOtp`.
4. **Automatic Repository Token Capture (`/auth/callback`)**:
   When using native Supabase GitHub OAuth, `/auth/callback` captures `session.provider_token` (when granted) and stores the encrypted GitHub connection in `github_connections`.

---

## How to Enable GitHub Login (Recommended: Supabase Native OAuth)

1. Open [GitHub OAuth Apps](https://github.com/settings/applications/new) and create a new OAuth App:
   - **Application name**: `QuantumHost`
   - **Homepage URL**: `http://localhost:3000` (or your Vercel deployment URL)
   - **Authorization callback URL**:
     ```text
     https://ufmfbsrthpjahrnawirg.supabase.co/auth/v1/callback
     ```
2. Copy the generated **Client ID** and **Client Secret**.
3. Open [Supabase Dashboard → Authentication → Providers → GitHub](https://supabase.com/dashboard/project/ufmfbsrthpjahrnawirg/auth/providers).
4. Toggle **GitHub enabled** to **ON**, paste the **Client ID** and **Client Secret**, and click **Save**.
5. Return to `/login` or `/register` and click **Verify & Continue with GitHub**.

## Alternative: Direct Server OAuth Bridge

Add these variables to `.env.local` (and Vercel Project Environment Variables):

```env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Set your GitHub OAuth App's Authorization callback URL to:

```text
http://localhost:3000/api/auth/github/callback
```
(or `https://<your-domain>/api/auth/github/callback` in production).
