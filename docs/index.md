---
layout: home

hero:
  name: vue-oidc-context
  text: OpenID Connect for Vue 3
  tagline: A lightweight, fully typed wrapper around oidc-client-ts — react-oidc-context, ported to Vue idioms.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: API reference
      link: /api/
    - theme: alt
      text: GitHub
      link: https://github.com/dlukt/vue-oidc-context

features:
  - title: Thin wrapper
    details: All protocol work — authorization code + PKCE, token storage, silent renew, session monitoring — stays in oidc-client-ts. This library only bridges it into Vue's reactivity system.
  - title: react-oidc-context parity
    details: Same option names, same lifecycle, same callbacks. A migrating user copies their config object unchanged and keeps using the upstream documentation.
  - title: Vue-idiomatic
    details: An app.use() plugin, destructurable composables, renderless components, and a vue-router navigation guard instead of HOCs.
  - title: Fully typed & SSR-safe
    details: TypeScript strict throughout; option and return types come straight from oidc-client-ts. Importable and installable in Node without touching window.
---

## Install

```bash
pnpm add @dlukt/vue-oidc-context oidc-client-ts
```

> Published under the `@dlukt` scope — the unscoped npm name `vue-oidc-context` belongs to an unrelated package.

## At a glance

```ts
// main.ts
import { createApp } from "vue";
import { createOidcAuth } from "@dlukt/vue-oidc-context";
import App from "./App.vue";

const auth = createOidcAuth({
  authority: "https://demo.duendesoftware.com",
  client_id: "interactive.public",
  redirect_uri: `${window.location.origin}/`,
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
});

createApp(App).use(auth).mount("#app");
```

```vue
<script setup lang="ts">
import { useAuth } from "@dlukt/vue-oidc-context";

const { user, isAuthenticated, isLoading, signinRedirect, signoutRedirect } =
  useAuth();
</script>

<template>
  <div v-if="isLoading">Signing you in/out…</div>
  <template v-else-if="isAuthenticated">
    Hello {{ user?.profile.name }}
    <button @click="signoutRedirect()">Log out</button>
  </template>
  <button v-else @click="signinRedirect()">Log in</button>
</template>
```
