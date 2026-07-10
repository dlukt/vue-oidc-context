# Callbacks & URL cleanup

## What happens on startup

Once per context (plugin creation or `AuthProvider` mount), in the browser, the library runs the same initialization sequence as react-oidc-context:

1. If the URL carries an OIDC authorization response (`?code=…&state=…` or `?error=…&state=…`, query or fragment) and `skipSigninCallback` is not set: `userManager.signinCallback()` is awaited, then your `onSigninCallback(user)`.
2. Otherwise the stored session is looked up with `userManager.getUser()`.
3. `user` is committed (`null` if none), `isLoading` flips to `false`. On failure, `error` is set with `source: "signinCallback"`.
4. Independently, if `matchSignoutCallback(settings)` returns `true`: `userManager.signoutCallback()` is awaited, then your `onSignoutCallback(resp)`.
5. `auth.initialized` resolves — it never rejects; failures surface on `error`.

The full contract lives in [SPEC §5](../SPEC.md).

## `onSigninCallback` — cleaning the URL

The library deliberately does **not** remove `?code&state` from the address bar (parity with react-oidc-context) — that's your `onSigninCallback`:

::: code-group

```ts [vue-router app]
onSigninCallback: (user) => {
  const returnTo =
    (user?.state as { returnTo?: string } | undefined)?.returnTo ?? "/";
  // Not awaited: a guard awaiting auth.initialized would deadlock otherwise.
  void router.replace(returnTo);
},
```

```ts [router-less app]
onSigninCallback: () => {
  window.history.replaceState({}, document.title, window.location.pathname);
},
```

:::

See [Protecting routes](./protecting-routes.md#returning-to-the-original-route) for why the vue-router variant must not be awaited and why `replaceState` alone doesn't work there.

## `skipSigninCallback` — foreign auth params

If a page in your app receives `?code&state` that belong to a _different_ OAuth integration, initialization would try to process them and fail. Skip it for those URLs:

```ts
createOidcAuth({
  // ...
  skipSigninCallback: window.location.pathname === "/stripe-connect-callback",
});
```

The value is read once, when the context is created (i.e. per full page load). The stored session is still restored via `getUser()`; the URL is left untouched.

## `matchSignoutCallback` / `onSignoutCallback`

If your `post_logout_redirect_uri` points back into the app and you need to process the signout response (e.g. to read `state` passed to `signoutRedirect`):

```ts
createOidcAuth({
  // ...
  post_logout_redirect_uri: `${window.location.origin}/signed-out`,
  matchSignoutCallback: (settings) =>
    window.location.href.startsWith(settings.post_logout_redirect_uri!),
  onSignoutCallback: (resp) => {
    window.history.replaceState({}, document.title, "/");
  },
});
```

## `onRemoveUser`

Invoked after `auth.removeUser()` completes — e.g. to clear app state alongside the local session:

```ts
createOidcAuth({
  // ...
  onRemoveUser: () => {
    pinia.state.value = {};
  },
});
```

`removeUser()` only clears the local session; it does not end the IdP session (use `signoutRedirect` for that).

## Errors

All failures funnel into the `error` ref as an `ErrorContext` — an `Error` tagged with the operation that produced it:

```ts
type ErrorSource =
  | "signinCallback"
  | "signoutCallback"
  | "renewSilent"
  | "signinRedirect"
  | "signinPopup"
  | "signinSilent"
  | "signinResourceOwnerCredentials"
  | "signoutRedirect"
  | "signoutPopup"
  | "signoutSilent"
  | "unknown";

type ErrorContext = Error & {
  source: ErrorSource;
  /** Original thrown value when it was not an Error instance. */
  innerError?: unknown;
};
```

- Initialization failures set `source: "signinCallback"` / `"signoutCallback"`.
- Silent-renew failures (from the `UserManagerEvents` bus) set `source: "renewSilent"`.
- Navigator methods (`signinRedirect()`, …) set their own name as `source` **and still reject**, so imperative callers can `try/catch` while templates render the ref.
- `error` clears on the next successful user load.

```vue
<template>
  <p v-if="error">{{ error.source }}: {{ error.message }}</p>
</template>
```
