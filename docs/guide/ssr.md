# SSR & Nuxt

The library is SSR-safe by construction:

- Importing any entry point is side-effect free and never touches `window` / `document`.
- Environment detection happens at **construction** time (`typeof window !== "undefined"`), not import time.
- On the server, `createOidcAuth()` creates an _inert_ context: `user` stays `undefined`, `isLoading` stays `true`, `initialized` stays pending, and every navigator / pass-through method rejects with a descriptive `"…is only available in a browser"` error. (react-oidc-context behaves the same way with its unsupported-environment stubs.)

Practical consequences:

- **Gate auth-dependent UI on `isLoading`** — during SSR (and the first client render before hydration settles) it is `true`, so `v-if="isLoading"` markup matches between server and client.
- **Never `await auth.initialized` in server-executed code** — it stays pending there forever. In universal code, guard it: `if (typeof window !== "undefined") await auth.initialized`.
- Route guards created with `createAuthGuard` await `initialized`, so run them client-side only (see the Nuxt middleware note below).

## Nuxt recipe

There is no Nuxt module yet (tracked as future work) — a client-only plugin is all it takes:

```ts
// plugins/oidc.client.ts  (the .client suffix = browser only)
import { createOidcAuth } from "@dlukt/vue-oidc-context";

export default defineNuxtPlugin((nuxtApp) => {
  const auth = createOidcAuth({
    authority: "https://demo.duendesoftware.com",
    client_id: "interactive.public",
    redirect_uri: `${window.location.origin}/`,
    onSigninCallback: () => {
      window.history.replaceState({}, document.title, window.location.pathname);
    },
  });

  nuxtApp.vueApp.use(auth);
  return { provide: { oidc: auth } };
});
```

Then in components:

```vue
<script setup lang="ts">
import { useAuth } from "@dlukt/vue-oidc-context";

// only rendered client-side below, but useAuth() itself is safe anywhere
const { user, isAuthenticated, isLoading, signinRedirect } = useAuth();
</script>

<template>
  <ClientOnly>
    <div v-if="isLoading">…</div>
    <p v-else-if="isAuthenticated">Hello {{ user?.profile.name }}</p>
    <button v-else @click="signinRedirect()">Log in</button>
  </ClientOnly>
</template>
```

`useAuth()` throws if no context was provided above the component. With a `.client.ts` plugin the context only exists in the browser, so either render auth UI inside `<ClientOnly>` (as above) or provide a server fallback yourself.

For protected pages, use a **client-side** route middleware around the plugin-provided instance:

```ts
// middleware/auth.ts
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return; // session lives in the browser
  const { $oidc } = useNuxtApp();
  await $oidc.initialized;
  if (!$oidc.isAuthenticated.value) {
    await $oidc.signinRedirect({ state: { returnTo: to.fullPath } });
    return abortNavigation();
  }
});
```
