import type { InjectionKey } from "vue";
import { inject } from "vue";

import type { AuthContext } from "./types";

/** The InjectionKey used by the plugin and <AuthProvider>. For building custom
 *  providers or accessing the context from libraries (SPEC §4.8). */
export const AUTH_CONTEXT_KEY: InjectionKey<AuthContext> = Symbol(
  "@dlukt/vue-oidc-context",
);

/** Injects the nearest AuthContext. Throws when no plugin/provider is installed above. */
export function useAuth(): AuthContext {
  const context = inject(AUTH_CONTEXT_KEY);
  if (!context) {
    throw new Error(
      "useAuth() requires the auth plugin (app.use(createOidcAuth(...))) or an enclosing <AuthProvider>.",
    );
  }
  return context;
}
