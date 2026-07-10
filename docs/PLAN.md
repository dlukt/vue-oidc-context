# vue-oidc-context — Implementation Plan

Roadmap for building the library specified in [SPEC.md](./SPEC.md). The spec is the contract; when this plan and the spec disagree, the spec wins (or the spec gets amended first).

**Contents**

1. [Working principles](#1-working-principles)
2. [Repository layout](#2-repository-layout)
3. [Toolchain](#3-toolchain)
4. [Package configuration](#4-package-configuration)
5. [Milestones](#5-milestones)
6. [Testing strategy](#6-testing-strategy)
7. [Playground and manual verification](#7-playground-and-manual-verification)
8. [CI/CD](#8-cicd)
9. [Release and versioning](#9-release-and-versioning)
10. [Risks](#10-risks)

## 1. Working principles

- **Parity before invention.** When in doubt about behavior, read the react-oidc-context source and mirror it; deviations get a "parity note" in the spec.
- **Spec-driven.** Public API changes land in SPEC.md before they land in `src/`.
- **One core.** The plugin, the `<AuthProvider>` component, and non-app usage all consume the same `createAuthContext()` core — no duplicated state machinery.
- **No SFCs in the library.** Components are `defineComponent` + render functions in plain TypeScript, so the build needs no Vue SFC compiler and consumers need no special tooling.

## 2. Repository layout

```
vue-oidc-context/
├── src/
│   ├── index.ts                  # public entry: re-exports everything in SPEC §4.9
│   ├── types.ts                  # AuthState, AuthContext, AuthCallbacks, OidcAuthOptions,
│   │                             #   NavigatorKey, ErrorContext, ErrorSource
│   ├── context.ts                # createAuthContext(): reactive state, init sequence (§5.1),
│   │                             #   event wiring (§5.2), navigator wrapping (§5.4), teardown
│   ├── plugin.ts                 # createOidcAuth(): OidcAuth object, install(), initialized
│   ├── injection.ts              # AUTH_CONTEXT_KEY, useAuth() with the §7 error message
│   ├── useAutoSignin.ts          # useAutoSignin()
│   ├── AuthProvider.ts           # <AuthProvider> renderless component (slot props = context)
│   ├── AuthenticationRequired.ts # <AuthenticationRequired> component
│   ├── router.ts                 # subpath entry: createAuthGuard(), AuthGuardOptions
│   └── utils.ts                  # hasAuthParams(), error normalization, isBrowser
├── test/                         # Vitest suites, mirrors src/ file names
│   ├── mocks/oidc-client-ts.ts   # shared UserManager mock
│   ├── types.test-d.ts           # expectTypeOf type tests (Vitest typecheck mode)
│   └── fixtures/
│       └── core-no-vue-router/   # M4 compile fixture: dist core types without vue-router
├── playground/                   # private Vite app (workspace member), manual E2E
├── docs/                         # VitePress site; SPEC.md and PLAN.md live here
│   └── .vitepress/
├── .github/workflows/            # ci.yml, release.yml, docs.yml
├── .changeset/
├── package.json                  # the library (workspace root is the publishable package)
├── pnpm-workspace.yaml           # members: ["playground"]
├── tsconfig.json  tsdown.config.ts  vitest.config.ts  eslint.config.js
├── LICENSE                       # MIT
└── README.md
```

## 3. Toolchain

| Concern         | Choice                                            | Notes                                                                                             |
| --------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Package manager | pnpm (workspace)                                  | root = publishable lib, `playground/` private member                                              |
| Language        | TypeScript, `strict: true`                        | target ES2022, `moduleResolution: bundler`, `isolatedDeclarations` if practical                   |
| Build           | **tsdown**                                        | two entries (`src/index.ts`, `src/router.ts`), ESM + CJS + `.d.ts`/`.d.cts`, treeshake, no minify |
| Tests           | Vitest + happy-dom + @vue/test-utils              | plus `expectTypeOf` type tests                                                                    |
| Lint/format     | ESLint flat config (typescript-eslint) + Prettier | no eslint-plugin-vue needed (no SFCs in `src/`)                                                   |
| Docs            | VitePress                                         | deployed to GitHub Pages                                                                          |
| Releases        | Changesets                                        | manual `changeset` per PR, bot-driven version PRs                                                 |
| Node (dev/CI)   | ≥ 22.13 (pnpm 11 floor)                           | library itself is browser-targeted; published `engines` floor stays `>=20`                        |

Exact dependency versions are resolved at scaffold time (latest stable); the ranges that matter contractually are the peer ranges in SPEC §3.

## 4. Package configuration

```jsonc
{
  "name": "@dlukt/vue-oidc-context",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
    },
    "./router": {
      "types": "./dist/router.d.ts",
      "import": "./dist/router.js",
      "require": "./dist/router.cjs",
    },
  },
  "files": ["dist"],
  "peerDependencies": {
    "vue": "^3.5.0",
    "oidc-client-ts": "^3.3.0",
    "vue-router": "^4.2.0 || ^5.0.0",
  },
  "peerDependenciesMeta": {
    "vue-router": { "optional": true },
  },
}
```

Key points:

- `vue-router` types are referenced **only** from `dist/router.d.ts`, so core consumers without vue-router get no TS resolution errors.
- `publishConfig.access: "public"` (scoped package), `repository`, `keywords` (`vue`, `vue3`, `oidc`, `openid-connect`, `oauth2`, `authentication`, `oidc-client-ts`), `license: "MIT"`.

## 5. Milestones

Each milestone ends green: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

### M0 — Scaffold

- pnpm workspace, `package.json` per §4, tsconfig, tsdown config, Vitest config, ESLint + Prettier, `.gitignore`, `.editorconfig`.
- `LICENSE` (MIT), README stub (badges, one-paragraph pitch, "under construction").
- CI workflow running the full check suite on a placeholder `src/index.ts`.
- **Done when:** CI is green on main with a publishable (empty) build.

### M1 — Core

- `types.ts`, `utils.ts` (`hasAuthParams`, error normalization per SPEC §7, `isBrowser`).
- `context.ts`: reactive state (`shallowRef` user, refs, computed `isAuthenticated` with signed-out flag), init sequence (SPEC §5.1), the four event subscriptions (§5.2), navigator wrapping (§5.4), teardown hooks (§5.5), SSR-inert mode (§6).
- `plugin.ts` (`createOidcAuth`, `initialized`, double-install guard) and `injection.ts` (`useAuth`).
- **Done when:** the SPEC §4.1/§4.2 examples work against a mocked UserManager in tests.

### M2 — Composables and provider component

- `useAutoSignin.ts` (single-attempt watcher semantics, SPEC §4.4).
- `AuthProvider.ts` (renderless, slot props, scope-tied teardown, settings/userManager XOR validation).
- **Done when:** nested-provider test passes (inner provider shadows outer; both update independently).

### M3 — Route/subtree protection

- `router.ts`: `createAuthGuard` (SPEC §4.5) as second build entry.
- `AuthenticationRequired.ts` (SPEC §4.6).
- **Done when:** guard tests cover unprotected pass-through, waiting on `initialized`, authenticated pass, unauthenticated redirect + cancelled navigation, custom `shouldProtect`/`signinArgs` — executed against vue-router 5 (dev dep) and vue-router 4 (swap-install step in CI).

### M4 — Test completion and hardening

- Fill coverage gaps across init/error/event paths (target: every SPEC §5 transition has a test).
- Type tests: options union (settings XOR userManager), readonly refs, subpath types without vue-router installed (compile fixture).
- **Done when:** coverage report is clean on `src/` (no untested branch in `context.ts`) and type fixtures compile.

### M5 — Playground

- `playground/`: Vite + Vue app using `"@dlukt/vue-oidc-context": "workspace:*"`.
- Wired to the public Duende demo IdP (`authority: https://demo.duendesoftware.com`, `client_id: interactive.public`); fallback recipe: local Keycloak via `docker compose` for offline work.
- Exercises: redirect signin + URL cleanup, `user.profile` display, silent renew, `signoutRedirect`, guarded route (`meta.requiresAuth`) with returnTo restore, `<AuthenticationRequired>` page, error display.
- **Done when:** every flow above verified manually in a browser; findings folded back into spec/tests.

### M6 — Docs and release

- VitePress site: Home, Guide (Getting started, Protecting routes, Callbacks & URL cleanup, Multi-tenant/`<AuthProvider>`, SSR/Nuxt, Migration from react-oidc-context), API reference (from SPEC), links to SPEC/PLAN.
- README: full quickstart (install → plugin → useAuth → guard).
- Changesets + release workflow + npm provenance; docs deploy workflow.
- **Done when:** `v0.1.0` is on npm with provenance and the docs site is live on GitHub Pages.

## 6. Testing strategy

- **Unit-test the core against a mocked `oidc-client-ts`** (same approach as react-oidc-context's suite): `vi.mock("oidc-client-ts")` with a `UserManager` mock exposing `settings`, controllable `getUser`/`signinCallback`/navigator methods, and an events stub that captures handlers so tests can fire `userLoaded`/`userUnloaded`/`userSignedOut`/`silentRenewError` manually.
- **Component tests** with @vue/test-utils: plugin install + `useAuth` in a child, missing-provider throw, `<AuthProvider>` nesting/slot props, `<AuthenticationRequired>` render/redirect logic.
- **URL-dependent tests** (`hasAuthParams`, init with auth params) drive happy-dom's location.
- **Guard tests** call the guard as a plain async function with fabricated `RouteLocationNormalized` objects — no real router needed.
- **Type tests** (`test/types.test-d.ts`, Vitest typecheck mode): options union (settings XOR `userManager`, negative cases via `@ts-expect-error`), read-only state refs, slot-prop unwrapping, guard signature. Root `tsc --noEmit` compiles the same file, so the vue-router@4 CI swap re-validates the guard types against the older major for free.
- **No-vue-router compile fixture** (`test/fixtures/core-no-vue-router`): compiles a consumer of the built `dist/` core declarations with `vue-router` `paths`-poisoned to an empty module and `skipLibCheck: false` — any vue-router reference reachable from `dist/index.d.ts` fails the compile. Run with `pnpm typecheck:fixtures` after `pnpm build`.
- **Coverage** on `src/` is enforced at 100% statements/branches/functions/lines via Vitest thresholds (M4).
- **What is deliberately not auto-tested:** real IdP round-trips (redirects leave the test runner) — covered by the playground (M5) instead.

## 7. Playground and manual verification

Manual E2E checklist (run before each release, documented in `playground/README.md`):

1. Cold visit → Login → IdP → redirected back, URL cleaned, profile rendered.
2. Hard refresh on a guarded route while signed in → no redirect loop, content renders after init.
3. Guarded route while signed out → IdP → lands back on the original route (returnTo).
4. Token lifetime elapses → silent renew updates `user` without navigation.
5. Logout → post-logout URI → `isAuthenticated` false.
6. `skipSigninCallback` page with foreign `?code=&state=` params → untouched.

## 8. CI/CD

- **ci.yml** (push/PR): pnpm install → lint → typecheck → test (with coverage) → build → no-vue-router type fixture (M4) → playground build against the packaged entries (M5) → pack → vue-router@4 swap-install (`pnpm add -Dw`) + typecheck + router suite re-run (M3). Node 22/24 matrix (Node 20 is EOL since 2026-04 and pnpm 11 requires ≥ 22.13).
- **release.yml** (push to main): `changesets/action` — opens/updates the version PR; on merge publishes to npm via OIDC **trusted publishing** (no npm token; needs `id-token: write`, npm ≥ 11.5.1, and the trusted-publisher config on npmjs.com pointing at `release.yml`). Provenance is automatic with trusted publishing. The package was bootstrapped once with a local `npm publish` (v0.0.0) because trusted publishers can only be configured on existing packages.
- **docs.yml** (push to main touching `docs/`): build VitePress → deploy to GitHub Pages.

## 9. Release and versioning

- Changesets; semver. `0.x` while the API settles — breaking changes allowed with minor bumps but always changelogged.
- `v0.1.0`: everything in SPEC §2 "Goals".
- `v1.0.0` criteria: API unchanged across two consecutive minor releases, playground checklist stable, at least one external consumer report.
- Peer ranges only widen within a major.

## 10. Risks

| Risk                                                             | Mitigation                                                                                                                                                  |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| oidc-client-ts v4 lands with breaking changes                    | Thin-wrapper design keeps the blast radius in `context.ts`; peer range pins to `^3.3` until evaluated                                                       |
| `vue-router` types leaking into core `.d.ts`                     | Guard lives in a separate entry; M4 includes a compile fixture _without_ vue-router installed                                                               |
| Two supported vue-router majors (`^4.2 \|\| ^5`) drift apart     | Guard fixture typecheck + runtime verified identical on 4.6.4 and 5.1.0 (2026-07-09); M3 runs the guard suite against both majors (swap-install step in CI) |
| Duende demo IdP availability/config drift                        | Keycloak docker-compose fallback in the playground                                                                                                          |
| Upstream react-oidc-context behavior changes (we claim parity)   | Migration table + parity notes reference upstream v3; re-verify against upstream before `v1.0.0`                                                            |
| Name confusion with the unrelated npm `vue-oidc-context` package | README states the scoped name prominently; npm description differentiates                                                                                   |
| TypeScript pinned to 6.0.x although 7 (native, faster) is out    | tsdown (`^5 \|\| ^6`) and typescript-eslint (`<6.1`) don't accept TS 7 yet; bump the pin as soon as both widen their peer ranges                            |
