# API reference

Condensed reference for both entry points. The normative contract (exact semantics, edge cases, parity notes) is [SPEC.md](../SPEC.md).

| Import                           | Contents                                            |
| -------------------------------- | --------------------------------------------------- |
| `@dlukt/vue-oidc-context`        | Core: plugin, composables, components, utils, types |
| `@dlukt/vue-oidc-context/router` | `createAuthGuard` (requires the `vue-router` peer)  |

## createOidcAuth()

```ts
function createOidcAuth(options: OidcAuthOptions): OidcAuth;

type OidcAuthOptions =
  | (UserManagerSettings & AuthCallbacks & { userManager?: undefined })
  | (AuthCallbacks & { userManager: UserManager });

interface OidcAuth extends AuthContext {
  /** Vue plugin hook: provides the AuthContext to the app's components. */
  install(app: App): void;
  /** Resolves once initialization has settled (successfully or with error set). */
  readonly initialized: Promise<void>;
}
```

Creates the auth instance. Options are **flat**: `UserManagerSettings` keys and callbacks side by side (or a ready-made `userManager` plus callbacks). In the browser, the `UserManager` is created and initialization starts immediately — not on `install()` — so the instance is fully usable without a Vue app. Installing the same instance on a second app shares state; installing twice on the same app is a dev-warning no-op.

### AuthCallbacks

```ts
interface AuthCallbacks {
  /** After the signin redirect/popup callback has been processed. */
  onSigninCallback?: (user: User | undefined) => Promise<void> | void;
  /** Skip automatic signinCallback() even when auth params are present. Default: false. */
  skipSigninCallback?: boolean;
  /** Return true when the current URL is the post-logout redirect URI. */
  matchSignoutCallback?: (settings: UserManagerSettings) => boolean;
  /** After signoutCallback() has been processed. */
  onSignoutCallback?: (
    resp: SignoutResponse | undefined,
  ) => Promise<void> | void;
  /** After removeUser() completes. */
  onRemoveUser?: () => Promise<void> | void;
}
```

See [Callbacks & URL cleanup](../guide/callbacks.md).

## useAuth()

```ts
function useAuth(): AuthContext;
```

Injects the nearest context (plugin or enclosing `AuthProvider`); throws with a descriptive message when there is none.

### State (refs — destructure them)

```ts
interface AuthState {
  user: Readonly<ShallowRef<User | null | undefined>>;
  isLoading: Readonly<Ref<boolean>>;
  isAuthenticated: ComputedRef<boolean>;
  activeNavigator: Readonly<Ref<NavigatorKey | undefined>>;
  error: Readonly<ShallowRef<ErrorContext | undefined>>;
}

type NavigatorKey =
  | "signinRedirect"
  | "signinResourceOwnerCredentials"
  | "signinPopup"
  | "signinSilent"
  | "signoutRedirect"
  | "signoutPopup"
  | "signoutSilent";
```

- `user` — `undefined` until init settles, then `User` or `null`; updated by `UserManager` events.
- `isAuthenticated` — non-expired user loaded and not signed out at the OP. **Not time-reactive.**
- `error` — cleared on the next successful user load.

### Methods

```ts
interface AuthContext extends AuthState {
  readonly settings: UserManagerSettings;
  /** Raw oidc-client-ts event bus (addAccessTokenExpiring, addUserLoaded, …). */
  readonly events: UserManagerEvents;

  // navigators — drive activeNavigator/isLoading/error; rejections still propagate
  signinRedirect(args?: SigninRedirectArgs): Promise<void>;
  signinPopup(args?: SigninPopupArgs): Promise<User>;
  signinSilent(args?: SigninSilentArgs): Promise<User | null>;
  signinResourceOwnerCredentials(
    args: SigninResourceOwnerCredentialsArgs,
  ): Promise<User>;
  signoutRedirect(args?: SignoutRedirectArgs): Promise<void>;
  signoutPopup(args?: SignoutPopupArgs): Promise<void>;
  signoutSilent(args?: SignoutSilentArgs): Promise<void>;

  // pass-throughs — bound to the UserManager
  removeUser(): Promise<void>; // also invokes onRemoveUser
  clearStaleState(): Promise<void>;
  querySessionStatus(
    args?: QuerySessionStatusArgs,
  ): Promise<SessionStatus | null>;
  revokeTokens(types?: RevokeTokensTypes): Promise<void>;
  startSilentRenew(): void;
  stopSilentRenew(): void;
}
```

