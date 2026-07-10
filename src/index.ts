/**
 * @dlukt/vue-oidc-context — OpenID Connect & OAuth 2.0 authentication for Vue 3.
 * A lightweight, fully typed wrapper around oidc-client-ts, ported from
 * react-oidc-context. API contract: docs/SPEC.md.
 */
export { AuthProvider } from "./AuthProvider";
export type { AuthProviderProps, AuthProviderSlotProps } from "./AuthProvider";
export { AUTH_CONTEXT_KEY, useAuth } from "./injection";
export { createOidcAuth } from "./plugin";
export { useAutoSignin } from "./useAutoSignin";
export type { UseAutoSigninOptions } from "./useAutoSignin";
export { hasAuthParams } from "./utils";
export type {
  AuthCallbacks,
  AuthContext,
  AuthState,
  ErrorContext,
  ErrorSource,
  NavigatorKey,
  OidcAuth,
  OidcAuthOptions,
} from "./types";

// Convenience re-exports from oidc-client-ts (SPEC §4.9).
export {
  InMemoryWebStorage,
  Log,
  User,
  UserManager,
  WebStorageStateStore,
} from "oidc-client-ts";
export type {
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
  UserManagerEvents,
  UserManagerSettings,
} from "oidc-client-ts";
