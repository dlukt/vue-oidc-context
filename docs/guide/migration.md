# Migration from react-oidc-context

This library is a deliberate port of react-oidc-context v3: same thin-wrapper philosophy, same option names, same lifecycle. Migrating is mostly mechanical.

## Configuration: copy it unchanged

`createOidcAuth()` takes exactly the flat shape of `AuthProviderProps` — `UserManagerSettings` keys and callbacks side by side:

::: code-group

```tsx [React (before)]
import { AuthProvider } from "react-oidc-context";

const oidcConfig = {
  authority: "https://idp.example.com",
  client_id: "spa",
  redirect_uri: `${window.location.origin}/`,
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};

root.render(
  <AuthProvider {...oidcConfig}>
    <App />
  </AuthProvider>,
);
```

```ts [Vue (after)]
import { createOidcAuth } from "@dlukt/vue-oidc-context";

const oidcConfig = {
  authority: "https://idp.example.com",
  client_id: "spa",
  redirect_uri: `${window.location.origin}/`,
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};

createApp(App).use(createOidcAuth(oidcConfig)).mount("#app");
```

:::

All callbacks keep their names and semantics: `onSigninCallback`, `skipSigninCallback`, `matchSignoutCallback`, `onSignoutCallback`, `onRemoveUser`.

## API mapping

| react-oidc-context                            | @dlukt/vue-oidc-context                                                                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `<AuthProvider {...oidcConfig}>` (app root)   | `app.use(createOidcAuth(oidcConfig))` — same flat config object                                                       |
| `<AuthProvider>` (nested / multi-IdP)         | [`<AuthProvider :settings="…">` component](./multi-tenant.md)                                                         |
| `const auth = useAuth()`                      | `const { user, isAuthenticated, … } = useAuth()` — destructure; fields are refs                                       |
| `auth.isLoading` (plain boolean)              | `isLoading.value` in script, `isLoading` in templates                                                                 |
| `withAuthenticationRequired(Component, opts)` | [`createAuthGuard(auth)`](./protecting-routes.md) + `meta.requiresAuth`, or `AuthenticationRequired` (component tree) |
| `withAuth(Component)`                         | not ported — use `useAuth()` / provider slot props                                                                    |
| `useAutoSignin(opts)`                         | `useAutoSignin(opts)` — identical                                                                                     |
| `hasAuthParams()`                             | `hasAuthParams()` — identical                                                                                         |
| `AuthContext` (React context object)          | `AUTH_CONTEXT_KEY` (Vue injection key)                                                                                |

## The one real difference: reactivity

React re-renders with plain values; Vue hands you refs. The state fields (`user`, `isLoading`, `isAuthenticated`, `activeNavigator`, `error`) are read-only refs on the context object:

```ts
// React
if (auth.isLoading) { ... }

// Vue (script)
const { isLoading } = useAuth();
if (isLoading.value) { ... }
```

In templates, destructured refs unwrap automatically — `v-if="isLoading"` just works. Two things to keep in mind:

- Don't destructure _through_ the object into plain values once and expect updates (`const loading = useAuth().isLoading.value` is a snapshot).
- If you keep the whole context (`const auth = useAuth()`), nested refs don't unwrap in templates — write `auth.isLoading.value`.

## Behavior parity notes

Everything below matches react-oidc-context, so upstream docs, issues, and intuition carry over:

- The initialization sequence (signin-callback processing, `getUser()` fallback) and its error handling.
- URL cleanup is **your** job in `onSigninCallback` — but in a vue-router app prefer `void router.replace(...)` over `history.replaceState` ([why](./protecting-routes.md#returning-to-the-original-route)).
- `addUserSignedOut` keeps `user` but flips `isAuthenticated` to `false`.
- `isAuthenticated` is not time-reactive: a token expiring does not by itself flip it.
- Navigator failures land on `error` _and_ the returned promise still rejects.
- Teardown only unsubscribes events — it never calls `stopSilentRenew()` or clears storage.
