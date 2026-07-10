# Getting started

## Install

```bash
pnpm add @dlukt/vue-oidc-context oidc-client-ts
```

`vue` ≥ 3.5 and `oidc-client-ts` ≥ 3.3 are peer dependencies. `vue-router` (4.2+ or 5) is only needed if you use [the router guard](./protecting-routes.md).

## Create the auth plugin

`createOidcAuth()` takes flat [`UserManagerSettings`](https://authts.github.io/oidc-client-ts/interfaces/UserManagerSettings.html) plus a handful of [callbacks](./callbacks.md) — the exact shape of react-oidc-context's provider props:

```ts
// main.ts
import { createApp } from "vue";
import { createOidcAuth } from "@dlukt/vue-oidc-context";
import App from "./App.vue";

const auth = createOidcAuth({
  authority: "https://demo.duendesoftware.com",
  client_id: "interactive.public",
  redirect_uri: `${window.location.origin}/`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  onSigninCallback: () => {
    // strip ?code=...&state=... from the URL after the redirect completes
    window.history.replaceState({}, document.title, window.location.pathname);
  },
});

createApp(App).use(auth).mount("#app");
```

In the browser, the instance starts working immediately — `createOidcAuth()` constructs the `UserManager` and begins processing any signin callback in the URL before `app.use()` runs. That makes `auth` usable outside components too: in router guards, fetch interceptors, or plain modules.

If you already have a configured `UserManager`, pass it instead of settings:

```ts
const auth = createOidcAuth({ userManager: myUserManager });
```

## Use it in components

`useAuth()` returns the auth context. Its state fields are refs — **destructure them** and they stay reactive, and auto-unwrap in templates:

```vue
<script setup lang="ts">
import { useAuth } from "@dlukt/vue-oidc-context";

const {
  user,
  isAuthenticated,
  isLoading,
  error,
  signinRedirect,
  signoutRedirect,
} = useAuth();
</script>

<template>
  <div v-if="isLoading">Signing you in/out…</div>
  <div v-else-if="error">Oops… {{ error.message }} ({{ error.source }})</div>
  <template v-else-if="isAuthenticated">
    Hello {{ user?.profile.name }}
    <button @click="signoutRedirect()">Log out</button>
  </template>
  <button v-else @click="signinRedirect()">Log in</button>
</template>
```

::: warning Reactivity gotcha
If you keep the whole object (`const auth = useAuth()`), nested refs do **not** unwrap in templates: write `auth.user.value` in script and `auth.user?.value` in templates — or just destructure.
:::

### The state fields

| Field             | Type                                    | Semantics                                                                                          |
| ----------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `user`            | `ShallowRef<User \| null \| undefined>` | `undefined` until initialization settles, then `User` or `null`                                    |
| `isLoading`       | `Ref<boolean>`                          | `true` during initialization and while any signin/signout method is in flight                      |
| `isAuthenticated` | `ComputedRef<boolean>`                  | a non-expired user is loaded (not time-reactive — see [SPEC §5.3](../SPEC.md))                     |
| `activeNavigator` | `Ref<NavigatorKey \| undefined>`        | which signin/signout method is currently in flight                                                 |
| `error`           | `ShallowRef<ErrorContext \| undefined>` | last init/renew/navigation error, tagged with a `source`; cleared on the next successful user load |

Beyond state, the context exposes every `UserManager` method (`signinRedirect`, `signinPopup`, `signinSilent`, `signoutRedirect`, `removeUser`, …), the resolved `settings`, and the raw `events` bus — see the [API reference](../api/index.md).

## Waiting for initialization

`auth.initialized` resolves once the startup sequence (signin-callback processing + session lookup) has settled — successfully or with `error` set. Useful before `router.isReady()` or in guards:

```ts
await auth.initialized;
if (auth.isAuthenticated.value) {
  // restored session
}
```

## Automatic sign-in

To send visitors straight to the IdP when they have no session, call `useAutoSignin()` in a component (typically once, near the root):

```vue
<script setup lang="ts">
import { useAutoSignin } from "@dlukt/vue-oidc-context";

const { isAuthenticated, isLoading, error } = useAutoSignin();
// or: useAutoSignin({ signinMethod: "signinPopup" })
</script>
```

It attempts sign-in **once per auth context** — no matter how many components call it — and only when the URL carries no auth params, nothing is loading, and no user is signed in. A failed attempt is not retried; the failure lands on `error`.

## Next steps

- [Protecting routes](./protecting-routes.md) — vue-router guard and the `AuthenticationRequired` component
- [Callbacks & URL cleanup](./callbacks.md) — what happens on startup, and the hooks into it
- [Migration from react-oidc-context](./migration.md)
