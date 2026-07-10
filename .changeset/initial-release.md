---
"@dlukt/vue-oidc-context": minor
---

Initial release. OpenID Connect / OAuth 2.0 authentication for Vue 3, a port of react-oidc-context on top of oidc-client-ts:

- `createOidcAuth()` plugin with reactive auth state (`user`, `isLoading`, `isAuthenticated`, `activeNavigator`, `error`) and the full `UserManager` method surface
- `useAuth()` and `useAutoSignin()` composables
- `<AuthProvider>` (component-scoped contexts, multi-tenant) and `<AuthenticationRequired>` components
- `createAuthGuard()` for vue-router 4/5 via the `@dlukt/vue-oidc-context/router` subpath
- react-oidc-context–compatible callbacks (`onSigninCallback`, `skipSigninCallback`, `matchSignoutCallback`, `onSignoutCallback`, `onRemoveUser`) and `hasAuthParams()`
- SSR-safe: importable and installable in Node without touching `window`
