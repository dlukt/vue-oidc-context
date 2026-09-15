# @dlukt/vue-oidc-context

## 0.1.2

### Patch Changes

- Move linting from ESLint to oxlint and upgrade to TypeScript 7.
  
  `typescript-eslint` hard-errors on TS 7, which blocked the compiler upgrade. oxlint gets its type information from `tsgolint`, which is built on typescript-go, so the type-aware rule set survives the move: `.oxlintrc.json` mirrors the rules the old `recommendedTypeChecked` config enabled.
  
  No runtime or source change — `src/` is untouched. The published declarations are semantically identical; TS 7 only orders union members and interface properties differently.

## 0.1.1

### Patch Changes

- Declare the `AuthContext` method surface as function-typed properties instead of method signatures.
  
  Every entry (`signinRedirect`, `signoutPopup`, `removeUser`, …) is implemented as a bound closure that never reads `this`, so destructuring — `const { signinRedirect } = useAuth()` — was always safe at runtime. Declaring them as properties makes that explicit in the types, stops `@typescript-eslint/unbound-method` from flagging consumer code that pulls a method off the context, and checks the arguments contravariantly.

## 0.1.0

### Minor Changes

- 7be7200: Initial release. OpenID Connect / OAuth 2.0 authentication for Vue 3, a port of react-oidc-context on top of oidc-client-ts:

  - `createOidcAuth()` plugin with reactive auth state (`user`, `isLoading`, `isAuthenticated`, `activeNavigator`, `error`) and the full `UserManager` method surface
  - `useAuth()` and `useAutoSignin()` composables
  - `<AuthProvider>` (component-scoped contexts, multi-tenant) and `<AuthenticationRequired>` components
  - `createAuthGuard()` for vue-router 4/5 via the `@dlukt/vue-oidc-context/router` subpath
  - react-oidc-context–compatible callbacks (`onSigninCallback`, `skipSigninCallback`, `matchSignoutCallback`, `onSignoutCallback`, `onRemoveUser`) and `hasAuthParams()`
  - SSR-safe: importable and installable in Node without touching `window`
