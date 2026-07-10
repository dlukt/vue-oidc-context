<script setup lang="ts">
import { useAuth } from "@dlukt/vue-oidc-context";
import { computed, onUnmounted, ref } from "vue";

const auth = useAuth();
const { user, isAuthenticated } = auth;

// Navigator rejections also land on the error ref (SPEC §5.4), which the
// banner in App.vue renders — swallow them here to keep the console clean.
function login() {
  auth.signinRedirect().catch(() => {});
}
function logout() {
  auth.signoutRedirect().catch(() => {});
}
function renewNow() {
  auth.signinSilent().catch(() => {});
}
// removeUser is a plain pass-through: rejections do NOT land on the error ref.
function removeUserLocal() {
  auth.removeUser().catch(console.error);
}

// --- silent-renew observability (raw oidc-client-ts event bus) --------------
const log = ref<string[]>([]);
function push(line: string) {
  log.value.unshift(`${new Date().toLocaleTimeString()}  ${line}`);
}
const unsubscribe = [
  auth.events.addUserLoaded((u) =>
    push(`userLoaded — expires in ${u.expires_in}s`),
  ),
  auth.events.addAccessTokenExpiring(() => push("accessTokenExpiring")),
  auth.events.addAccessTokenExpired(() => push("accessTokenExpired")),
  auth.events.addSilentRenewError((e) =>
    push(`silentRenewError — ${e.message}`),
  ),
];
onUnmounted(() => unsubscribe.forEach((off) => off()));

const now = ref(Math.floor(Date.now() / 1000));
const tick = setInterval(() => {
  now.value = Math.floor(Date.now() / 1000);
}, 1000);
onUnmounted(() => clearInterval(tick));
const expiresIn = computed(() =>
  user.value?.expires_at != null
    ? user.value.expires_at - now.value
    : undefined,
);

// --- pass-through demo -------------------------------------------------------
const sessionStatus = ref<string>();
async function checkSession() {
  try {
    const status = await auth.querySessionStatus();
    sessionStatus.value = status ? JSON.stringify(status) : "null (no session)";
  } catch (err) {
    sessionStatus.value = `rejected: ${(err as Error).message}`;
  }
}
</script>

<template>
  <h1>vue-oidc-context playground</h1>

  <h2>Session</h2>
  <p>
    <button @click="login">Log in (signinRedirect)</button>
    <button @click="logout">Log out (signoutRedirect)</button>
    <button @click="removeUserLocal">Remove user (local only)</button>
  </p>
  <p class="hint">
    Duende demo logins: <code>bob / bob</code> or <code>alice / alice</code>.
    After the redirect back, the URL is cleaned by
    <code>onSigninCallback</code> (see <code>src/main.ts</code>).
  </p>
  <template v-if="isAuthenticated">
    <p>
      Hello <strong>{{ user?.profile.name ?? user?.profile.sub }}</strong>
    </p>
    <pre>{{ user?.profile }}</pre>
  </template>

  <h2>Tokens &amp; silent renew</h2>
  <p v-if="user">
    <code>{{ user.token_type }}</code> token, scopes
    <code>{{ user.scopes.join(" ") }}</code
    >, expires in <strong>{{ expiresIn }}s</strong>
  </p>
  <p>
    <button @click="renewNow">Renew now (signinSilent)</button>
    <span class="hint">
      while signed out this rejects → error banner with source
      <code>signinSilent</code>
    </span>
  </p>
  <p class="hint">
    Automatic silent renew is on by default; with the
    <code>interactive.public.short</code> client (75&nbsp;s tokens) a
    <code>userLoaded</code> line appears roughly every minute:
  </p>
  <ul class="log">
    <li v-for="(line, i) in log" :key="log.length - i">{{ line }}</li>
  </ul>

  <h2>Pass-through: querySessionStatus</h2>
  <p>
    <button @click="checkSession">Query session status</button>
    <code v-if="sessionStatus">{{ sessionStatus }}</code>
  </p>
</template>
