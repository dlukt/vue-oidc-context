import { UserManager } from "oidc-client-ts";
import type {
  QuerySessionStatusArgs,
  RevokeTokensTypes,
  SigninPopupArgs,
  SigninRedirectArgs,
  SigninResourceOwnerCredentialsArgs,
  SigninSilentArgs,
  SignoutPopupArgs,
  SignoutRedirectArgs,
  SignoutSilentArgs,
  User,
  UserManagerEvents,
  UserManagerSettings,
} from "oidc-client-ts";
import { computed, ref, shallowRef } from "vue";

import type {
  AuthCallbacks,
  AuthContext,
  ErrorContext,
  ErrorSource,
  NavigatorKey,
  OidcAuthOptions,
} from "./types";
import {
  browserOnlyError,
  hasAuthParams,
  isBrowser,
  normalizeError,
} from "./utils";

/** Internal handle shared by the plugin (M1) and <AuthProvider> (M2). */
export interface AuthContextHandle {
  context: AuthContext;
  /** Resolves once the SPEC §5.1 sequence settles; pending forever on the server. */
  initialized: Promise<void>;
  /** Unsubscribes the SPEC §5.2 event handlers. */
  dispose: () => void;
}

interface SplitOptions {
  callbacks: AuthCallbacks;
  userManager: UserManager | undefined;
  settings: UserManagerSettings;
}

function splitOptions(options: OidcAuthOptions): SplitOptions {
  const {
    onSigninCallback,
    skipSigninCallback,
    matchSignoutCallback,
    onSignoutCallback,
    onRemoveUser,
    userManager,
    ...settings
  } = options as AuthCallbacks & {
    userManager?: UserManager;
  } & UserManagerSettings;
  return {
    callbacks: {
      onSigninCallback,
      skipSigninCallback,
      matchSignoutCallback,
      onSignoutCallback,
      onRemoveUser,
    },
    userManager,
    settings,
  };
}

/** Server-side stand-in: every method is callable and subscription methods return
 *  a no-op unsubscriber, so component setup code shared with SSR doesn't crash. */
function createInertEvents(): UserManagerEvents {
  const noop = (): void => {};
  return new Proxy(
    {},
    {
      get: () => (): (() => void) => noop,
    },
  ) as UserManagerEvents;
}

