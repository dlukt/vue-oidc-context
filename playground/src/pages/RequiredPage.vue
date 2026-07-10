<script setup lang="ts">
import { AuthenticationRequired, useAuth } from "@dlukt/vue-oidc-context";
import { useRoute } from "vue-router";

const { user } = useAuth();
const route = useRoute();
// Mirror the guard's default returnTo behavior (SPEC §4.5) so signing in from
// here lands back on this page instead of "/".
const signinArgs = { state: { returnTo: route.fullPath } };
</script>

<template>
  <h1>&lt;AuthenticationRequired&gt;</h1>
  <p>
    This route is <em>not</em> guarded by the router — the subtree below
    protects itself (SPEC §4.6). While signed out it renders the
    <code>#redirecting</code> slot and calls <code>signinRedirect</code> once.
  </p>
  <AuthenticationRequired :signin-args="signinArgs">
    <p>
      Members only — hello
      <strong>{{ user?.profile.name ?? user?.profile.sub }}</strong
      >.
    </p>
    <template #redirecting>
      <p>Redirecting to sign-in…</p>
    </template>
  </AuthenticationRequired>
</template>
