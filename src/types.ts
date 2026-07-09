import type {
  QuerySessionStatusArgs,
  RevokeTokensTypes,
  SessionStatus,
  SigninPopupArgs,
  SigninRedirectArgs,
  SigninResourceOwnerCredentialsArgs,
  SigninSilentArgs,
  SignoutPopupArgs,
  SignoutRedirectArgs,
  SignoutSilentArgs,
  SignoutResponse,
  User,
  UserManager,
  UserManagerEvents,
  UserManagerSettings,
} from "oidc-client-ts";
import type { App, ComputedRef, Ref, ShallowRef } from "vue";

/** The signin/signout method currently in flight (SPEC §4.2). */
export type NavigatorKey =
  | "signinRedirect"
  | "signinResourceOwnerCredentials"
  | "signinPopup"
  | "signinSilent"
  | "signoutRedirect"
  | "signoutPopup"
  | "signoutSilent";

/** Which operation produced an error (SPEC §7). */
export type ErrorSource =
  | "signinCallback"
  | "signoutCallback"
  | "renewSilent"
  | NavigatorKey
  | "unknown";

export type ErrorContext = Error & {
  /** Which operation produced the error. */
  source: ErrorSource;
  /** Original thrown value when it was not an Error instance. */
  innerError?: unknown;
};

/** Reactive slice of the context. All refs are read-only for consumers (SPEC §4.2). */
export interface AuthState {
  /** undefined = initialization not finished; null = no session; User = session. */
  user: Readonly<ShallowRef<User | null | undefined>>;
  /** True until initialization settles, and while any navigator method is in flight. */
  isLoading: Readonly<Ref<boolean>>;
  /** True while a non-expired user is loaded and not signed out at the OP (SPEC §5.3). */
  isAuthenticated: ComputedRef<boolean>;
  /** The signin/signout method currently in flight, if any. */
  activeNavigator: Readonly<Ref<NavigatorKey | undefined>>;
  /** Last initialization/renewal/navigation error. Cleared on next user load. */
  error: Readonly<ShallowRef<ErrorContext | undefined>>;
}

export interface AuthContext extends AuthState {
  /** Settings of the underlying UserManager. */
  readonly settings: UserManagerSettings;
  /** Raw oidc-client-ts event bus (addAccessTokenExpiring, addUserLoaded, …). */
  readonly events: UserManagerEvents;

  signinRedirect(args?: SigninRedirectArgs): Promise<void>;
  signinPopup(args?: SigninPopupArgs): Promise<User>;
  signinSilent(args?: SigninSilentArgs): Promise<User | null>;
  signinResourceOwnerCredentials(
    args: SigninResourceOwnerCredentialsArgs,
  ): Promise<User>;
  signoutRedirect(args?: SignoutRedirectArgs): Promise<void>;
  signoutPopup(args?: SignoutPopupArgs): Promise<void>;
  signoutSilent(args?: SignoutSilentArgs): Promise<void>;

  /** Removes the stored user, then invokes onRemoveUser. */
  removeUser(): Promise<void>;
  clearStaleState(): Promise<void>;
  querySessionStatus(
    args?: QuerySessionStatusArgs,
  ): Promise<SessionStatus | null>;
  revokeTokens(types?: RevokeTokensTypes): Promise<void>;
  startSilentRenew(): void;
  stopSilentRenew(): void;
}

/** Lifecycle hooks shared by the plugin and the <AuthProvider> component.
 *  Names and semantics are identical to react-oidc-context (SPEC §4.1). */
export interface AuthCallbacks {
  /** Invoked after the signin redirect/popup callback has been processed.
   *  Typical use: remove auth params from the URL, restore user state. */
  onSigninCallback?: (user: User | undefined) => Promise<void> | void;
  /** Skip automatic signinCallback() even when auth params are present. Default: false. */
  skipSigninCallback?: boolean;
  /** Return true when the current URL is the post-logout redirect URI;
   *  triggers automatic signoutCallback() processing. */
  matchSignoutCallback?: (settings: UserManagerSettings) => boolean;
  /** Invoked after signoutCallback() has been processed. */
  onSignoutCallback?: (
    resp: SignoutResponse | undefined,
  ) => Promise<void> | void;
  /** Invoked after removeUser() completes. */
  onRemoveUser?: () => Promise<void> | void;
}

/** Either flat UserManagerSettings (the library constructs the UserManager),
 *  or a caller-supplied UserManager instance (SPEC §4.1). */
export type OidcAuthOptions =
  | (UserManagerSettings & AuthCallbacks & { userManager?: undefined })
  | (AuthCallbacks & { userManager: UserManager });

export interface OidcAuth extends AuthContext {
  /** Vue plugin hook: provides the AuthContext to the app's components. */
  install(app: App): void;
  /** Resolves once the initialization sequence (SPEC §5.1) has settled,
   *  successfully or with `error` set. Pending forever on the server. */
  readonly initialized: Promise<void>;
}
