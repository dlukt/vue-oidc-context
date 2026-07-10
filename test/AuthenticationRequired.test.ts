import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { h, nextTick } from "vue";

import { AuthenticationRequired, createOidcAuth } from "../src/index";
import type { AuthenticationRequiredProps, OidcAuth } from "../src/index";
import {
  fireUserLoaded,
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

function mountProtected(
  auth: OidcAuth,
  props: AuthenticationRequiredProps = {},
) {
  return mount(AuthenticationRequired, {
    props,
    slots: {
      default: () => h("div", "secret content"),
      redirecting: () => h("div", "redirecting…"),
    },
    global: { plugins: [auth] },
  });
}

beforeEach(() => {
  resetOidcClientMock();
  window.history.replaceState(null, "", "/");
});

describe("<AuthenticationRequired> (SPEC §4.6)", () => {
  it("renders the redirecting slot and signs in once initialization settles unauthenticated", async () => {
    const auth = createOidcAuth(baseSettings);
    const wrapper = mountProtected(auth);
    expect(wrapper.text()).toBe("redirecting…");
    // Still initializing (isLoading) — no attempt yet.
    expect(umMock.signinRedirect).not.toHaveBeenCalled();

    await auth.initialized;
    await flushPromises();
    expect(umMock.signinRedirect).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toBe("redirecting…");
  });

  it("attempts immediately during setup when conditions already hold", async () => {
    const auth = createOidcAuth(baseSettings);
    await auth.initialized;

    mountProtected(auth);
    expect(umMock.signinRedirect).toHaveBeenCalledTimes(1);
  });

  it("renders the default slot when authenticated and never invokes signin", async () => {
    umMock.getUser.mockResolvedValue(makeUser());
    const auth = createOidcAuth(baseSettings);
    const wrapper = mountProtected(auth);
    await flushPromises();

    expect(wrapper.text()).toBe("secret content");
    expect(umMock.signinRedirect).not.toHaveBeenCalled();
    expect(umMock.signinPopup).not.toHaveBeenCalled();
  });

  it("renders nothing while unauthenticated when no redirecting slot is given", async () => {
    const auth = createOidcAuth(baseSettings);
    const wrapper = mount(AuthenticationRequired, {
      slots: { default: () => h("div", "secret content") },
      global: { plugins: [auth] },
    });
    await flushPromises();

    expect(wrapper.text()).toBe("");
  });

  it("invokes signinPopup with signinArgs and reveals content once the user loads", async () => {
    const auth = createOidcAuth(baseSettings);
    const wrapper = mountProtected(auth, {
      signinMethod: "signinPopup",
      signinArgs: { popupWindowTarget: "auth" },
    });
    await auth.initialized;
    await flushPromises();

    expect(umMock.signinPopup).toHaveBeenCalledWith({
      popupWindowTarget: "auth",
    });
    expect(umMock.signinRedirect).not.toHaveBeenCalled();
    expect(wrapper.text()).toBe("redirecting…");

    fireUserLoaded(makeUser());
    await nextTick();
    expect(wrapper.text()).toBe("secret content");
  });

  it("does not invoke signin while auth params are in the URL", async () => {
    window.history.replaceState(null, "", "/?code=abc&state=xyz");
    const auth = createOidcAuth(baseSettings);
    const wrapper = mountProtected(auth);
    await auth.initialized;
    await flushPromises();

    // The signin callback ran, but no signin attempt was made.
    expect(umMock.signinCallback).toHaveBeenCalled();
    expect(umMock.signinRedirect).not.toHaveBeenCalled();
    expect(wrapper.text()).toBe("redirecting…");
  });

  it("attempts signin only once per component instance", async () => {
    umMock.signinRedirect.mockRejectedValue(new Error("denied"));
    const auth = createOidcAuth(baseSettings);
    const wrapper = mountProtected(auth);
    await auth.initialized;
    await flushPromises();
    expect(umMock.signinRedirect).toHaveBeenCalledTimes(1);

    // Conditions flip to authenticated and back — still no second attempt.
    fireUserLoaded(makeUser());
    await nextTick();
    expect(wrapper.text()).toBe("secret content");

    fireUserUnloaded();
    await flushPromises();
    expect(wrapper.text()).toBe("redirecting…");
    expect(umMock.signinRedirect).toHaveBeenCalledTimes(1);
  });
});
