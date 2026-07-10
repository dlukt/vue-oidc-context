# vue-oidc-context

[![CI](https://github.com/dlukt/vue-oidc-context/actions/workflows/ci.yml/badge.svg)](https://github.com/dlukt/vue-oidc-context/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40dlukt%2Fvue-oidc-context)](https://www.npmjs.com/package/@dlukt/vue-oidc-context)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

OpenID Connect (OIDC) & OAuth 2.0 authentication for Vue 3 — a lightweight, fully typed wrapper around [oidc-client-ts](https://github.com/authts/oidc-client-ts), ported from [react-oidc-context](https://github.com/authts/react-oidc-context). Same option names, same lifecycle, same callbacks — exposed as a Vue plugin, composables, components, and a vue-router guard.

**Documentation: https://dlukt.github.io/vue-oidc-context/** · API contract: [docs/SPEC.md](docs/SPEC.md) · Roadmap: [docs/PLAN.md](docs/PLAN.md)

> Published as **`@dlukt/vue-oidc-context`** — the unscoped npm name `vue-oidc-context` belongs to an unrelated package.

## Install

```bash
pnpm add @dlukt/vue-oidc-context oidc-client-ts
```

Peers: `vue` ≥ 3.5, `oidc-client-ts` ≥ 3.3, and optionally `vue-router` 4.2+/5 for the guard.

## Quickstart

### 1. Create the plugin

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

The options object is flat `UserManagerSettings` + callbacks — a react-oidc-context config works unchanged.

### 2. Use the auth state

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

The fields are refs — destructure them (they auto-unwrap in templates). The context also exposes the full `UserManager` method surface (`signinPopup`, `signinSilent`, `removeUser`, `querySessionStatus`, …), `settings`, and the raw `events` bus.

### 3. Protect routes (vue-router)

```ts
import { createRouter, createWebHistory } from "vue-router";
import { createAuthGuard } from "@dlukt/vue-oidc-context/router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/admin", component: Admin, meta: { requiresAuth: true } },
  ],
});

router.beforeEach(createAuthGuard(auth));
```

Unauthenticated visits to protected routes redirect to the IdP with `state.returnTo` set to the target path; restore it in `onSigninCallback` with `void router.replace(returnTo)`. See [Protecting routes](https://dlukt.github.io/vue-oidc-context/guide/protecting-routes) for the full recipe (and the pitfalls).

## More

- [`<AuthProvider>`](https://dlukt.github.io/vue-oidc-context/guide/multi-tenant) — component-scoped contexts for multi-tenant / multi-IdP apps
- [`<AuthenticationRequired>`](https://dlukt.github.io/vue-oidc-context/guide/protecting-routes#authenticationrequired-component) — subtree protection without vue-router
- [`useAutoSignin()`](https://dlukt.github.io/vue-oidc-context/guide/getting-started#automatic-sign-in) — send visitors straight to the IdP
- [SSR & Nuxt](https://dlukt.github.io/vue-oidc-context/guide/ssr) — SSR-safe by construction; Nuxt client-plugin recipe
- [Migration from react-oidc-context](https://dlukt.github.io/vue-oidc-context/guide/migration)
- [Playground](playground/README.md) — runnable demo app against the public Duende demo IdP (or local Keycloak)

## License

[MIT](LICENSE)
