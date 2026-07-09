import type { App } from "vue";

import { createAuthContext } from "./context";
import { AUTH_CONTEXT_KEY } from "./injection";
import type { OidcAuth, OidcAuthOptions } from "./types";

/** Creates the auth instance (SPEC §4.1). In the browser, the UserManager is created
 *  and the initialization sequence starts here — not on install() — so the instance
 *  is fully usable without a Vue app (router guards, interceptors). */
export function createOidcAuth(options: OidcAuthOptions): OidcAuth {
  const { context, initialized, dispose } = createAuthContext(options);
  const installedApps = new WeakSet<App>();
  let installCount = 0;

  return {
    ...context,
    initialized,
    install(app: App): void {
      if (installedApps.has(app)) {
        console.warn(
          "[@dlukt/vue-oidc-context] this createOidcAuth() instance is already installed on the app; ignoring.",
        );
        return;
      }
      installedApps.add(app);
      installCount += 1;
      app.provide(AUTH_CONTEXT_KEY, context);
      // Event subscriptions live until the last app using this instance unmounts (SPEC §5.5).
      app.onUnmount(() => {
        installCount -= 1;
        if (installCount === 0) dispose();
      });
    },
  };
}
