<script setup lang="ts">
import { useAuth } from "@dlukt/vue-oidc-context";
import { useRoute } from "vue-router";

const { user } = useAuth();
const route = useRoute();
</script>

<template>
  <h1>Protected route</h1>
  <p>
    Guarded by <code>createAuthGuard</code> +
    <code>meta.requiresAuth</code> (SPEC §4.5). You only see this while
    authenticated — hello
    <strong>{{ user?.profile.name ?? user?.profile.sub }}</strong
    >.
  </p>
  <p>
    Current fullPath: <code>{{ route.fullPath }}</code>
  </p>
  <p class="hint">
    returnTo check: sign out, then open
    <code>/protected?tab=42</code> directly (address bar). The guard stashes the
    fullPath in <code>state.returnTo</code>, and after the IdP round-trip
    <code>onSigninCallback</code> restores it — query string included.
  </p>
  <p class="hint">
    Hard-refresh check: while signed in, hit reload on this page. The guard
    awaits <code>auth.initialized</code>, so the session is restored from
    storage without a redirect loop.
  </p>
</template>
