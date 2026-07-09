import type { ErrorContext, ErrorSource } from "./types";

export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** True when the URL carries an OIDC authorization response:
 *  (code | error) + state in the query string (response_mode "query")
 *  or in the fragment (response_mode "fragment"). Parity with react-oidc-context. */
export function hasAuthParams(location: Location = window.location): boolean {
  // response_mode: "query"
  let searchParams = new URLSearchParams(location.search);
  if (
    (searchParams.get("code") || searchParams.get("error")) &&
    searchParams.get("state")
  ) {
    return true;
  }

  // response_mode: "fragment"
  searchParams = new URLSearchParams(location.hash.replace("#", "?"));
  if (
    (searchParams.get("code") || searchParams.get("error")) &&
    searchParams.get("state")
  ) {
    return true;
  }

  return false;
}

/** Thrown Error instances are tagged with `source`; non-Error values are wrapped
 *  in an Error with the original value preserved on `innerError` (SPEC §7). */
export function normalizeError(
  error: unknown,
  source: ErrorSource,
): ErrorContext {
  if (error instanceof Error) {
    return Object.assign(error, { source });
  }
  return Object.assign(new Error(`${source} failed`), {
    source,
    innerError: error,
  });
}

export function browserOnlyError(method: string): Error {
  return new Error(
    `@dlukt/vue-oidc-context: ${method}() is only available in a browser.`,
  );
}
