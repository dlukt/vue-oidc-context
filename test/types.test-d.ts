/**
 * Type tests (PLAN §5 M4), run by Vitest's typecheck mode — this file is
 * compiled, never executed. The vue-router-free consumer check lives in
 * test/fixtures/core-no-vue-router/ instead, because it must compile against
 * the built dist/ declarations.
 */
import { describe, expectTypeOf, it } from "vitest";
import type {
  SessionStatus,
  User,
  UserManager,
  UserManagerSettings,
} from "oidc-client-ts";
import type { App, ComputedRef, Ref, ShallowRef } from "vue";
import type { NavigationGuard, RouteLocationNormalized } from "vue-router";

import { createOidcAuth } from "../src/index";
import type {
  AuthContext,
  AuthProviderSlotProps,
  ErrorContext,
  NavigatorKey,
  OidcAuth,
} from "../src/index";
import { createAuthGuard } from "../src/router";

declare const um: UserManager;
declare const app: App;
declare const auth: OidcAuth;
declare const context: AuthContext;

describe("OidcAuthOptions is settings XOR userManager (SPEC §4.1)", () => {
  it("accepts flat UserManagerSettings plus callbacks", () => {
    expectTypeOf(createOidcAuth).toBeCallableWith({
      authority: "https://idp.example.com",
      client_id: "spa",
      redirect_uri: "https://app.example.com/",
      onSigninCallback: (user: User | undefined) => void user,
      skipSigninCallback: false,
      matchSignoutCallback: (settings: UserManagerSettings) =>
        settings.post_logout_redirect_uri === window.location.href,
      onSignoutCallback: () => {},
      onRemoveUser: () => {},
    });
  });

  it("accepts a caller-supplied UserManager plus callbacks", () => {
    expectTypeOf(createOidcAuth).toBeCallableWith({
      userManager: um,
      onSigninCallback: () => {},
    });
  });

  it("rejects UserManagerSettings keys alongside userManager", () => {
    // @ts-expect-error settings keys are not allowed next to userManager
    createOidcAuth({ userManager: um, authority: "https://idp.example.com" });
  });

  it("requires the mandatory settings keys when no userManager is given", () => {
    // @ts-expect-error authority/client_id/redirect_uri are required
    createOidcAuth({ onSigninCallback: () => {} });
  });
});

describe("AuthState refs are read-only for consumers (SPEC §4.2)", () => {
  it("exposes the documented ref types", () => {
    expectTypeOf(context.user).toEqualTypeOf<
      Readonly<ShallowRef<User | null | undefined>>
    >();
    expectTypeOf(context.isLoading).toEqualTypeOf<Readonly<Ref<boolean>>>();
    expectTypeOf(context.isAuthenticated).toEqualTypeOf<ComputedRef<boolean>>();
    expectTypeOf(context.activeNavigator).toEqualTypeOf<
      Readonly<Ref<NavigatorKey | undefined>>
    >();
    expectTypeOf(context.error).toEqualTypeOf<
      Readonly<ShallowRef<ErrorContext | undefined>>
    >();
  });

  it("rejects writes to the state refs", () => {
    // @ts-expect-error user is read-only
    context.user.value = null;
    // @ts-expect-error isLoading is read-only
    context.isLoading.value = false;
    // @ts-expect-error isAuthenticated is a computed ref
    context.isAuthenticated.value = true;
    // @ts-expect-error activeNavigator is read-only
    context.activeNavigator.value = undefined;
    // @ts-expect-error error is read-only
    context.error.value = undefined;
    // @ts-expect-error settings is read-only
    context.settings = {} as UserManagerSettings;
  });
});

describe("AuthContext methods mirror oidc-client-ts (SPEC §4.2)", () => {
  it("types the navigator and pass-through returns", () => {
    expectTypeOf<AuthContext["signinRedirect"]>().returns.toEqualTypeOf<
      Promise<void>
    >();
    expectTypeOf<AuthContext["signinPopup"]>().returns.toEqualTypeOf<
      Promise<User>
    >();
    expectTypeOf<AuthContext["signinSilent"]>().returns.toEqualTypeOf<
      Promise<User | null>
    >();
    expectTypeOf<AuthContext["querySessionStatus"]>().returns.toEqualTypeOf<
      Promise<SessionStatus | null>
    >();
    expectTypeOf<
      AuthContext["startSilentRenew"]
    >().returns.toEqualTypeOf<void>();
  });

  it("requires credentials for signinResourceOwnerCredentials", () => {
    // @ts-expect-error args are mandatory for this navigator
    void context.signinResourceOwnerCredentials();
  });
});

describe("OidcAuth (SPEC §4.1)", () => {
  it("extends AuthContext with install() and initialized", () => {
    expectTypeOf(auth).toExtend<AuthContext>();
    expectTypeOf<OidcAuth["install"]>().toBeCallableWith(app);
    expectTypeOf(auth.initialized).toEqualTypeOf<Promise<void>>();
  });
});

describe("AuthProviderSlotProps unwraps the state refs (SPEC §4.3)", () => {
  it("hands plain values to the default slot", () => {
    expectTypeOf<AuthProviderSlotProps["user"]>().toEqualTypeOf<
      User | null | undefined
    >();
    expectTypeOf<AuthProviderSlotProps["isLoading"]>().toEqualTypeOf<boolean>();
    expectTypeOf<
      AuthProviderSlotProps["isAuthenticated"]
    >().toEqualTypeOf<boolean>();
    expectTypeOf<AuthProviderSlotProps["activeNavigator"]>().toEqualTypeOf<
      NavigatorKey | undefined
    >();
    expectTypeOf<AuthProviderSlotProps["error"]>().toEqualTypeOf<
      ErrorContext | undefined
    >();
  });
});

describe("createAuthGuard (SPEC §4.5)", () => {
  it("produces a vue-router NavigationGuard", () => {
    expectTypeOf(createAuthGuard(auth)).toEqualTypeOf<NavigationGuard>();
    expectTypeOf(createAuthGuard).toBeCallableWith(auth, {
      shouldProtect: (to: RouteLocationNormalized) =>
        to.path.startsWith("/admin"),
      signinArgs: (to: RouteLocationNormalized) => ({
        state: { returnTo: to.fullPath },
      }),
    });
  });
});
