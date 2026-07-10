import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  User as OidcUser,
  UserManager as RealUserManager,
} from "oidc-client-ts";

import { createOidcAuth } from "../src/index";
import type { NavigatorKey } from "../src/index";
import {
  fireSilentRenewError,
  fireUserLoaded,
  fireUserSignedOut,
  fireUserUnloaded,
  makeUser,
  resetOidcClientMock,
  umMock,
  UserManager as MockUserManager,
} from "./mocks/oidc-client-ts";

vi.mock("oidc-client-ts", () => import("./mocks/oidc-client-ts"));

const baseSettings = {
  authority: "https://idp.example.com",
  client_id: "spa",
  redirect_uri: "http://localhost:3000/",
};

function setUrl(path: string): void {
  window.history.replaceState(null, "", path);
}

beforeEach(() => {
  resetOidcClientMock();
  setUrl("/");
});

describe("initialization (SPEC §5.1)", () => {
  it("constructs a UserManager from flat settings and loads the stored user", async () => {
    const user = makeUser();
    umMock.getUser.mockResolvedValue(user);

    const auth = createOidcAuth(baseSettings);
    expect(auth.isLoading.value).toBe(true);
    expect(auth.user.value).toBeUndefined();

    await auth.initialized;
    expect(umMock.constructedWith).toEqual([baseSettings]);
    expect(umMock.signinCallback).not.toHaveBeenCalled();
    expect(auth.user.value).toBe(user);
    expect(auth.isAuthenticated.value).toBe(true);
    expect(auth.isLoading.value).toBe(false);
  });

  it("settles with user null when no session is stored", async () => {
    const auth = createOidcAuth(baseSettings);
    await auth.initialized;
    expect(auth.user.value).toBeNull();
    expect(auth.isAuthenticated.value).toBe(false);
    expect(auth.isLoading.value).toBe(false);
  });

  it("processes the signin callback when auth params are present", async () => {
    const user = makeUser();
    umMock.signinCallback.mockResolvedValue(user);
    const onSigninCallback = vi.fn();
    setUrl("/?code=abc&state=xyz");

    const auth = createOidcAuth({ ...baseSettings, onSigninCallback });
    await auth.initialized;

    expect(umMock.signinCallback).toHaveBeenCalledTimes(1);
    expect(onSigninCallback).toHaveBeenCalledWith(user);
    expect(umMock.getUser).not.toHaveBeenCalled();
    expect(auth.user.value).toBe(user);
    expect(auth.isAuthenticated.value).toBe(true);
  });

  it("falls back to getUser when signinCallback yields no user (popup/silent callback)", async () => {
    umMock.signinCallback.mockResolvedValue(undefined);
    const onSigninCallback = vi.fn();
    setUrl("/?code=abc&state=xyz");

    const auth = createOidcAuth({ ...baseSettings, onSigninCallback });
    await auth.initialized;

    expect(umMock.signinCallback).toHaveBeenCalled();
    expect(onSigninCallback).toHaveBeenCalledWith(undefined);
    expect(umMock.getUser).toHaveBeenCalled();
  });

  it("skips the signin callback when skipSigninCallback is set", async () => {
    setUrl("/?code=abc&state=xyz");

    const auth = createOidcAuth({ ...baseSettings, skipSigninCallback: true });
    await auth.initialized;

    expect(umMock.signinCallback).not.toHaveBeenCalled();
    expect(umMock.getUser).toHaveBeenCalled();
  });

  it("surfaces signin callback failures as error with source signinCallback", async () => {
    umMock.signinCallback.mockRejectedValue(new Error("bad callback"));
    setUrl("/?code=abc&state=xyz");

    const auth = createOidcAuth(baseSettings);
    await auth.initialized;

    expect(auth.error.value?.message).toBe("bad callback");
    expect(auth.error.value?.source).toBe("signinCallback");
    expect(auth.isLoading.value).toBe(false);
  });

  it("clears an error raised mid-initialization once initialization succeeds", async () => {
    let resolveGetUser!: (user: OidcUser | null) => void;
    umMock.getUser.mockReturnValue(
      new Promise<OidcUser | null>((resolve) => {
        resolveGetUser = resolve;
      }),
    );

    const auth = createOidcAuth(baseSettings);
    fireSilentRenewError(new Error("renew failed"));
    expect(auth.error.value?.source).toBe("renewSilent");

    resolveGetUser(makeUser());
    await auth.initialized;
    expect(auth.error.value).toBeUndefined();
    expect(auth.isAuthenticated.value).toBe(true);
  });

  it("processes the signout callback when matchSignoutCallback returns true", async () => {
    const response = {
      state: "s",
    } as unknown as import("oidc-client-ts").SignoutResponse;
    umMock.signoutCallback.mockResolvedValue(response);
    const matchSignoutCallback = vi.fn(() => true);
    const onSignoutCallback = vi.fn();

    const auth = createOidcAuth({
      ...baseSettings,
      matchSignoutCallback,
      onSignoutCallback,
    });
    await auth.initialized;

    expect(matchSignoutCallback).toHaveBeenCalledWith(baseSettings);
    expect(umMock.signoutCallback).toHaveBeenCalledTimes(1);
    expect(onSignoutCallback).toHaveBeenCalledWith(response);
  });

  it("does not process the signout callback when matchSignoutCallback returns false", async () => {
    const matchSignoutCallback = vi.fn(() => false);

    const auth = createOidcAuth({ ...baseSettings, matchSignoutCallback });
    await auth.initialized;

    expect(matchSignoutCallback).toHaveBeenCalledWith(baseSettings);
    expect(umMock.signoutCallback).not.toHaveBeenCalled();
  });

  it("still processes the signout callback after a signin callback failure", async () => {
    umMock.signinCallback.mockRejectedValue(new Error("bad callback"));
    setUrl("/?code=abc&state=xyz");

    const auth = createOidcAuth({
      ...baseSettings,
      matchSignoutCallback: () => true,
    });
    await auth.initialized;

    expect(umMock.signoutCallback).toHaveBeenCalledTimes(1);
    expect(auth.error.value?.source).toBe("signinCallback");
  });

  it("surfaces signout callback failures as error with source signoutCallback", async () => {
    umMock.signoutCallback.mockRejectedValue(new Error("bad signout"));

    const auth = createOidcAuth({
      ...baseSettings,
      matchSignoutCallback: () => true,
    });
    await auth.initialized;

    expect(auth.error.value?.source).toBe("signoutCallback");
  });

  it("uses a caller-supplied UserManager instead of constructing one", async () => {
    const own = new MockUserManager(baseSettings) as unknown as RealUserManager;
    const auth = createOidcAuth({ userManager: own });
    await auth.initialized;

    expect(umMock.constructedWith).toHaveLength(1); // only the explicit construction above
    expect(auth.settings).toBe(baseSettings);
    expect(umMock.getUser).toHaveBeenCalled();
  });
});

