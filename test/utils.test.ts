import { describe, expect, it } from "vitest";

import { browserOnlyError, hasAuthParams, normalizeError } from "../src/utils";

function fakeLocation(parts: { search?: string; hash?: string }): Location {
  return { search: "", hash: "", ...parts } as Location;
}

describe("hasAuthParams", () => {
  it("detects code + state in the query string", () => {
    expect(hasAuthParams(fakeLocation({ search: "?code=abc&state=xyz" }))).toBe(
      true,
    );
  });

  it("detects error + state in the query string", () => {
    expect(
      hasAuthParams(fakeLocation({ search: "?error=access_denied&state=xyz" })),
    ).toBe(true);
  });

  it("detects code + state in the fragment (response_mode fragment)", () => {
    expect(hasAuthParams(fakeLocation({ hash: "#code=abc&state=xyz" }))).toBe(
      true,
    );
  });

  it("requires state alongside code", () => {
    expect(hasAuthParams(fakeLocation({ search: "?code=abc" }))).toBe(false);
  });

  it("requires code or error alongside state", () => {
    expect(hasAuthParams(fakeLocation({ search: "?state=xyz" }))).toBe(false);
  });

  it("returns false for unrelated params", () => {
    expect(hasAuthParams(fakeLocation({ search: "?foo=bar" }))).toBe(false);
  });

  it("defaults to window.location", () => {
    window.history.replaceState(null, "", "/?code=abc&state=xyz");
    expect(hasAuthParams()).toBe(true);
    window.history.replaceState(null, "", "/");
    expect(hasAuthParams()).toBe(false);
  });
});

describe("normalizeError", () => {
  it("tags Error instances with the source", () => {
    const original = new Error("boom");
    const normalized = normalizeError(original, "signinCallback");
    expect(normalized).toBe(original);
    expect(normalized.source).toBe("signinCallback");
    expect(normalized.innerError).toBeUndefined();
  });

  it("wraps non-Error values and preserves them on innerError", () => {
    const normalized = normalizeError("string failure", "renewSilent");
    expect(normalized).toBeInstanceOf(Error);
    expect(normalized.source).toBe("renewSilent");
    expect(normalized.innerError).toBe("string failure");
  });
});

describe("browserOnlyError", () => {
  it("names the method in the message", () => {
    expect(browserOnlyError("signinRedirect").message).toMatch(
      /signinRedirect\(\) is only available in a browser/,
    );
  });
});
