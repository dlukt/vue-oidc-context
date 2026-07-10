import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import type { UserManager as RealUserManager } from "oidc-client-ts";

import { AuthProvider, createOidcAuth, useAuth } from "../src/index";
import type { AuthProviderSlotProps } from "../src/index";
import {
  makeUser,
  resetOidcClientMock,
  subscriberCounts,
  umMock,
  UserManager as MockUserManager,
} from "./mocks/oidc-client-ts";

vi.mock("oidc-client-ts", () => import("./mocks/oidc-client-ts"));

const baseSettings = {
  authority: "https://idp.example.com",
  client_id: "spa",
  redirect_uri: "http://localhost:3000/",
};

/** Renders "<client_id>:<state>" from the nearest injected context. */
const WhoAmI = defineComponent({
  setup() {
    const { user, isLoading, settings } = useAuth();
    return () =>
      h(
        "div",
        `${settings.client_id}:${
          isLoading.value ? "loading" : (user.value?.profile.sub ?? "anonymous")
        }`,
      );
  },
});

function asReal(um: MockUserManager): RealUserManager {
  return um as unknown as RealUserManager;
}

beforeEach(() => {
  resetOidcClientMock();
  window.history.replaceState(null, "", "/");
});

describe("<AuthProvider> (SPEC §4.3)", () => {
  it("creates a context from the settings prop and provides it to the subtree", async () => {
    umMock.getUser.mockResolvedValue(makeUser());
    const wrapper = mount(AuthProvider, {
      props: { settings: baseSettings },
      slots: { default: () => h(WhoAmI) },
    });

    expect(umMock.constructedWith).toEqual([baseSettings]);
    expect(wrapper.text()).toBe("spa:loading");

    await flushPromises();
    expect(wrapper.text()).toBe("spa:user-1");
  });

  it("hands the context to the default slot with refs unwrapped", async () => {
    umMock.getUser.mockResolvedValue(makeUser());
    let latest: AuthProviderSlotProps | undefined;
    const wrapper = mount(AuthProvider, {
      props: { settings: baseSettings },
      slots: {
        default: (props?: AuthProviderSlotProps) => {
          latest = props;
          return h(
            "div",
            props?.isLoading ? "loading" : String(props?.isAuthenticated),
          );
        },
      },
    });

    expect(latest?.isLoading).toBe(true);
    expect(latest?.user).toBeUndefined();

    await flushPromises();
    expect(wrapper.text()).toBe("true");
    expect(latest?.isAuthenticated).toBe(true);
    expect(latest?.user?.profile.sub).toBe("user-1");
    expect(latest?.settings).toEqual(baseSettings);
    expect(typeof latest?.signinRedirect).toBe("function");
  });

  it("throws when neither settings nor userManager is given", () => {
    expect(() =>
      mount(AuthProvider, { slots: { default: () => null } }),
    ).toThrow(/exactly one/);
  });

  it("throws when both settings and userManager are given", () => {
    const own = new MockUserManager(baseSettings);
    expect(() =>
      mount(AuthProvider, {
        props: { settings: baseSettings, userManager: asReal(own) },
        slots: { default: () => null },
      }),
    ).toThrow(/exactly one/);
  });

  it("forwards callback props to the context", async () => {
    const user = makeUser();
    umMock.signinCallback.mockResolvedValue(user);
    const onSigninCallback = vi.fn();
    window.history.replaceState(null, "", "/?code=abc&state=xyz");

    mount(AuthProvider, {
      props: { settings: baseSettings, onSigninCallback },
      slots: { default: () => null },
    });
    await flushPromises();

    expect(umMock.signinCallback).toHaveBeenCalledTimes(1);
    expect(onSigninCallback).toHaveBeenCalledWith(user);
  });

  it("honors the skipSigninCallback prop", async () => {
    window.history.replaceState(null, "", "/?code=abc&state=xyz");

    mount(AuthProvider, {
      props: { settings: baseSettings, skipSigninCallback: true },
      slots: { default: () => null },
    });
    await flushPromises();

    expect(umMock.signinCallback).not.toHaveBeenCalled();
    expect(umMock.getUser).toHaveBeenCalled();
  });

  it("uses a caller-supplied UserManager instead of constructing one", async () => {
    const own = new MockUserManager(baseSettings);
    mount(AuthProvider, {
      props: { userManager: asReal(own) },
      slots: { default: () => h(WhoAmI) },
    });
    await flushPromises();

    expect(umMock.constructedWith).toHaveLength(1); // only the explicit construction above
    expect(umMock.getUser).toHaveBeenCalled();
  });

  it("shadows the outer provider; both contexts update independently", async () => {
    const outerUm = new MockUserManager({
      ...baseSettings,
      client_id: "outer",
    });
    const innerUm = new MockUserManager({
      ...baseSettings,
      client_id: "inner",
    });

    const wrapper = mount(AuthProvider, {
      props: { userManager: asReal(outerUm) },
      slots: {
        default: () => [
          h(WhoAmI),
          h(
            AuthProvider,
            { userManager: asReal(innerUm) },
            { default: () => h(WhoAmI) },
          ),
        ],
      },
    });
    await flushPromises();
    expect(wrapper.text()).toContain("outer:anonymous");
    expect(wrapper.text()).toContain("inner:anonymous");

    innerUm.events.fireUserLoaded(makeUser({ profile: { sub: "inner-user" } }));
    await nextTick();
    expect(wrapper.text()).toContain("outer:anonymous");
    expect(wrapper.text()).toContain("inner:inner-user");

    outerUm.events.fireUserLoaded(makeUser({ profile: { sub: "outer-user" } }));
    await nextTick();
    expect(wrapper.text()).toContain("outer:outer-user");
    expect(wrapper.text()).toContain("inner:inner-user");
  });

  it("shadows a plugin-installed context", async () => {
    const auth = createOidcAuth({ ...baseSettings, client_id: "app" });
    const tenantUm = new MockUserManager({
      ...baseSettings,
      client_id: "tenant",
    });

    const Root = defineComponent({
      setup: () => () => [
        h(WhoAmI),
        h(
          AuthProvider,
          { userManager: asReal(tenantUm) },
          { default: () => h(WhoAmI) },
        ),
      ],
    });
    const wrapper = mount(Root, { global: { plugins: [auth] } });
    await flushPromises();

    expect(wrapper.text()).toContain("app:anonymous");
    expect(wrapper.text()).toContain("tenant:anonymous");
  });

  it("unsubscribes UserManager events on unmount (SPEC §5.5)", async () => {
    const wrapper = mount(AuthProvider, {
      props: { settings: baseSettings },
      slots: { default: () => null },
    });
    await flushPromises();
    expect(subscriberCounts()).toEqual({
      userLoaded: 1,
      userUnloaded: 1,
      userSignedOut: 1,
      silentRenewError: 1,
    });

    wrapper.unmount();
    expect(subscriberCounts()).toEqual({
      userLoaded: 0,
      userUnloaded: 0,
      userSignedOut: 0,
      silentRenewError: 0,
    });
  });
});