## useAutoSignin()

```ts
interface UseAutoSigninOptions {
  /** Default: "signinRedirect". */
  signinMethod?: "signinRedirect" | "signinPopup";
  signinArgs?: SigninRedirectArgs | SigninPopupArgs;
}

function useAutoSignin(options?: UseAutoSigninOptions): {
  isAuthenticated: AuthState["isAuthenticated"];
  isLoading: AuthState["isLoading"];
  error: AuthState["error"];
};
```

Attempts sign-in **once per context**, when no auth params are in the URL, no user is authenticated, and nothing is in flight. Failed attempts are not retried; failures land on `error`.

## AuthProvider

Renderless component providing a context to its subtree ([guide](../guide/multi-tenant.md)).

```ts
interface AuthProviderProps extends AuthCallbacks {
  /** UserManagerSettings as one object prop. */
  settings?: UserManagerSettings;
  /** Exactly one of settings/userManager must be set. */
  userManager?: UserManager;
}
```

Default slot props: the context with refs unwrapped to plain values (`AuthProviderSlotProps`). Props are read once at setup.

## AuthenticationRequired

Protects a subtree without vue-router ([guide](../guide/protecting-routes.md#authenticationrequired-component)).

```ts
interface AuthenticationRequiredProps {
  /** Default: "signinRedirect" */
  signinMethod?: "signinRedirect" | "signinPopup";
  signinArgs?: SigninRedirectArgs | SigninPopupArgs;
}
```

Slots: `default` (rendered while authenticated), `redirecting` (otherwise; default empty).

## createAuthGuard() <Badge type="info" text="/router" />

```ts
import { createAuthGuard } from "@dlukt/vue-oidc-context/router";

interface AuthGuardOptions {
  /** Which routes to protect. Default: (to) => to.meta.requiresAuth === true */
  shouldProtect?: (to: RouteLocationNormalized) => boolean;
  /** Default: { state: { returnTo: to.fullPath } } */
  signinArgs?:
    SigninRedirectArgs | ((to: RouteLocationNormalized) => SigninRedirectArgs);
}

function createAuthGuard(
  auth: OidcAuth,
  options?: AuthGuardOptions,
): NavigationGuard;
```

Register with `router.beforeEach(createAuthGuard(auth))`. Awaits `auth.initialized`, allows authenticated navigations, otherwise calls `signinRedirect` and cancels. Works with vue-router 4.2+ and 5.

## hasAuthParams()

```ts
function hasAuthParams(location?: Location): boolean; // default: window.location
```

True when the URL carries an OIDC authorization response: `(code | error) + state` in the query string or fragment.

## AUTH_CONTEXT_KEY

```ts
const AUTH_CONTEXT_KEY: InjectionKey<AuthContext>;
```

The injection key used by the plugin and `AuthProvider` — for building custom providers or accessing the context from libraries.

## ErrorContext

```ts
type ErrorSource =
  | "signinCallback"
  | "signoutCallback"
  | "renewSilent"
  | NavigatorKey
  | "unknown";

type ErrorContext = Error & {
  source: ErrorSource;
  /** Original thrown value when it was not an Error instance. */
  innerError?: unknown;
};
```

## Re-exports

For convenience, the core entry re-exports from oidc-client-ts: `User`, `UserManager`, `WebStorageStateStore`, `InMemoryWebStorage`, `Log`, and the settings/args types used above.
