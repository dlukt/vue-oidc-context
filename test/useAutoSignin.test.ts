import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

import { createOidcAuth, useAutoSignin } from "../src/index";
import type { UseAutoSigninOptions } from "../src/index";
import {
  fireUserUnloaded,
  makeUser,
  resetOidcClientMock,
  umMock,
} from "./mocks/oidc-client-ts";

vi.mock("oidc-client-ts", () => import("./mocks/oidc-client-ts"));

const baseSettings = {
  authority: "https://idp.example.com",
  client_id: "spa",
  redirect_uri: "http://localhost:3000/",
};

function autoSigninComponent(options?: UseAutoSigninOptions) {
  return defineComponent({
    setup() {
      const { isLoading } = useAutoSignin(options);
      return () => h("div", isLoading.value ? "loading" : "ready");
    },
  });
}

beforeEach(() => {
  resetOidcClientMock();
  window.history.replaceState(null, "", "/");
});

describe("useAutoSignin (SPEC §4.4)", () => {
  it("attempts signinRedirect once initialization settles unauthenticated", async () => {
    const auth = createOidcAuth(baseSettings);
    mount(autoSigninComponent(), { global: { plugins: [auth] } });
    // Still initializing (isLoading) — no attempt yet.
    expect(umMock.signinRedirect).not.toHaveBeenCalled();

    await auth.initialized;
    await flushPromises();
    expect(umMock.signinRedirect).toHaveBeenCalledTimes(1);
  });

  it("attempts immediately during setup when conditions already hold", async () => {
    const auth = createOidcAuth(baseSettings);
    await auth.initialized;

    mount(autoSigninComponent(), { global: { plugins: [auth] } });
    expect(umMock.signinRedirect).toHaveBeenCalledTimes(1);
  });

  it("passes signinArgs through to signinRedirect", async () => {
    const auth = createOidcAuth(baseSettings);
    mount(
      autoSigninComponent({ signinArgs: { state: { returnTo: "/deep" } } }),
      { global: { plugins: [auth] } },
    );
    await auth.initialized;
    await flushPromises();
    expect(umMock.signinRedirect).toHaveBeenCalledWith({
      state: { returnTo: "/deep" },
    });
  });

  it("supports signinPopup as the signin method", async () => {
    const auth = createOidcAuth(baseSettings);
    mount(
      autoSigninComponent({
        signinMethod: "signinPopup",
        signinArgs: { popupWindowTarget: "auth" },
      }),
      { global: { plugins: [auth] } },
    );
    await auth.initialized;
    await flushPromises();
    expect(umMock.signinPopup).toHaveBeenCalledWith({
      popupWindowTarget: "auth",
    });
    expect(umMock.signinRedirect).not.toHaveBeenCalled();
  });

  it("does not attempt when a user is already authenticated", async () => {
    umMock.getUser.mockResolvedValue(makeUser());
    const auth = createOidcAuth(baseSettings);
    mount(autoSigninComponent(), { global: { plugins: [auth] } });
    await auth.initialized;
    await flushPromises();
    expect(umMock.signinRedirect).not.toHaveBeenCalled();
  });

  it("does not attempt while auth params are in the URL", async () => {
    window.history.replaceState(null, "", "/?code=abc&state=xyz");
    const auth = createOidcAuth(baseSettings);
    mount(autoSigninComponent(), { global: { plugins: [auth] } });
    await auth.initialized;
    await flushPromises();
    // The signin callback ran, but no auto attempt was made.
    expect(umMock.signinCallback).toHaveBeenCalled();
    expect(umMock.signinRedirect).not.toHaveBeenCalled();
  });

  it("attempts only once per context even with multiple components", async () => {
    const auth = createOidcAuth(baseSettings);
    const Comp = autoSigninComponent();
    const Root = defineComponent({
      setup: () => () => [h(Comp), h(Comp)],
    });
    mount(Root, { global: { plugins: [auth] } });
    await auth.initialized;
    await flushPromises();
    expect(umMock.signinRedirect).toHaveBeenCalledTimes(1);
  });

  it("fires from the watcher when conditions become true later", async () => {
    umMock.getUser.mockResolvedValue(makeUser());
    const auth = createOidcAuth(baseSettings);
    mount(autoSigninComponent(), { global: { plugins: [auth] } });
    await auth.initialized;
    await flushPromises();
    expect(umMock.signinRedirect).not.toHaveBeenCalled();

    fireUserUnloaded();
    await flushPromises();
    expect(umMock.signinRedirect).toHaveBeenCalledTimes(1);
  });

  it("surfaces attempt failures on the error ref without rejecting", async () => {
    umMock.signinRedirect.mockRejectedValue(new Error("denied"));
    let result: ReturnType<typeof useAutoSignin> | undefined;
    const Comp = defineComponent({
      setup() {
        result = useAutoSignin();
        return () => null;
      },
    });

    const auth = createOidcAuth(baseSettings);
    mount(Comp, { global: { plugins: [auth] } });
    await auth.initialized;
    await flushPromises();

    expect(result?.error.value?.message).toBe("denied");
    expect(result?.error.value?.source).toBe("signinRedirect");
  });

  it("returns the context's own reactive refs", async () => {
    let result: ReturnType<typeof useAutoSignin> | undefined;
    const Comp = defineComponent({
      setup() {
        result = useAutoSignin();
        return () => null;
      },
    });

    const auth = createOidcAuth(baseSettings);
    mount(Comp, { global: { plugins: [auth] } });
    await auth.initialized;

    expect(result?.isAuthenticated).toBe(auth.isAuthenticated);
    expect(result?.isLoading).toBe(auth.isLoading);
    expect(result?.error).toBe(auth.error);
  });
});
