/**
 * @dlukt/vue-oidc-context/router — vue-router integration entry.
 * Kept as a separate build entry so the core entry's type declarations never
 * reference vue-router (SPEC §3). Imports from vue-router are type-only; the
 * guard uses only API that is identical across the ^4.2 and ^5 majors.
 */
import type { SigninRedirectArgs } from "oidc-client-ts";
import type { NavigationGuard, RouteLocationNormalized } from "vue-router";

import type { OidcAuth } from "./types";

export interface AuthGuardOptions {
  /** Which routes to protect. Default: (to) => to.meta.requiresAuth === true */
  shouldProtect?: (to: RouteLocationNormalized) => boolean;
  /** Args passed to signinRedirect for unauthenticated users.
   *  Default: { state: { returnTo: to.fullPath } } */
  signinArgs?:
    SigninRedirectArgs | ((to: RouteLocationNormalized) => SigninRedirectArgs);
}

/** vue-router navigation guard (SPEC §4.5) — the Vue-idiomatic equivalent of
 *  react-oidc-context's withAuthenticationRequired. Takes the OidcAuth instance
 *  explicitly (never inject()/runWithContext), so it works regardless of
 *  registration order or router version. Register with
 *  router.beforeEach(createAuthGuard(auth)). */
export function createAuthGuard(
  auth: OidcAuth,
  options: AuthGuardOptions = {},
): NavigationGuard {
  const { shouldProtect = (to) => to.meta.requiresAuth === true, signinArgs } =
    options;

  return async (to) => {
    if (!shouldProtect(to)) return true;

    // A hard refresh on a protected route must wait for the session lookup /
    // signin-callback processing before deciding (SPEC §4.5).
    await auth.initialized;
    if (auth.isAuthenticated.value) return true;

    const args =
      typeof signinArgs === "function"
        ? signinArgs(to)
        : (signinArgs ?? { state: { returnTo: to.fullPath } });
    try {
      await auth.signinRedirect(args);
    } catch {
      // The failure already landed on the error ref (SPEC §5.4); the
      // navigation is cancelled either way.
    }
    return false;
  };
}
