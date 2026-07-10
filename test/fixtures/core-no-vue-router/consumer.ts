/**
 * A vue-router-free consumer of the core entry, compiled against the built
 * dist/ declarations (see tsconfig.json in this directory). Exercises the
 * SPEC §4.9 core export surface; must stay free of vue-router imports.
 */
import { createApp, defineComponent, h, inject } from "vue";
import {
  AUTH_CONTEXT_KEY,
  AuthenticationRequired,
  AuthProvider,
  createOidcAuth,
  hasAuthParams,
  useAuth,
  useAutoSignin,
} from "@dlukt/vue-oidc-context";
import type {
  AuthContext,
  ErrorContext,
  OidcAuth,
  OidcAuthOptions,
  UserManagerSettings,
} from "@dlukt/vue-oidc-context";

const options: OidcAuthOptions = {
  authority: "https://idp.example.com",
  client_id: "spa",
  redirect_uri: "https://app.example.com/",
  onSigninCallback: (user) => {
    window.history.replaceState(
      {},
      document.title,
      (user?.state as { returnTo?: string } | undefined)?.returnTo ?? "/",
    );
  },
};

export const auth: OidcAuth = createOidcAuth(options);

const Profile = defineComponent({
  setup() {
    const { user, isAuthenticated, isLoading, error, signinRedirect } =
      useAuth();
    const autoSignin = useAutoSignin({ signinMethod: "signinRedirect" });
    const lastError: ErrorContext | undefined = autoSignin.error.value;

    return () =>
      h("div", [
        isLoading.value
          ? "loading"
          : isAuthenticated.value
            ? (user.value?.profile.name ?? "signed in")
            : (error.value?.source ?? lastError?.message ?? "signed out"),
        h("button", { onClick: () => void signinRedirect() }, "sign in"),
      ]);
  },
});

const tenantSettings: UserManagerSettings = {
  authority: "https://tenant.example.com",
  client_id: "tenant",
  redirect_uri: "https://app.example.com/tenant",
};

export const App = defineComponent({
  setup() {
    return () =>
      h(AuthProvider, { settings: tenantSettings }, () =>
        h(AuthenticationRequired, null, { default: () => h(Profile) }),
      );
  },
});

export function bootstrap(): void {
  const app = createApp(App);
  app.use(auth);
  const injected: AuthContext | undefined = app.runWithContext(() =>
    inject(AUTH_CONTEXT_KEY),
  );
  void injected;
  if (!hasAuthParams()) {
    void auth.clearStaleState();
  }
  app.mount("#app");
}
