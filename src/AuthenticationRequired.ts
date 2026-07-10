import type { SigninPopupArgs, SigninRedirectArgs } from "oidc-client-ts";
import type { PropType, SlotsType, VNodeChild } from "vue";
import { defineComponent } from "vue";

import { useAuth } from "./injection";
import { startAutoSignin } from "./useAutoSignin";

/** Props of <AuthenticationRequired> (SPEC §4.6). */
export interface AuthenticationRequiredProps {
  /** Default: "signinRedirect" */
  signinMethod?: "signinRedirect" | "signinPopup";
  signinArgs?: SigninRedirectArgs | SigninPopupArgs;
}

/** withAuthenticationRequired equivalent for apps not using vue-router, or for
 *  protecting a subtree rather than a route (SPEC §4.6). Renders the default
 *  slot while isAuthenticated; otherwise renders the #redirecting slot
 *  (default: nothing) and — once nothing is loading or in flight and no auth
 *  params are in the URL — invokes the signin method a single time per
 *  component instance. A failed attempt is not retried; the failure surfaces
 *  on the context's `error` ref (SPEC §5.4). */
export const AuthenticationRequired = defineComponent({
  name: "AuthenticationRequired",
  inheritAttrs: false,
  props: {
    signinMethod: {
      type: String as PropType<"signinRedirect" | "signinPopup">,
      default: "signinRedirect",
    },
    signinArgs: {
      type: Object as PropType<SigninRedirectArgs | SigninPopupArgs>,
      default: undefined,
    },
  },
  slots: Object as SlotsType<{ default?: void; redirecting?: void }>,
  setup(props, { slots }) {
    const auth = useAuth();
    let attempted = false;

    startAutoSignin({
      auth,
      isAttempted: () => attempted,
      markAttempted: () => {
        attempted = true;
      },
      invoke: () =>
        props.signinMethod === "signinPopup"
          ? auth.signinPopup(props.signinArgs)
          : auth.signinRedirect(props.signinArgs),
    });

    return (): VNodeChild =>
      auth.isAuthenticated.value ? slots.default?.() : slots.redirecting?.();
  },
});