describe("event subscriptions (SPEC §5.2)", () => {
  it("userLoaded updates user, clears error, resets signed-out", async () => {
    const auth = createOidcAuth(baseSettings);
    await auth.initialized;

    fireSilentRenewError(new Error("renew failed"));
    expect(auth.error.value).toBeDefined();

    const user = makeUser();
    fireUserLoaded(user);
    expect(auth.user.value).toBe(user);
    expect(auth.isAuthenticated.value).toBe(true);
    expect(auth.error.value).toBeUndefined();
  });

  it("userUnloaded sets user to null", async () => {
    umMock.getUser.mockResolvedValue(makeUser());
    const auth = createOidcAuth(baseSettings);
    await auth.initialized;

    fireUserUnloaded();
    expect(auth.user.value).toBeNull();
    expect(auth.isAuthenticated.value).toBe(false);
  });

  it("userSignedOut makes isAuthenticated false while retaining user", async () => {
    const user = makeUser();
    umMock.getUser.mockResolvedValue(user);
    const auth = createOidcAuth(baseSettings);
    await auth.initialized;
    expect(auth.isAuthenticated.value).toBe(true);

    fireUserSignedOut();
    expect(auth.isAuthenticated.value).toBe(false);
    expect(auth.user.value).toBe(user);

    // signing in again resets the flag
    fireUserLoaded(makeUser());
    expect(auth.isAuthenticated.value).toBe(true);
  });

  it("silentRenewError sets error with source renewSilent", async () => {
    const auth = createOidcAuth(baseSettings);
    await auth.initialized;

    fireSilentRenewError(new Error("renew failed"));
    expect(auth.error.value?.message).toBe("renew failed");
    expect(auth.error.value?.source).toBe("renewSilent");
  });

  it("an expired user is not authenticated", async () => {
    umMock.getUser.mockResolvedValue(makeUser({ expired: true }));
    const auth = createOidcAuth(baseSettings);
    await auth.initialized;

    expect(auth.user.value).not.toBeNull();
    expect(auth.isAuthenticated.value).toBe(false);
  });
});