export function createAuthContext(options: OidcAuthOptions): AuthContextHandle {
  const {
    callbacks,
    userManager: providedManager,
    settings: rawSettings,
  } = splitOptions(options);
  const userManager =
    providedManager ?? (isBrowser() ? new UserManager(rawSettings) : undefined);

  const user = shallowRef<User | null | undefined>(undefined);
  const isLoading = ref(true);
  const activeNavigator = ref<NavigatorKey>();
  const error = shallowRef<ErrorContext>();
  // Set by the OP session monitor (addUserSignedOut); `user` is retained (SPEC §5.2).
  const signedOut = ref(false);
  // Not time-reactive: re-evaluated on state changes only (SPEC §5.3).
  const isAuthenticated = computed(
    () => !!user.value && !user.value.expired && !signedOut.value,
  );

  const setError = (err: unknown, source: ErrorSource): void => {
    error.value = normalizeError(err, source);
    isLoading.value = false;
  };

  const disposers: (() => void)[] = [];
  if (userManager) {
    disposers.push(
      userManager.events.addUserLoaded((loaded) => {
        user.value = loaded;
        signedOut.value = false;
        isLoading.value = false;
        error.value = undefined;
      }),
      userManager.events.addUserUnloaded(() => {
        user.value = null;
      }),
      userManager.events.addUserSignedOut(() => {
        signedOut.value = true;
      }),
      userManager.events.addSilentRenewError((err) => {
        setError(err, "renewSilent");
      }),
    );
  }

  // SPEC §5.1 — mirrors react-oidc-context's mount effect.
  async function initialize(um: UserManager): Promise<void> {
    try {
      let loadedUser: User | null | undefined;
      if (hasAuthParams() && !callbacks.skipSigninCallback) {
        loadedUser = await um.signinCallback();
        await callbacks.onSigninCallback?.(loadedUser ?? undefined);
      }
      user.value = loadedUser ?? (await um.getUser());
      isLoading.value = false;
      error.value = undefined;
    } catch (err) {
      setError(err, "signinCallback");
    }

    try {
      if (callbacks.matchSignoutCallback?.(um.settings)) {
        const resp = await um.signoutCallback();
        await callbacks.onSignoutCallback?.(resp);
      }
    } catch (err) {
      setError(err, "signoutCallback");
    }
  }

  const initialized =
    userManager && isBrowser()
      ? initialize(userManager)
      : new Promise<void>(() => {});

  // SPEC §5.4 — navigator choreography. The wrapped promise still rejects.
  function wrapNavigator<Args extends unknown[], Result>(
    method: NavigatorKey,
    invoke: (um: UserManager, ...args: Args) => Promise<Result>,
  ): (...args: Args) => Promise<Result> {
    if (!userManager) {
      return () => Promise.reject(browserOnlyError(method));
    }
    return async (...args: Args): Promise<Result> => {
      activeNavigator.value = method;
      isLoading.value = true;
      try {
        return await invoke(userManager, ...args);
      } catch (err) {
        setError(err, method);
        throw err;
      } finally {
        activeNavigator.value = undefined;
        isLoading.value = false;
      }
    };
  }

  function passthroughAsync<Args extends unknown[], Result>(
    method: string,
    invoke: (um: UserManager, ...args: Args) => Promise<Result>,
  ): (...args: Args) => Promise<Result> {
    if (!userManager) {
      return () => Promise.reject(browserOnlyError(method));
    }
    return (...args: Args) => invoke(userManager, ...args);
  }

  function passthroughSync<Args extends unknown[]>(
    method: string,
    invoke: (um: UserManager, ...args: Args) => void,
  ): (...args: Args) => void {
    if (!userManager) {
      return () => {
        throw browserOnlyError(method);
      };
    }
    return (...args: Args) => {
      invoke(userManager, ...args);
    };
  }

  const removeUser: () => Promise<void> = userManager
    ? async () => {
        await userManager.removeUser();
        await callbacks.onRemoveUser?.();
      }
    : () => Promise.reject(browserOnlyError("removeUser"));

  const context: AuthContext = {
    user,
    isLoading,
    isAuthenticated,
    activeNavigator,
    error,
    settings: userManager ? userManager.settings : rawSettings,
    events: userManager ? userManager.events : createInertEvents(),
    signinRedirect: wrapNavigator(
      "signinRedirect",
      (um, args?: SigninRedirectArgs) => um.signinRedirect(args),
    ),
    signinPopup: wrapNavigator("signinPopup", (um, args?: SigninPopupArgs) =>
      um.signinPopup(args),
    ),
    signinSilent: wrapNavigator("signinSilent", (um, args?: SigninSilentArgs) =>
      um.signinSilent(args),
    ),
    signinResourceOwnerCredentials: wrapNavigator(
      "signinResourceOwnerCredentials",
      (um, args: SigninResourceOwnerCredentialsArgs) =>
        um.signinResourceOwnerCredentials(args),
    ),
    signoutRedirect: wrapNavigator(
      "signoutRedirect",
      (um, args?: SignoutRedirectArgs) => um.signoutRedirect(args),
    ),
    signoutPopup: wrapNavigator("signoutPopup", (um, args?: SignoutPopupArgs) =>
      um.signoutPopup(args),
    ),
    signoutSilent: wrapNavigator(
      "signoutSilent",
      (um, args?: SignoutSilentArgs) => um.signoutSilent(args),
    ),
    removeUser,
    clearStaleState: passthroughAsync("clearStaleState", (um) =>
      um.clearStaleState(),
    ),
    querySessionStatus: passthroughAsync(
      "querySessionStatus",
      (um, args?: QuerySessionStatusArgs) => um.querySessionStatus(args),
    ),
    revokeTokens: passthroughAsync(
      "revokeTokens",
      (um, types?: RevokeTokensTypes) => um.revokeTokens(types),
    ),
    startSilentRenew: passthroughSync("startSilentRenew", (um) => {
      um.startSilentRenew();
    }),
    stopSilentRenew: passthroughSync("stopSilentRenew", (um) => {
      um.stopSilentRenew();
    }),
  };

  return {
    context,
    initialized,
    dispose: () => {
      for (const dispose of disposers) dispose();
      disposers.length = 0;
    },
  };
}
