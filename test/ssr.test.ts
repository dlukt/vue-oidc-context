// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createOidcAuth } from "../src/index";
import { resetOidcClientMock, umMock } from "./mocks/oidc-client-ts";

vi.mock("oidc-client-ts", () => import("./mocks/oidc-client-ts"));

const baseSettings = {
  authority: "https://idp.example.com",
  client_id: "spa",
  redirect_uri: "https://app.example.com/",
};

beforeEach(() => {
  resetOidcClientMock();
});

describe("SSR-inert context (SPEC §6)", () => {
  it("does not construct a UserManager on the server", () => {
    createOidcAuth(baseSettings);
    expect(umMock.constructedWith).toHaveLength(0);
  });

  it("keeps the pre-init state and never settles initialized", async () => {
    const auth = createOidcAuth(baseSettings);
    expect(auth.isLoading.value).toBe(true);
    expect(auth.user.value).toBeUndefined();
    expect(auth.isAuthenticated.value).toBe(false);

    const outcome = await Promise.race([
      auth.initialized.then(() => "settled"),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 10)),
    ]);
    expect(outcome).toBe("pending");
  });

  it("exposes the raw settings", () => {
    const auth = createOidcAuth(baseSettings);
    expect(auth.settings).toEqual(baseSettings);
  });

  it("promise methods reject with a browser-only error", async () => {
    const auth = createOidcAuth(baseSettings);
    await expect(auth.signinRedirect()).rejects.toThrow(
      /only available in a browser/,
    );
    await expect(auth.signoutRedirect()).rejects.toThrow(
      /only available in a browser/,
    );
    await expect(auth.removeUser()).rejects.toThrow(
      /only available in a browser/,
    );
    await expect(auth.clearStaleState()).rejects.toThrow(
      /only available in a browser/,
    );
  });

  it("sync methods throw a browser-only error", () => {
    const auth = createOidcAuth(baseSettings);
    expect(() => auth.startSilentRenew()).toThrow(
      /only available in a browser/,
    );
    expect(() => auth.stopSilentRenew()).toThrow(/only available in a browser/);
  });

  it("event subscription is a safe no-op", () => {
    const auth = createOidcAuth(baseSettings);
    const off = auth.events.addUserLoaded(() => {});
    expect(typeof off).toBe("function");
    expect(() => off()).not.toThrow();
  });
});
