import type { User, UserManager, UserManagerSettings } from "oidc-client-ts";
import type { PropType, SlotsType, VNodeChild } from "vue";
import { defineComponent, onScopeDispose, provide } from "vue";

import { createAuthContext } from "./context";
import { AUTH_CONTEXT_KEY } from "./injection";
import type {
  AuthCallbacks,
  AuthContext,
  AuthState,
  ErrorContext,
  NavigatorKey,
  OidcAuthOptions,
} from "./types";

/** Props of <AuthProvider> (SPEC §4.3): the AuthCallbacks plus exactly one of
 *  `settings` (the component constructs the UserManager) or `userManager`. */
export interface AuthProviderProps extends AuthCallbacks {
  /** UserManagerSettings as a single object prop (templates can't spread 40 flat props). */
  settings?: UserManagerSettings;
  /** Bring-your-own UserManager. Exactly one of settings/userManager must be set. */
  userManager?: UserManager;
}

/** The AuthContext with its refs unwrapped to plain values — the shape handed
 *  to the default slot on every render (slot props are not top-level template
 *  bindings, so Vue would not unwrap refs there). */
export type AuthProviderSlotProps = Omit<AuthContext, keyof AuthState> & {
  user: User | null | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  activeNavigator: NavigatorKey | undefined;
  error: ErrorContext | undefined;
};

/** Renderless, component-scoped alternative to the plugin (SPEC §4.3).
 *  provide()s an AuthContext to its subtree, shadowing any plugin-provided one.
 *  Props are read once during setup; later changes are ignored (parity with
 *  react-oidc-context, which fixes its UserManager on first render). */
export const AuthProvider = defineComponent({
  name: "AuthProvider",
  inheritAttrs: false,
  props: {
    settings: {
      type: Object as PropType<UserManagerSettings>,
      default: undefined,
    },
    userManager: {
      type: Object as PropType<UserManager>,
      default: undefined,
    },
    onSigninCallback: {
      type: Function as PropType<AuthCallbacks["onSigninCallback"]>,
      default: undefined,
    },
    skipSigninCallback: { type: Boolean, default: false },
    matchSignoutCallback: {
      type: Function as PropType<AuthCallbacks["matchSignoutCallback"]>,
      default: undefined,
    },
    onSignoutCallback: {
      type: Function as PropType<AuthCallbacks["onSignoutCallback"]>,
      default: undefined,
    },
    onRemoveUser: {
      type: Function as PropType<AuthCallbacks["onRemoveUser"]>,
      default: undefined,
    },
  },
  slots: Object as SlotsType<{ default?: AuthProviderSlotProps }>,
  setup(props, { slots }) {
    if ((props.settings === undefined) === (props.userManager === undefined)) {
      throw new Error(
        "[@dlukt/vue-oidc-context] <AuthProvider> requires exactly one of the `settings` and `userManager` props.",
      );
    }

    const callbacks: AuthCallbacks = {
      onSigninCallback: props.onSigninCallback,
      skipSigninCallback: props.skipSigninCallback,
      matchSignoutCallback: props.matchSignoutCallback,
      onSignoutCallback: props.onSignoutCallback,
      onRemoveUser: props.onRemoveUser,
    };
    // The XOR check above guarantees the shape of the options union at runtime.
    const options = (
      props.userManager
        ? { ...callbacks, userManager: props.userManager }
        : { ...props.settings, ...callbacks }
    ) as OidcAuthOptions;

    const { context, dispose } = createAuthContext(options);
    provide(AUTH_CONTEXT_KEY, context);
    onScopeDispose(dispose);

    return (): VNodeChild =>
      slots.default?.({
        ...context,
        user: context.user.value,
        isLoading: context.isLoading.value,
        isAuthenticated: context.isAuthenticated.value,
        activeNavigator: context.activeNavigator.value,
        error: context.error.value,
      });
  },
});
