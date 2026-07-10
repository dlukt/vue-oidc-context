import { createOidcAuth } from "@dlukt/vue-oidc-context";
import { createAuthGuard } from "@dlukt/vue-oidc-context/router";
import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";

import App from "./App.vue";
import ForeignPage from "./pages/ForeignPage.vue";
import HomePage from "./pages/HomePage.vue";
import ProtectedPage from "./pages/ProtectedPage.vue";
import RequiredPage from "./pages/RequiredPage.vue";
import "./style.css";

// Route that simulates a *different* OAuth integration's callback page — its
// ?code&state must not be consumed by this context (see ForeignPage.vue).
export const FOREIGN_CALLBACK_PATH = "/foreign";

const env = import.meta.env;

const auth = createOidcAuth({
  authority: env.VITE_OIDC_AUTHORITY ?? "https://demo.duendesoftware.com",
  client_id: env.VITE_OIDC_CLIENT_ID ?? "interactive.public",
  redirect_uri: `${window.location.origin}/`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  // offline_access → silent renew uses the refresh token, which keeps working
  // when the browser partitions/blocks third-party cookies (the iframe
  // prompt=none fallback would not). Without it, renew falls back to the
  // hidden iframe; that also works here because silent_redirect_uri defaults
  // to redirect_uri and init's signinCallback() routes si:s responses to the
  // parent frame.
  scope: env.VITE_OIDC_SCOPE ?? "openid profile email offline_access",
  // Opt-in (VITE_OIDC_MONITOR_SESSION=1): OP session monitoring, which fires
  // addUserSignedOut when the session ends at the IdP. Needs a browser that
  // does not block third-party cookies for the check-session iframe.
  monitorSession: env.VITE_OIDC_MONITOR_SESSION === "1",
  skipSigninCallback: window.location.pathname === FOREIGN_CALLBACK_PATH,
  onSigninCallback(user) {
    // Restore the route the guard stashed in state.returnTo (SPEC §4.5) and
    // drop ?code&state from the URL. Deliberately NOT awaited: the guard on
    // the target route awaits auth.initialized, which in turn awaits this
    // callback — awaiting the navigation here would deadlock.
    const returnTo =
      (user?.state as { returnTo?: string } | undefined)?.returnTo ?? "/";
    void router.replace(returnTo);
  },
  onRemoveUser() {
    console.info("[playground] onRemoveUser: user removed from storage");
  },
});

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomePage },
    {
      path: "/protected",
      component: ProtectedPage,
      meta: { requiresAuth: true },
    },
    { path: "/required", component: RequiredPage },
    { path: FOREIGN_CALLBACK_PATH, component: ForeignPage },
  ],
});
router.beforeEach(createAuthGuard(auth));

createApp(App).use(auth).use(router).mount("#app");
