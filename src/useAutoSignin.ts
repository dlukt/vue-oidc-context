import type { SigninPopupArgs, SigninRedirectArgs } from "oidc-client-ts";
import { watch } from "vue";

import { useAuth } from "./injection";
import type { AuthContext, AuthState } from "./types";
import { hasAuthParams, isBrowser } from "./utils";

export interface UseAutoSigninOptions {
  /** Default: "signinRedirect". signinResourceOwnerCredentials is not supported. */
  signinMethod?: "signinRedirect" | "signinPopup";
  signinArgs?: SigninRedirectArgs | SigninPopupArgs;
}

/** Single-attempt signin driver shared by useAutoSignin (SPEC §4.4, one attempt
 *  per context) and <AuthenticationRequired> (SPEC §4.6, one attempt per
 *  component instance — the caller chooses the scope via isAttempted/
 *  markAttempted). Fires `invoke` when no auth params are in the URL, no user
 *  is authenticated, and nothing is in flight — immediately if those conditions
 *  already hold, otherwise from a watcher when they become true. Rejections are
 *  swallowed; failures land on the error ref (SPEC §5.4).
 *  @internal */
export function startAutoSignin(driver: {
  auth: AuthContext;
  isAttempted: () => boolean;
  markAttempted: () => void;
  invoke: () => Promise<unknown>;
}): void {
  const { auth, isAttempted, markAttempted, invoke } = driver;

  /** Returns true when no further attempt can happen. */
  const attempt = (): boolean => {
    if (isAttempted()) return true;
    if (
      !isBrowser() ||
      hasAuthParams() ||
      auth.isAuthenticated.value ||
      auth.activeNavigator.value ||
      auth.isLoading.value
    ) {
      return false;
    }
    markAttempted();
    invoke().catch(() => {});
    return true;
  };

  if (!attempt()) {
    const stop = watch(
      [auth.isAuthenticated, auth.isLoading, auth.activeNavigator],
      () => {
        if (attempt()) stop();
      },
    );
  }
}

/** Contexts that already made their single auto-signin attempt (SPEC §4.4):
 *  one attempt per context, no matter how many components use the composable. */
const attempted = new WeakSet<AuthContext>();

/** Automatically attempts sign-in once per context (SPEC §4.4). The attempt
 *  fires when no auth params are in the URL, no user is authenticated, and
 *  nothing is in flight — immediately if those conditions already hold,
 *  otherwise from a watcher when they become true. */
export function useAutoSignin(options: UseAutoSigninOptions = {}): {
  isAuthenticated: AuthState["isAuthenticated"];
  isLoading: AuthState["isLoading"];
  error: AuthState["error"];
} {
  const { signinMethod = "signinRedirect", signinArgs } = options;
  const auth = useAuth();

  startAutoSignin({
    auth,
    isAttempted: () => attempted.has(auth),
    markAttempted: () => attempted.add(auth),
    invoke: () =>
      signinMethod === "signinPopup"
        ? auth.signinPopup(signinArgs)
        : auth.signinRedirect(signinArgs),
  });

  return {
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error,
  };
}
