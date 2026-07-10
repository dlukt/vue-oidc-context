# Multi-tenant & AuthProvider

The plugin covers the common case: one IdP, app-wide. For nested contexts — multi-tenant admin areas, a second IdP for an embedded product, tests — use the renderless `AuthProvider` component. It `provide()`s an auth context to its subtree, shadowing any plugin-provided one.

```vue
<script setup lang="ts">
import { AuthProvider } from "@dlukt/vue-oidc-context";
import { tenantSettings } from "./tenants";

function stripUrl() {
  window.history.replaceState({}, document.title, window.location.pathname);
}
</script>

<template>
  <AuthProvider :settings="tenantSettings" :on-signin-callback="stripUrl">
    <TenantAdminArea />
  </AuthProvider>
</template>
```

Inside the subtree, `useAuth()` resolves the nearest provider — components written against `useAuth()` work unchanged under the plugin or any provider.

## Props

`UserManagerSettings` are passed as a single `settings` object prop (templates can't spread 40 flat props), plus the same callbacks the plugin takes:

```ts
interface AuthProviderProps extends AuthCallbacks {
  settings?: UserManagerSettings;
  /** Bring-your-own UserManager. Exactly one of settings/userManager must be set. */
  userManager?: UserManager;
}
```

- Exactly one of `settings` / `userManager` must be set; setup throws otherwise.
- Props are read **once** when the provider is created — changing them later has no effect (parity: react-oidc-context fixes its UserManager on first render). To reconfigure, `v-if` the provider away and back, or key it: `<AuthProvider :key="tenantId" …>`.
- Event subscriptions are disposed with the component's effect scope on unmount.

## Slot props

The default slot receives the context with its refs unwrapped to plain values, so no `.value` is needed in the slot template:

```vue
<AuthProvider
  :settings="tenantSettings"
  v-slot="{ isAuthenticated, user, signinRedirect }"
>
  <p v-if="isAuthenticated">Hello {{ user?.profile.name }}</p>
  <button v-else @click="signinRedirect()">Tenant login</button>
</AuthProvider>
```

(Slot props are not top-level template bindings, so Vue would not auto-unwrap refs there — the component unwraps them per render instead.)

## Nesting and isolation

- Providers nest; `useAuth()` always resolves the nearest one, and each maintains independent state.
- Multiple contexts on one page are supported. Storage isolation follows oidc-client-ts key derivation (per authority + client): two providers pointing at the same `authority` + `client_id` share storage keys — that's oidc-client-ts behavior, not something this library changes.
- The plugin and the component produce the same context shape from the same core; the only difference is scope and lifetime.
