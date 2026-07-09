/**
 * Shared oidc-client-ts mock (PLAN §6). Activate per test file with:
 *   vi.mock("oidc-client-ts", () => import("./mocks/oidc-client-ts"));
 * Method mocks are shared across UserManager instances so tests can assert on
 * them; event handlers are captured so tests can fire events manually.
 */
import { vi } from "vitest";
import type {
  SessionStatus,
  SignoutResponse,
  User as OidcUser,
  UserManagerSettings,
} from "oidc-client-ts";

type UserLoadedHandler = (user: OidcUser) => void;
type VoidHandler = () => void;
type ErrorHandler = (error: Error) => void;

const userLoadedHandlers = new Set<UserLoadedHandler>();
const userUnloadedHandlers = new Set<VoidHandler>();
const userSignedOutHandlers = new Set<VoidHandler>();
const silentRenewErrorHandlers = new Set<ErrorHandler>();

export const umMock = {
  constructedWith: [] as UserManagerSettings[],
  getUser: vi.fn<() => Promise<OidcUser | null>>(),
  signinCallback: vi.fn<() => Promise<OidcUser | undefined>>(),
  signoutCallback: vi.fn<() => Promise<SignoutResponse | undefined>>(),
  signinRedirect: vi.fn<(args?: unknown) => Promise<void>>(),
  signinPopup: vi.fn<(args?: unknown) => Promise<OidcUser>>(),
  signinSilent: vi.fn<(args?: unknown) => Promise<OidcUser | null>>(),
  signinResourceOwnerCredentials: vi.fn<(args: unknown) => Promise<OidcUser>>(),
  signoutRedirect: vi.fn<(args?: unknown) => Promise<void>>(),
  signoutPopup: vi.fn<(args?: unknown) => Promise<void>>(),
  signoutSilent: vi.fn<(args?: unknown) => Promise<void>>(),
  removeUser: vi.fn<() => Promise<void>>(),
  clearStaleState: vi.fn<() => Promise<void>>(),
  querySessionStatus:
    vi.fn<(args?: unknown) => Promise<SessionStatus | null>>(),
  revokeTokens: vi.fn<(types?: unknown) => Promise<void>>(),
  startSilentRenew: vi.fn<() => void>(),
  stopSilentRenew: vi.fn<() => void>(),
};

export function fireUserLoaded(user: OidcUser): void {
  for (const handler of userLoadedHandlers) handler(user);
}
export function fireUserUnloaded(): void {
  for (const handler of userUnloadedHandlers) handler();
}
export function fireUserSignedOut(): void {
  for (const handler of userSignedOutHandlers) handler();
}
export function fireSilentRenewError(error: Error): void {
  for (const handler of silentRenewErrorHandlers) handler(error);
}

/** Live subscription counts, for asserting dispose() unsubscribes. */
export function subscriberCounts(): Record<string, number> {
  return {
    userLoaded: userLoadedHandlers.size,
    userUnloaded: userUnloadedHandlers.size,
    userSignedOut: userSignedOutHandlers.size,
    silentRenewError: silentRenewErrorHandlers.size,
  };
}

export function resetOidcClientMock(): void {
  userLoadedHandlers.clear();
  userUnloadedHandlers.clear();
  userSignedOutHandlers.clear();
  silentRenewErrorHandlers.clear();
  umMock.constructedWith.length = 0;

  umMock.getUser.mockReset().mockResolvedValue(null);
  umMock.signinCallback.mockReset().mockResolvedValue(undefined);
  umMock.signoutCallback.mockReset().mockResolvedValue(undefined);
  umMock.signinRedirect.mockReset().mockResolvedValue(undefined);
  umMock.signinPopup.mockReset().mockResolvedValue(makeUser());
  umMock.signinSilent.mockReset().mockResolvedValue(null);
  umMock.signinResourceOwnerCredentials
    .mockReset()
    .mockResolvedValue(makeUser());
  umMock.signoutRedirect.mockReset().mockResolvedValue(undefined);
  umMock.signoutPopup.mockReset().mockResolvedValue(undefined);
  umMock.signoutSilent.mockReset().mockResolvedValue(undefined);
  umMock.removeUser.mockReset().mockResolvedValue(undefined);
  umMock.clearStaleState.mockReset().mockResolvedValue(undefined);
  umMock.querySessionStatus.mockReset().mockResolvedValue(null);
  umMock.revokeTokens.mockReset().mockResolvedValue(undefined);
  umMock.startSilentRenew.mockReset();
  umMock.stopSilentRenew.mockReset();
}

/** Builds a User-shaped object; oidc-client-ts's real User class is irrelevant here. */
export function makeUser(
  overrides: Partial<{
    expired: boolean;
    access_token: string;
    profile: { sub: string; name?: string };
    state: unknown;
  }> = {},
): OidcUser {
  return {
    access_token: "access-token",
    expired: false,
    profile: { sub: "user-1" },
    ...overrides,
  } as unknown as OidcUser;
}

class MockUserManagerEvents {
  addUserLoaded = (cb: UserLoadedHandler): (() => void) => {
    userLoadedHandlers.add(cb);
    return () => userLoadedHandlers.delete(cb);
  };
  addUserUnloaded = (cb: VoidHandler): (() => void) => {
    userUnloadedHandlers.add(cb);
    return () => userUnloadedHandlers.delete(cb);
  };
  addUserSignedOut = (cb: VoidHandler): (() => void) => {
    userSignedOutHandlers.add(cb);
    return () => userSignedOutHandlers.delete(cb);
  };
  addSilentRenewError = (cb: ErrorHandler): (() => void) => {
    silentRenewErrorHandlers.add(cb);
    return () => silentRenewErrorHandlers.delete(cb);
  };
}

export class UserManager {
  readonly settings: UserManagerSettings;
  readonly events = new MockUserManagerEvents();

  constructor(settings: UserManagerSettings) {
    this.settings = settings;
    umMock.constructedWith.push(settings);
  }

  getUser = umMock.getUser;
  signinCallback = umMock.signinCallback;
  signoutCallback = umMock.signoutCallback;
  signinRedirect = umMock.signinRedirect;
  signinPopup = umMock.signinPopup;
  signinSilent = umMock.signinSilent;
  signinResourceOwnerCredentials = umMock.signinResourceOwnerCredentials;
  signoutRedirect = umMock.signoutRedirect;
  signoutPopup = umMock.signoutPopup;
  signoutSilent = umMock.signoutSilent;
  removeUser = umMock.removeUser;
  clearStaleState = umMock.clearStaleState;
  querySessionStatus = umMock.querySessionStatus;
  revokeTokens = umMock.revokeTokens;
  startSilentRenew = umMock.startSilentRenew;
  stopSilentRenew = umMock.stopSilentRenew;
}

// Runtime names re-exported by src/index.ts must exist on the mocked module.
export class User {}
export class WebStorageStateStore {}
export class InMemoryWebStorage {}
export const Log = { setLogger: vi.fn(), setLevel: vi.fn() };
