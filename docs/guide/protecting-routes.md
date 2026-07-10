# Protecting routes

Two tools, depending on whether you use vue-router:

- `createAuthGuard(auth)` — a [vue-router navigation guard](#vue-router-guard); the Vue-idiomatic equivalent of react-oidc-context's `withAuthenticationRequired`.
- [`AuthenticationRequired`](#authenticationrequired-component) — a component that protects a subtree, for router-less apps or finer-grained gating.

## vue-router guard

The guard ships in a separate subpath so the core entry never depends on vue-router (which stays an optional peer):

```ts
import { createRouter, createWebHistory } from "vue-router";
import { createAuthGuard } from "@dlukt/vue-oidc-context/router";
import { auth } from "./auth"; // your createOidcAuth(...) instance

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/admin", component: Admin, meta: { requiresAuth: true } },
  ],
});

router.beforeEach(createAuthGuard(auth));
```

By default the guard protects routes with `meta.requiresAuth === true`. For each protected navigation it:

1. Awaits `auth.initialized`, so a hard refresh on a protected route waits for the session lookup / signin-callback processing instead of redirecting a user who is actually signed in.
2. Allows the navigation if `isAuthenticated`.
3. Otherwise calls `auth.signinRedirect({ state: { returnTo: to.fullPath } })` and cancels the navigation.

The guard takes the `auth` instance explicitly — it never relies on `inject()`, so it works regardless of plugin registration order, and against vue-router 4 and 5 alike.

Type your `meta` field with the standard augmentation (in any `.d.ts` module of your app):

```ts
import "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    requiresAuth?: boolean;
  }
}
```

### Returning to the original route

The guard stashes the target path in `state.returnTo`; restoring it after the IdP round-trip is your `onSigninCallback`'s job:

```ts
const auth = createOidcAuth({
  // ...
  onSigninCallback: (user) => {
    const returnTo =
      (user?.state as { returnTo?: string } | undefined)?.returnTo ?? "/";
    void router.replace(returnTo); // deliberately not awaited — see below
  },
});
```

::: danger Do not await router navigation here
The guard on the target route awaits `auth.initialized`, and `initialized` resolves only after `onSigninCallback` returns — `await router.replace(...)` inside the callback deadlocks both. Fire-and-forget (`void router.replace(...)`) is safe.

Also note `window.history.replaceState` alone is not enough in a vue-router app: the router has usually already resolved its initial navigation against the callback URL and does not observe `replaceState`.
:::

### Customizing the guard

```ts
router.beforeEach(
  createAuthGuard(auth, {
    // protect everything except explicitly public routes
    shouldProtect: (to) => to.meta.public !== true,
    // customize what's passed to signinRedirect
    signinArgs: (to) => ({
      state: { returnTo: to.fullPath },
      prompt: "login",
    }),
  }),
);
```

If `signinRedirect` rejects (IdP unreachable, …), the failure lands on `auth.error` and the navigation is still cancelled.

## AuthenticationRequired component

For apps without vue-router — or to protect a subtree rather than a route:

```vue
<script setup lang="ts">
import { AuthenticationRequired } from "@dlukt/vue-oidc-context";
</script>

<template>
  <AuthenticationRequired>
    <Dashboard />
    <template #redirecting>
      <p>Redirecting to sign-in…</p>
    </template>
  </AuthenticationRequired>
</template>
```

It renders the default slot while `isAuthenticated`; otherwise it renders the `#redirecting` slot (default: nothing) and — once nothing is loading, nothing is in flight, and no auth params are in the URL — invokes the signin method **once per component instance**. A failed attempt is not retried; the failure surfaces on `error`.

Props:

```ts
interface AuthenticationRequiredProps {
  /** Default: "signinRedirect" */
  signinMethod?: "signinRedirect" | "signinPopup";
  signinArgs?: SigninRedirectArgs | SigninPopupArgs;
}
```

To land back on the same view after the redirect, pass a `returnTo` yourself (the component has no route to infer it from):

```vue
<AuthenticationRequired :signin-args="{ state: { returnTo: '/dashboard' } }">
  <Dashboard />
</AuthenticationRequired>
```
