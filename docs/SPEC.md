# vue-oidc-context — Specification

|               |                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Package**   | `@dlukt/vue-oidc-context`                                                                                                            |
| **Status**    | Draft (pre-implementation)                                                                                                           |
| **Target**    | v0.1.0                                                                                                                               |
| **License**   | MIT                                                                                                                                  |
| **Reference** | [react-oidc-context](https://github.com/authts/react-oidc-context) v3, [oidc-client-ts](https://github.com/authts/oidc-client-ts) v3 |

This document is the API contract and behavior specification. The implementation roadmap lives in [PLAN.md](./PLAN.md).

**Contents**

1. [Overview](#1-overview)
2. [Goals and non-goals](#2-goals-and-non-goals)
3. [Package and installation](#3-package-and-installation)
4. [Public API](#4-public-api)
5. [Behavior](#5-behavior)
6. [SSR](#6-ssr)
7. [Error handling](#7-error-handling)
8. [Security notes](#8-security-notes)
9. [Migration from react-oidc-context](#9-migration-from-react-oidc-context)
10. [Future work](#10-future-work)

---

## 1. Overview

`vue-oidc-context` provides OpenID Connect (OIDC) and OAuth 2.0 authentication for Vue 3 applications. It is a deliberate port of **react-oidc-context** to Vue idioms: the same thin-wrapper philosophy, the same option names, the same lifecycle — but exposed as a Vue plugin, composables, components, and a vue-router guard instead of a React context provider and hooks.

All protocol work — authorization code flow with PKCE, token storage, silent renewal, session monitoring — is delegated to **oidc-client-ts**. This library owns exactly one concern: bridging a `UserManager` instance into Vue's reactivity system and component tree.

Design principles:

- **Thin wrapper.** No token logic, no storage logic, no HTTP. If oidc-client-ts can do it, we delegate.
- **Parity first.** Every react-oidc-context capability has an equivalent here (or an explicit non-goal). Option names (`onSigninCallback`, `skipSigninCallback`, …) are identical to ease migration and let users reuse the upstream documentation.
- **Vue-idiomatic.** `app.use()` plugin as the primary path, `provide`/`inject` under the hood, destructurable refs from composables, navigation guards instead of HOCs.
- **Fully typed.** TypeScript strict; option and return types re-use oidc-client-ts types directly rather than duplicating them.

## 2. Goals and non-goals

### Goals (v1)

- Reactive auth state (`user`, `isLoading`, `isAuthenticated`, `activeNavigator`, `error`) driven by `UserManager` events.
- Automatic sign-in callback handling on app startup (redirect and popup flows), with the same hooks react-oidc-context offers.
- Full pass-through of the `UserManager` method surface (`signinRedirect`, `signinPopup`, `signinSilent`, `signinResourceOwnerCredentials`, `signoutRedirect`, `signoutPopup`, `signoutSilent`, `removeUser`, `clearStaleState`, `querySessionStatus`, `revokeTokens`, `startSilentRenew`, `stopSilentRenew`).
- Plugin (`createOidcAuth`) **and** component (`<AuthProvider>`) installation styles, sharing one core.
- Route protection: `createAuthGuard` for vue-router (optional peer) and an `<AuthenticationRequired>` component for router-less apps.
- `useAutoSignin` composable.
- SSR-safe: importable and installable in Node without touching `window`.

### Non-goals (v1)

- **Nuxt module.** A client-plugin recipe is documented (§6); auto-imports and module packaging are future work.
- **Vue 2 / `@vue/composition-api`.**
- **State-library integration.** No pinia dependency; the library's own reactive refs are the store.
- **UI components.** No login buttons, no styled anything.
- **Custom token storage or protocol extensions.** Configure oidc-client-ts (`userStore`, `stateStore`, …) instead.
- **`withAuth` HOC.** HOCs are not a Vue idiom; `useAuth()` and slot props cover the use case.

## 3. Package and installation

```bash
pnpm add @dlukt/vue-oidc-context oidc-client-ts
```

> The unscoped npm name `vue-oidc-context` is owned by an unrelated package; this project publishes under the `@dlukt` scope. The GitHub repository remains `dlukt/vue-oidc-context`.

| Peer dependency  | Range                | Notes                                                                                                       |
| ---------------- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `vue`            | `^3.5.0`             | Uses `app.onUnmount`, `onScopeDispose`                                                                      |
| `oidc-client-ts` | `^3.3.0`             | Required at runtime                                                                                         |
| `vue-router`     | `^4.2.0 \|\| ^5.0.0` | **Optional** — only needed for the `./router` subpath; the guard uses only API identical across both majors |

Entry points (`sideEffects: false`, ESM + CJS + type declarations):

| Import                           | Contents                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `@dlukt/vue-oidc-context`        | Core: plugin, composables, components, utils, types                                                      |
| `@dlukt/vue-oidc-context/router` | `createAuthGuard` (kept in a subpath so the core entry's type declarations never reference `vue-router`) |

## 4. Public API

### 4.1 `createOidcAuth(options)`

Creates the auth instance. Installable as a Vue plugin; also usable directly outside components (router guards, fetch interceptors, `main.ts`).

```ts
import { createApp } from "vue";
import { createOidcAuth } from "@dlukt/vue-oidc-context";
import App from "./App.vue";

const auth = createOidcAuth({
  authority: "https://demo.duendesoftware.com",
  client_id: "interactive.public",
  redirect_uri: `${window.location.origin}/`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  onSigninCallback: () => {
    // strip ?code=...&state=... from the URL after the redirect completes
    window.history.replaceState({}, document.title, window.location.pathname);
  },
});

createApp(App).use(auth).mount("#app");
```

Signature and types:

```ts
export function createOidcAuth(options: OidcAuthOptions): OidcAuth;

/** Lifecycle hooks shared by the plugin and the <AuthProvider> component.
 *  Names and semantics are identical to react-oidc-context. */
export interface AuthCallbacks {
  /** Invoked after the signin redirect/popup callback has been processed.
   *  Typical use: remove auth params from the URL, restore user state. */
  onSigninCallback?: (user: User | undefined) => Promise<void> | void;
  /** Skip automatic signinCallback() even when auth params are present
   *  (e.g. the params belong to a different OAuth integration). Default: false. */
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
 *  or a caller-supplied UserManager instance. */
export type OidcAuthOptions =
  | (UserManagerSettings & AuthCallbacks & { userManager?: undefined })
  | (AuthCallbacks & { userManager: UserManager });

export interface OidcAuth extends AuthContext {
  /** Vue plugin hook: provides the AuthContext app-wide and starts initialization. */
  install(app: App): void;
  /** Resolves once the initialization sequence (§5.1) has settled
   *  (successfully or with `error` set). Useful before router.isReady(). */
  readonly initialized: Promise<void>;
}
```

Rules:

- Options are **flat**, exactly like react-oidc-context's `AuthProviderProps` — `UserManagerSettings` keys and `AuthCallbacks` keys side by side. A migrating user copies their config object unchanged.
- If `userManager` is given, all `UserManagerSettings` keys are rejected by the types; callbacks remain available.
- In the browser, `createOidcAuth()` creates the `UserManager` and starts the async initialization sequence (§5.1) immediately — not on `install()`. This makes the instance fully usable without a Vue app (router guards, interceptors); `install()` only provides the context to components.
- Installing the same instance on a second app is allowed and shares state; installing twice on the same app is a dev-mode warning no-op.

### 4.2 `useAuth()`

The primary consumer API. Injects the nearest `AuthContext` (from the plugin or an enclosing `<AuthProvider>`).

```vue
<script setup lang="ts">
import { useAuth } from "@dlukt/vue-oidc-context";

const {
  user,
  isAuthenticated,
  isLoading,
  error,
  signinRedirect,
  signoutRedirect,
} = useAuth();
</script>

<template>
  <div v-if="isLoading">Signing you in/out…</div>
  <div v-else-if="error">Oops… {{ error.message }} ({{ error.source }})</div>
  <template v-else-if="isAuthenticated">
    Hello {{ user?.profile.name }}
    <button @click="signoutRedirect()">Log out</button>
  </template>
  <button v-else @click="signinRedirect()">Log in</button>
</template>
```

Signature and types:

```ts
/** Throws with a descriptive message if no plugin/provider is installed above. */
export function useAuth(): AuthContext;

export type NavigatorKey =
  | "signinRedirect"
  | "signinResourceOwnerCredentials"
  | "signinPopup"
  | "signinSilent"
  | "signoutRedirect"
  | "signoutPopup"
  | "signoutSilent";

/** Reactive slice of the context. All refs are read-only for consumers. */
export interface AuthState {
  /** undefined = initialization not finished; null = no session; User = session.
   *  ShallowRef: User is a class instance, its internals are not made reactive. */
  user: Readonly<ShallowRef<User | null | undefined>>;
  /** True until initialization settles, and while any navigator method is in flight. */
  isLoading: Readonly<Ref<boolean>>;
  /** True while a non-expired user is loaded (§5.3 for exact semantics). */
  isAuthenticated: ComputedRef<boolean>;
  /** The signin/signout method currently in flight, if any. */
  activeNavigator: Readonly<Ref<NavigatorKey | undefined>>;
  /** Last initialization/renewal/navigation error (§7). Cleared on next user load. */
  error: Readonly<ShallowRef<ErrorContext | undefined>>;
}

export interface AuthContext extends AuthState {
  /** Settings of the underlying UserManager. */
  readonly settings: UserManagerSettings;
  /** Raw oidc-client-ts event bus (addAccessTokenExpiring, addUserLoaded, …). */
  readonly events: UserManagerEvents;

  // navigator methods — wrapped, they drive activeNavigator/isLoading/error (§5.4)
  signinRedirect(args?: SigninRedirectArgs): Promise<void>;
  signinPopup(args?: SigninPopupArgs): Promise<User>;
  signinSilent(args?: SigninSilentArgs): Promise<User | null>;
  signinResourceOwnerCredentials(
    args: SigninResourceOwnerCredentialsArgs,
  ): Promise<User>;
  signoutRedirect(args?: SignoutRedirectArgs): Promise<void>;
  signoutPopup(args?: SignoutPopupArgs): Promise<void>;
  signoutSilent(args?: SignoutSilentArgs): Promise<void>;

  // pass-through methods — bound to the UserManager
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

> **Reactivity gotcha.** `AuthContext` is a plain object holding refs (VueUse convention): **destructure it** — `const { user } = useAuth()` — and refs auto-unwrap in templates. If you keep the whole object (`const auth = useAuth()`), nested refs do _not_ unwrap in templates: write `auth.user.value` in script and `auth.user?.value` in templates, or destructure instead.

### 4.3 `<AuthProvider>`

Component-scoped alternative to the plugin, for nested contexts and multi-IdP/multi-tenant apps. Renderless; `provide()`s an `AuthContext` to its subtree, shadowing any plugin-provided one.

```vue
<script setup lang="ts">
import { AuthProvider } from "@dlukt/vue-oidc-context";
import { tenantSettings } from "./tenants";
</script>

<template>
  <AuthProvider :settings="tenantSettings" :on-signin-callback="stripUrl">
    <TenantAdminArea />
  </AuthProvider>
</template>
```

Props and slots:

```ts
export interface AuthProviderProps extends AuthCallbacks {
  /** UserManagerSettings as a single object prop (templates can't spread 40 flat props). */
  settings?: UserManagerSettings;
  /** Bring-your-own UserManager. Exactly one of settings/userManager must be set. */
  userManager?: UserManager;
}
```

- **Default slot** receives the `AuthContext` as slot props: `<AuthProvider v-slot="{ isAuthenticated }">…`.
- Initialization (§5.1) starts on mount; event subscriptions are disposed on unmount via the component scope.
- Nesting is supported; `useAuth()` resolves the nearest provider. Two providers pointing at the same `authority` + `client_id` share oidc-client-ts storage keys — that is oidc-client-ts behavior, not something this library changes.
- The plugin and the component produce the same `AuthContext` shape from the same core; the only difference is scope and lifetime.

### 4.4 `useAutoSignin(options?)`

Automatically attempts sign-in **once per app instance**, matching react-oidc-context's `useAutoSignin`.

```ts
export interface UseAutoSigninOptions {
  /** Default: "signinRedirect". signinResourceOwnerCredentials is not supported. */
  signinMethod?: "signinRedirect" | "signinPopup";
  signinArgs?: SigninRedirectArgs | SigninPopupArgs;
}

export function useAutoSignin(options?: UseAutoSigninOptions): {
  isAuthenticated: AuthState["isAuthenticated"];
  isLoading: AuthState["isLoading"];
  error: AuthState["error"];
};
```

The attempt fires only when **all** hold: no auth params in the URL, `!isAuthenticated`, no `activeNavigator`, `!isLoading`, and no previous attempt was made through this context. Implemented with a watcher so it also fires if the conditions become true after initialization settles.

### 4.5 `createAuthGuard(auth, options?)` — `@dlukt/vue-oidc-context/router`

vue-router navigation guard; the Vue-idiomatic equivalent of `withAuthenticationRequired`.

```ts
import { createRouter, createWebHistory } from "vue-router";
import { createAuthGuard } from "@dlukt/vue-oidc-context/router";
import { auth } from "./auth"; // the createOidcAuth(...) instance

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/admin", component: Admin, meta: { requiresAuth: true } },
  ],
});

router.beforeEach(createAuthGuard(auth));
```

Signature:

```ts
export interface AuthGuardOptions {
  /** Which routes to protect. Default: (to) => to.meta.requiresAuth === true */
  shouldProtect?: (to: RouteLocationNormalized) => boolean;
  /** Args passed to signinRedirect for unauthenticated users.
   *  Default: { state: { returnTo: to.fullPath } } */
  signinArgs?:
    SigninRedirectArgs | ((to: RouteLocationNormalized) => SigninRedirectArgs);
}

export function createAuthGuard(
  auth: OidcAuth,
  options?: AuthGuardOptions,
): NavigationGuard;
```

Behavior:

1. If `shouldProtect(to)` is false → allow navigation.
2. Await `auth.initialized` (so a hard refresh on a protected route waits for the session lookup / signin callback).
3. If `isAuthenticated` → allow.
4. Otherwise call `auth.signinRedirect(signinArgs)` and cancel the navigation (`return false`).

The guard takes the `OidcAuth` instance **explicitly** — it never relies on `inject()`/`runWithContext`, so it works regardless of registration order or router version details.

Returning to the original route is the app's choice via `onSigninCallback` (the default `signinArgs` carry the path):

```ts
onSigninCallback: (user) => {
  const returnTo = (user?.state as { returnTo?: string } | undefined)?.returnTo ?? "/";
  window.history.replaceState({}, document.title, returnTo);
  // or: router.replace(returnTo)
},
```

Recommended `RouteMeta` augmentation (documented, not shipped):

```ts
declare module "vue-router" {
  interface RouteMeta {
    requiresAuth?: boolean;
  }
}
```

### 4.6 `<AuthenticationRequired>`

`withAuthenticationRequired` equivalent for apps not using vue-router (or for protecting a subtree rather than a route).

```vue
<AuthenticationRequired>
  <Dashboard />
  <template #redirecting>
    <p>Redirecting to sign-in…</p>
  </template>
</AuthenticationRequired>
```

```ts
export interface AuthenticationRequiredProps {
  /** Default: "signinRedirect" */
  signinMethod?: "signinRedirect" | "signinPopup";
  signinArgs?: SigninRedirectArgs | SigninPopupArgs;
}
```

Behavior: renders the default slot while `isAuthenticated`; otherwise renders the `#redirecting` slot (default: nothing) and — once `!isLoading`, no `activeNavigator`, and no auth params are in the URL — invokes the signin method a single time.

### 4.7 `hasAuthParams(location?)`

Re-implementation of the react-oidc-context util, exported for userland checks.

```ts
/** True when the URL carries an OIDC authorization response:
 *  (code | error) + state in the query string (response_mode "query")
 *  or in the fragment (response_mode "fragment"). */
export function hasAuthParams(location?: Location): boolean; // default: window.location
```

### 4.8 Advanced: injection key

```ts
/** The InjectionKey used by the plugin and <AuthProvider>. For building custom
 *  providers or accessing the context from libraries. */
export const AUTH_CONTEXT_KEY: InjectionKey<AuthContext>;
```

### 4.9 Exports summary

From `@dlukt/vue-oidc-context`:

| Export                                                                                                                                                                                 | Kind                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `createOidcAuth`                                                                                                                                                                       | function                                     |
| `useAuth`, `useAutoSignin`                                                                                                                                                             | composables                                  |
| `AuthProvider`, `AuthenticationRequired`                                                                                                                                               | components                                   |
| `hasAuthParams`                                                                                                                                                                        | util                                         |
| `AUTH_CONTEXT_KEY`                                                                                                                                                                     | injection key                                |
| `AuthState`, `AuthContext`, `AuthCallbacks`, `OidcAuthOptions`, `OidcAuth`, `AuthProviderProps`, `AuthenticationRequiredProps`, `UseAutoSigninOptions`, `NavigatorKey`, `ErrorContext` | types                                        |
| `User`, `UserManager`, `WebStorageStateStore`, `InMemoryWebStorage`, `Log` and the settings/args types used above                                                                      | re-exports from oidc-client-ts (convenience) |

From `@dlukt/vue-oidc-context/router`: `createAuthGuard`, `AuthGuardOptions`.

## 5. Behavior

### 5.1 Initialization sequence

Runs once per context (plugin creation / provider mount), asynchronously, in the browser only. Mirrors react-oidc-context exactly:

1. If `hasAuthParams()` and not `skipSigninCallback`:
   a. `user = await userManager.signinCallback()`
   b. `await onSigninCallback?.(user)`
2. If no user yet: `user = await userManager.getUser()`
3. Commit: `user` ref set (`null` if none), `isLoading` → `false`, `error` cleared.
   On failure: `error` set with `source: "signinCallback"`, `isLoading` → `false`.
4. Independently: if `matchSignoutCallback?.(settings)` returns true:
   a. `resp = await userManager.signoutCallback()`
   b. `await onSignoutCallback?.(resp)`
   On failure: `error` set with `source: "signoutCallback"`.
5. `initialized` resolves (never rejects; failures are surfaced via `error`).

Note (parity): the library does **not** clean auth params from the URL. That is the app's job in `onSigninCallback` — same as react-oidc-context.

### 5.2 Event subscriptions

On initialization the context subscribes to four `UserManagerEvents`; all are unsubscribed on teardown (§5.5):

| Event                 | Effect on state                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `addUserLoaded`       | `user` ← loaded user, `error` cleared                                                                           |
| `addUserUnloaded`     | `user` ← `null`                                                                                                 |
| `addUserSignedOut`    | signed-out flag set: `isAuthenticated` becomes `false`, **`user` is retained** (parity with react-oidc-context) |
| `addSilentRenewError` | `error` ← error with `source: "renewSilent"`                                                                    |

Any further events (`addAccessTokenExpiring`, …) are the app's business via `auth.events`.

### 5.3 State semantics

| Field             | Semantics                                                                                                                                                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`            | `undefined` before init settles → `User` or `null` afterwards; updated by events                                                                                                                                                                                                       |
| `isLoading`       | `true` initially; `false` once init settles; `true` again while a navigator method is in flight                                                                                                                                                                                        |
| `isAuthenticated` | `!!user && !user.expired && !signedOut` — a computed re-evaluated when `user` or the signed-out flag changes. **Not time-reactive**: an access token expiring does not by itself flip it (same as react-oidc-context). Gate API calls on `user.access_token`/events, not on this flag. |
| `activeNavigator` | Set to the method name for the duration of any wrapped navigator call                                                                                                                                                                                                                  |
| `error`           | Set by init failures, navigator failures, and silent-renew errors; cleared when a user is loaded                                                                                                                                                                                       |

The signed-out flag is reset whenever a user is loaded (sign-in after sign-out works).

### 5.4 Navigator method wrapping

Every `signin*`/`signout*` method on the context wraps the corresponding `UserManager` method:

1. `activeNavigator` ← method name; `isLoading` ← `true`.
2. Await the underlying call. `user` updates arrive via `addUserLoaded`/`addUserUnloaded`, not from the return value.
3. On rejection: `error` ← `ErrorContext` with `source` = method name. The wrapped promise **still rejects** (callers may `try/catch`); the ref is for template consumption.
4. Finally: `activeNavigator` ← `undefined`; `isLoading` ← `false`.

`removeUser`, `clearStaleState`, `querySessionStatus`, `revokeTokens`, `startSilentRenew`, `stopSilentRenew` are plain bound pass-throughs (no state choreography), except `removeUser` which additionally awaits `onRemoveUser`.

### 5.5 Lifetime and teardown

- **Plugin:** subscriptions live for the app's lifetime; disposed via `app.onUnmount()`.
- **`<AuthProvider>`:** disposed with the component's effect scope (`onScopeDispose`).
- Teardown unsubscribes events and stops nothing else — in particular it does not call `stopSilentRenew()` or clear storage (parity: react-oidc-context also only unsubscribes).
- One `OidcAuth` instance owns one `UserManager`. Multiple instances on one page are supported (multi-tenant); storage isolation follows oidc-client-ts key derivation (per authority + client).

## 6. SSR

- Importing any entry point is side-effect free and never touches `window`/`document`.
- On the server, `createOidcAuth` creates an **inert context**: `user` stays `undefined`, `isLoading` stays `true`, `initialized` stays pending, and navigator/pass-through methods reject with a descriptive `"…is only available in a browser"` error (react-oidc-context behaves the same way with its unsupported-environment stubs).
- Environment detection: `typeof window !== "undefined"`, evaluated at construction time, not import time.
- **Nuxt recipe** (documented in the guide, not shipped): register the plugin inside a `.client.ts` Nuxt plugin; render auth-dependent UI inside `<ClientOnly>` or gate on `isLoading`.

## 7. Error handling

`ErrorContext` mirrors react-oidc-context:

```ts
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
```

Normalization rule: thrown `Error` instances are tagged with `source`; non-`Error` values are wrapped in an `Error` with the original value preserved on `innerError`.

`useAuth()` outside any provider throws synchronously:
`"useAuth() requires the auth plugin (app.use(createOidcAuth(...))) or an enclosing <AuthProvider>."`

## 8. Security notes

- oidc-client-ts defaults apply: authorization code flow + PKCE; tokens in `sessionStorage` (configurable via `userStore`, e.g. `WebStorageStateStore` over `localStorage`, or `InMemoryWebStorage`).
- This library never reads, stores, or logs tokens itself; it only holds the `User` object oidc-client-ts hands it, in a non-persisted `shallowRef`.
- Redirect-URI cleanup (`onSigninCallback`) is the app's responsibility; the docs show the canonical `history.replaceState` snippet.

## 9. Migration from react-oidc-context

| react-oidc-context                                                                                        | @dlukt/vue-oidc-context                                                                                    |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `<AuthProvider {...oidcConfig}>` (app root)                                                               | `app.use(createOidcAuth(oidcConfig))` — same flat config object                                            |
| `<AuthProvider>` (nested / multi-IdP)                                                                     | `<AuthProvider :settings="…">` component                                                                   |
| `const auth = useAuth()`                                                                                  | `const { user, isAuthenticated, … } = useAuth()` — destructure; fields are refs                            |
| `auth.isLoading` (plain boolean)                                                                          | `isLoading.value` in script, `isLoading` in templates                                                      |
| `withAuthenticationRequired(Component, opts)`                                                             | `createAuthGuard(auth)` + `meta.requiresAuth` (router apps) or `<AuthenticationRequired>` (component tree) |
| `withAuth(Component)`                                                                                     | not ported — use `useAuth()` / provider slot props                                                         |
| `useAutoSignin(opts)`                                                                                     | `useAutoSignin(opts)` — identical                                                                          |
| `hasAuthParams()`                                                                                         | `hasAuthParams()` — identical                                                                              |
| `AuthContext` (React context object)                                                                      | `AUTH_CONTEXT_KEY` (Vue injection key)                                                                     |
| `onSigninCallback` / `skipSigninCallback` / `matchSignoutCallback` / `onSignoutCallback` / `onRemoveUser` | identical names and semantics                                                                              |

## 10. Future work

Explicitly out of scope for v1, tracked as candidates:

- Nuxt module (auto-registration, `useAuth` auto-import, route-middleware sugar).
- Time-reactive `isAuthenticated` (opt-in timer tied to `expires_at`).
- Devtools integration (Vue devtools custom inspector for auth state).
- `useAuthenticatedFetch` / interceptor helpers.
