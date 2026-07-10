import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import { createOidcAuth, useAuth } from "../src/index";
import {
  fireUserLoaded,
  makeUser,
  resetOidcClientMock,
  subscriberCounts,
  umMock,
} from "./mocks/oidc-client-ts";

vi.mock("oidc-client-ts", () => import("./mocks/oidc-client-ts"));

const baseSettings = {
  authority: "https://idp.example.com",
  client_id: "spa",
  redirect_uri: "http://localhost:3000/",
};

beforeEach(() => {
  resetOidcClientMock();
  window.history.replaceState(null, "", "/");
});

describe("createOidcAuth plugin + useAuth (SPEC §4.1/§4.2)", () => {
  it("provides the context to components, which render reactively", async () => {
    umMock.getUser.mockResolvedValue(makeUser({ profile: { sub: "user-1" } }));
    const auth = createOidcAuth(baseSettings);

    const Child = defineComponent({
      setup() {
        const { user, isAuthenticated, isLoading } = useAuth();
        return () =>
          h(
            "div",
            isLoading.value
              ? "loading"
              : isAuthenticated.value
                ? `hello ${user.value?.profile.sub ?? "?"}`
                : "anonymous",
          );
      },
    });

    const wrapper = mount(Child, { global: { plugins: [auth] } });
    expect(wrapper.text()).toBe("loading");

    await auth.initialized;
    await nextTick();
    expect(wrapper.text()).toBe("hello user-1");
  });

  it("exposes the callable context on the auth instance itself (non-app usage)", async () => {
    const auth = createOidcAuth(baseSettings);
    await auth.initialized;

    await auth.signinRedirect({ state: { returnTo: "/x" } });
    expect(umMock.signinRedirect).toHaveBeenCalledWith({
      state: { returnTo: "/x" },
    });
  });

  it("useAuth() outside a provider throws a descriptive error", () => {
    const Comp = defineComponent({
      setup() {
        useAuth();
        return () => null;
      },
    });
    expect(() => mount(Comp)).toThrow(/requires the auth plugin/);
  });

  it("ignores a second install on the same app with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const auth = createOidcAuth(baseSettings);
      const app = createApp({ render: () => null });
      auth.install(app);
      auth.install(app);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("already installed"),
      );
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it("shares state across a second app and disposes only after the last unmount (SPEC §4.1/§5.5)", async () => {
    umMock.getUser.mockResolvedValue(makeUser({ profile: { sub: "shared" } }));
    const auth = createOidcAuth(baseSettings);
    await auth.initialized;

    const Child = defineComponent({
      setup() {
        const { user } = useAuth();
        return () => h("div", user.value?.profile.sub ?? "anonymous");
      },
    });

    const first = mount(Child, { global: { plugins: [auth] } });
    const second = mount(Child, { global: { plugins: [auth] } });
    // One shared context: a single subscription set serves both apps.
    expect(subscriberCounts().userLoaded).toBe(1);
    expect(first.text()).toBe("shared");
    expect(second.text()).toBe("shared");

    fireUserLoaded(makeUser({ profile: { sub: "renewed" } }));
    await nextTick();
    expect(first.text()).toBe("renewed");
    expect(second.text()).toBe("renewed");

    first.unmount();
    expect(subscriberCounts().userLoaded).toBe(1);

    second.unmount();
    expect(subscriberCounts().userLoaded).toBe(0);
    // Teardown only unsubscribes — silent renew keeps running (SPEC §5.5).
    expect(umMock.stopSilentRenew).not.toHaveBeenCalled();
  });

  it("unsubscribes UserManager events when the app unmounts (SPEC §5.5)", async () => {
    const auth = createOidcAuth(baseSettings);
    await auth.initialized;
    expect(subscriberCounts()).toEqual({
      userLoaded: 1,
      userUnloaded: 1,
      userSignedOut: 1,
      silentRenewError: 1,
    });

    const app = createApp({ render: () => null });
    app.use(auth);
    app.mount(document.createElement("div"));
    app.unmount();

    expect(subscriberCounts()).toEqual({
      userLoaded: 0,
      userUnloaded: 0,
      userSignedOut: 0,
      silentRenewError: 0,
    });
  });
});
