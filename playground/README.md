# Playground

Manual E2E app for `@dlukt/vue-oidc-context` ([PLAN.md](../docs/PLAN.md) M5).
It consumes the **built** library (`workspace:*` resolves to the package
`exports`, which point at `dist/`), so the root build must exist.

## Run

```bash
# from the repository root — builds the library, then starts Vite
pnpm play
```

or, while iterating on library code:

```bash
pnpm build --watch          # terminal 1: rebuild dist/ on change
pnpm --filter playground dev # terminal 2: Vite dev server
```

The app runs on **http://localhost:5173** (strict port — the IdP redirect
URIs depend on it).

## Identity provider

By default the playground talks to the public
[Duende demo IdP](https://demo.duendesoftware.com) — log in with
**bob / bob** or **alice / alice**.

Override via Vite env vars (e.g. in `playground/.env.local`):

| Variable                    | Default                               | Notes                                                      |
| --------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| `VITE_OIDC_AUTHORITY`       | `https://demo.duendesoftware.com`     | Issuer URL                                                 |
| `VITE_OIDC_CLIENT_ID`       | `interactive.public`                  | `interactive.public.short` = 75 s tokens, fast renew demo  |
| `VITE_OIDC_SCOPE`           | `openid profile email offline_access` | `offline_access` → refresh-token renew (no iframe/cookies) |
| `VITE_OIDC_MONITOR_SESSION` | off                                   | `1` enables OP session monitoring (`addUserSignedOut`)     |

### Offline fallback: local Keycloak

```bash
cd playground/keycloak
docker compose up
```

Then put this in `playground/.env.local` and restart Vite:

```ini
VITE_OIDC_AUTHORITY=http://localhost:8080/realms/playground
VITE_OIDC_CLIENT_ID=vue-playground
VITE_OIDC_SCOPE=openid profile email offline_access
```

Log in with **demo / demo** (admin console: http://localhost:8080/admin,
**admin / admin**). The imported realm uses 120 s access tokens so silent
renew is observable within a minute.

## Manual E2E checklist

Run before each release (PLAN.md §7). Watch the status bar (top) and the
error banner while going through the flows.

1. **Cold visit → login.** Open `/`, click _Log in_ → IdP → redirected back:
   URL is cleaned (no `?code&state`), profile renders, status bar shows
   `isAuthenticated: true`.
2. **Hard refresh on a guarded route while signed in.** Reload `/protected`:
   no redirect loop; content renders once init settles (guard awaits
   `auth.initialized`).
3. **Guarded route while signed out (returnTo).** Sign out, open
   `/protected?tab=42` from the address bar → IdP → lands back on
   `/protected?tab=42`, query string intact.
4. **Silent renew.** Sign in (use `interactive.public.short` or Keycloak for
   short tokens) and stay on Home: the event log shows
   `accessTokenExpiring` → `userLoaded` without any navigation; the
   expires-in counter jumps back up.
5. **Logout.** Click _Log out_ → IdP post-logout page → back at `/`,
   `isAuthenticated: false`.
6. **Foreign params + `skipSigninCallback`.** On the _Foreign callback_ page,
   follow the full-page-load link: no error banner, URL keeps the foreign
   `?code&state`, an existing session survives. Counter-demo link on the same
   page: the identical params on `/` produce an error banner with source
   `signinCallback`.
7. **`<AuthenticationRequired>`.** Signed out, open `/required`: the
   redirecting slot shows, then the IdP, then back on `/required` with the
   members-only content.
8. **Error display.** Signed out, click _Renew now (signinSilent)_ on Home:
   error banner with source `signinSilent`; it clears on the next successful
   sign-in.

> Third-party-cookie note: with the default `offline_access` scope, silent
> renew uses the refresh token and works in every browser. If you remove that
> scope, renew falls back to the hidden iframe, which requires the browser to
> send the IdP session cookie in an iframe — blocked by default in several
> browsers. The same applies to `VITE_OIDC_MONITOR_SESSION=1`.
