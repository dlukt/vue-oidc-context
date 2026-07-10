/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** OIDC issuer. Default: https://demo.duendesoftware.com */
  readonly VITE_OIDC_AUTHORITY?: string;
  /** Client id at the issuer. Default: interactive.public */
  readonly VITE_OIDC_CLIENT_ID?: string;
  /** Requested scopes. Default: "openid profile email offline_access" */
  readonly VITE_OIDC_SCOPE?: string;
  /** "1" enables oidc-client-ts session monitoring (addUserSignedOut demo). */
  readonly VITE_OIDC_MONITOR_SESSION?: string;
}
