<script setup lang="ts">
import { hasAuthParams } from "@dlukt/vue-oidc-context";

// Read once at setup: a full-page load with foreign params re-runs context
// initialization, which is what skipSigninCallback influences.
const authParamsPresent = hasAuthParams();
const currentUrl = window.location.href;
</script>

<template>
  <h1>Foreign callback (skipSigninCallback)</h1>
  <p>
    <code>src/main.ts</code> creates the context with
    <code>skipSigninCallback: location.pathname === "/foreign"</code> —
    simulating a page whose <code>?code&amp;state</code> belong to a
    <em>different</em> OAuth integration (SPEC §4.1).
  </p>
  <p>
    Auth params in current URL: <code>{{ authParamsPresent }}</code>
    <span class="hint"
      >(URL: <code>{{ currentUrl }}</code
      >)</span
    >
  </p>
  <p>
    <a href="/foreign?code=not-ours&state=not-ours">
      Full-page load of /foreign?code=not-ours&amp;state=not-ours
    </a>
    — a plain anchor, because only a fresh document load re-runs initialization.
    Expected: no error banner, the URL keeps the foreign params, and an existing
    session is still restored via
    <code>getUser()</code>.
  </p>
  <p>
    Counter-demo:
    <a href="/?code=not-ours&state=not-ours">the same params on /</a> — there
    initialization processes them, <code>signinCallback()</code> finds no
    matching state, and the error banner shows <code>signinCallback</code> as
    the source.
  </p>
</template>