describe("navigator methods (SPEC §5.4)", () => {
  type NavigatorMock = ReturnType<
    typeof vi.fn<(args?: unknown) => Promise<unknown>>
  >;

  const navigatorCases: [NavigatorKey, Record<string, unknown>][] = [
    ["signinRedirect", { state: { returnTo: "/deep" } }],
    ["signinPopup", { popupWindowTarget: "auth" }],
    ["signinSilent", { resource: "api" }],
    ["signinResourceOwnerCredentials", { username: "u", password: "p" }],
    ["signoutRedirect", { state: "s" }],
    ["signoutPopup", { popupWindowTarget: "auth" }],
    ["signoutSilent", { state: "s" }],
  ];

  it.each(navigatorCases)(
    "%s delegates with args and tracks activeNavigator/isLoading for the duration",
    async (method, args) => {
      const auth = createOidcAuth(baseSettings);
      await auth.initialized;

      const mock = umMock[method] as unknown as NavigatorMock;
      let release!: (value?: unknown) => void;
      mock.mockReturnValue(
        new Promise((resolve) => {
          release = resolve;
        }),
      );

      const invoke = auth[method] as (args?: unknown) => Promise<unknown>;
      const pending = invoke(args);
      expect(auth.activeNavigator.value).toBe(method);
      expect(auth.isLoading.value).toBe(true);

      release();
      await pending;
      expect(mock).toHaveBeenCalledWith(args);
      expect(auth.activeNavigator.value).toBeUndefined();
      expect(auth.isLoading.value).toBe(false);
    },
  );

  it("passes arguments through and returns the result", async () => {
    const user = makeUser();
    umMock.signinPopup.mockResolvedValue(user);
    const auth = createOidcAuth(baseSettings);
    await auth.initialized;

    await expect(auth.signinPopup({ popupWindowTarget: "w" })).resolves.toBe(
      user,
    );
    expect(umMock.signinPopup).toHaveBeenCalledWith({ popupWindowTarget: "w" });
  });

  it("captures failures into error and still rejects", async () => {
    umMock.signoutRedirect.mockRejectedValue(new Error("nope"));
    const auth = createOidcAuth(baseSettings);
    await auth.initialized;

    await expect(auth.signoutRedirect()).rejects.toThrow("nope");
    expect(auth.error.value?.source).toBe("signoutRedirect");
    expect(auth.activeNavigator.value).toBeUndefined();
    expect(auth.isLoading.value).toBe(false);
  });

  it("wraps non-Error rejections into an Error with innerError (SPEC §7)", async () => {
    umMock.signinSilent.mockRejectedValue("string failure");
    const auth = createOidcAuth(baseSettings);
    await auth.initialized;

    await expect(auth.signinSilent()).rejects.toBe("string failure");
    expect(auth.error.value).toBeInstanceOf(Error);
    expect(auth.error.value?.source).toBe("signinSilent");
    expect(auth.error.value?.innerError).toBe("string failure");
  });
});

describe("pass-through methods", () => {
  it("removeUser delegates and then invokes onRemoveUser", async () => {
    const onRemoveUser = vi.fn();
    const auth = createOidcAuth({ ...baseSettings, onRemoveUser });
    await auth.initialized;

    await auth.removeUser();
    expect(umMock.removeUser).toHaveBeenCalledTimes(1);
    expect(onRemoveUser).toHaveBeenCalledTimes(1);
  });

  it("removeUser works without an onRemoveUser callback", async () => {
    const auth = createOidcAuth(baseSettings);
    await auth.initialized;

    await expect(auth.removeUser()).resolves.toBeUndefined();
    expect(umMock.removeUser).toHaveBeenCalledTimes(1);
  });

  it("delegates the remaining UserManager methods", async () => {
    const auth = createOidcAuth(baseSettings);
    await auth.initialized;

    await auth.clearStaleState();
    await auth.querySessionStatus();
    await auth.revokeTokens(["access_token"]);
    auth.startSilentRenew();
    auth.stopSilentRenew();

    expect(umMock.clearStaleState).toHaveBeenCalled();
    expect(umMock.querySessionStatus).toHaveBeenCalled();
    expect(umMock.revokeTokens).toHaveBeenCalledWith(["access_token"]);
    expect(umMock.startSilentRenew).toHaveBeenCalled();
    expect(umMock.stopSilentRenew).toHaveBeenCalled();
  });

  it("exposes the UserManager settings and events", async () => {
    const auth = createOidcAuth(baseSettings);
    await auth.initialized;

    expect(auth.settings).toEqual(baseSettings);
    const off = auth.events.addUserLoaded(() => {});
    expect(typeof off).toBe("function");
    off();
  });
});
