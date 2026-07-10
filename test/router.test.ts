import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import type {
  NavigationGuard,
  NavigationGuardNext,
  RouteLocationNormalizedLoaded,
} from "vue-router";
import type { User as OidcUser } from "oidc-client-ts";

import { createOidcAuth } from "../src/index";
import type { OidcAuth } from "../src/index";
import { createAuthGuard } from "../src/router";
import { makeUser, resetOidcClientMock, umMock } from "./mocks/oidc-client-ts";

vi.mock("oidc-client-ts", () => import("./mocks/oidc-client-ts"));

const baseSettings = {
  authority: "https://idp.example.com",
  client_id: "spa",
  redirect_uri: "http://localhost:3000/",
};

/** Fabricated route object (PLAN §6: guard tests need no real router). Loaded
 *  is the narrower shape, usable as both the `to` and `from` guard arguments. */
function route(
  overrides: Partial<RouteLocationNormalizedLoaded> = {},
): RouteLocationNormalizedLoaded {
  return {
    fullPath: "/",
    path: "/",
    query: {},
    hash: "",
    name: undefined,
    params: {},
    matched: [],
    meta: {},
    redirectedFrom: undefined,
    ...overrides,
  };
}

function protectedRoute(fullPath = "/admin"): RouteLocationNormalizedLoaded {
  return route({ fullPath, path: fullPath, meta: { requiresAuth: true } });
}

const next = (() => {}) as NavigationGuardNext;

/** Calls the guard the way vue-router would; normalized to a promise. */
function run(
  guard: NavigationGuard,
  to: RouteLocationNormalizedLoaded,
): Promise<unknown> {
  return Promise.resolve(guard(to, route(), next));
}

beforeEach(() => {
  resetOidcClientMock();
  window.history.replaceState(null, "", "/");
});

describe("createAuthGuard (SPEC §4.5)", () => {
  it("allows unprotected routes without waiting for initialization", async () => {
    umMock.getUser.mockReturnValue(new Promise<never>(() => {})); // init never settles
    const auth = createOidcAuth(baseSettings);
    const guard = createAuthGuard(auth);

    await expect(
      run(guard, route({ fullPath: "/public", path: "/public" })),
    ).resolves.toBe(true);
    expect(umMock.signinRedirect).not.toHaveBeenCalled();
  });

  it("waits for initialization before deciding on protected routes", async () => {
    let resolveGetUser!: (user: OidcUser | null) => void;
    umMock.getUser.mockReturnValue(
      new Promise<OidcUser | null>((resolve) => {
        resolveGetUser = resolve;
      }),
    );
    const auth = createOidcAuth(baseSettings);
    const guard = createAuthGuard(auth);

    let settled = false;
    const decision = run(guard, protectedRoute()).then((allowed) => {
      settled = true;
      return allowed;
    });
    await flushPromises();
    expect(settled).toBe(false);

    resolveGetUser(makeUser());
    await expect(decision).resolves.toBe(true);
    expect(umMock.signinRedirect).not.toHaveBeenCalled();
  });

  it("allows authenticated users through", async () => {
    umMock.getUser.mockResolvedValue(makeUser());
    const auth = createOidcAuth(baseSettings);
    const guard = createAuthGuard(auth);

    await expect(run(guard, protectedRoute())).resolves.toBe(true);
    expect(umMock.signinRedirect).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users with returnTo state and cancels the navigation", async () => {
    const auth = createOidcAuth(baseSettings);
    const guard = createAuthGuard(auth);

    await expect(run(guard, protectedRoute("/admin?tab=users"))).resolves.toBe(
      false,
    );
    expect(umMock.signinRedirect).toHaveBeenCalledWith({
      state: { returnTo: "/admin?tab=users" },
    });
  });

  it("treats an expired user as unauthenticated", async () => {
    umMock.getUser.mockResolvedValue(makeUser({ expired: true }));
    const auth = createOidcAuth(baseSettings);
    const guard = createAuthGuard(auth);

    await expect(run(guard, protectedRoute())).resolves.toBe(false);
    expect(umMock.signinRedirect).toHaveBeenCalledTimes(1);
  });

  it("supports a custom shouldProtect predicate, replacing the meta check", async () => {
    const auth = createOidcAuth(baseSettings);
    const guard = createAuthGuard(auth, {
      shouldProtect: (to) => to.path.startsWith("/admin"),
    });

    await expect(
      run(guard, route({ fullPath: "/admin/users", path: "/admin/users" })),
    ).resolves.toBe(false);
    expect(umMock.signinRedirect).toHaveBeenCalledTimes(1);

    // requiresAuth meta is ignored once shouldProtect is customized.
    await expect(run(guard, protectedRoute("/other"))).resolves.toBe(true);
    expect(umMock.signinRedirect).toHaveBeenCalledTimes(1);
  });

  it("passes static signinArgs through unchanged", async () => {
    const auth = createOidcAuth(baseSettings);
    const guard = createAuthGuard(auth, {
      signinArgs: { extraQueryParams: { audience: "api" } },
    });

    await expect(run(guard, protectedRoute())).resolves.toBe(false);
    expect(umMock.signinRedirect).toHaveBeenCalledWith({
      extraQueryParams: { audience: "api" },
    });
  });

  it("derives signinArgs from the target route when given a function", async () => {
    const auth = createOidcAuth(baseSettings);
    const guard = createAuthGuard(auth, {
      signinArgs: (to) => ({
        state: { returnTo: to.fullPath, reason: "guard" },
      }),
    });

    await expect(run(guard, protectedRoute("/reports/42"))).resolves.toBe(
      false,
    );
    expect(umMock.signinRedirect).toHaveBeenCalledWith({
      state: { returnTo: "/reports/42", reason: "guard" },
    });
  });

  it("cancels the navigation even when signinRedirect rejects", async () => {
    umMock.signinRedirect.mockRejectedValue(new Error("idp down"));
    const auth = createOidcAuth(baseSettings);
    const guard = createAuthGuard(auth);

    await expect(run(guard, protectedRoute())).resolves.toBe(false);
    expect(auth.error.value?.message).toBe("idp down");
    expect(auth.error.value?.source).toBe("signinRedirect");
  });
});

describe("createAuthGuard on a real router (peer range ^4.2 || ^5)", () => {
  const Empty = defineComponent({ name: "Empty", render: () => null });

  function buildRouter(auth: OidcAuth) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", component: Empty },
        { path: "/admin", component: Empty, meta: { requiresAuth: true } },
      ],
    });
    router.beforeEach(createAuthGuard(auth));
    return router;
  }

  it("cancels navigation for unauthenticated users", async () => {
    const auth = createOidcAuth(baseSettings);
    const router = buildRouter(auth);

    await router.push("/");
    await router.push("/admin");

    expect(router.currentRoute.value.path).toBe("/");
    expect(umMock.signinRedirect).toHaveBeenCalledWith({
      state: { returnTo: "/admin" },
    });
  });

  it("navigates authenticated users to the protected route", async () => {
    umMock.getUser.mockResolvedValue(makeUser());
    const auth = createOidcAuth(baseSettings);
    const router = buildRouter(auth);

    await router.push("/");
    await router.push("/admin");

    expect(router.currentRoute.value.path).toBe("/admin");
    expect(umMock.signinRedirect).not.toHaveBeenCalled();
  });
});
