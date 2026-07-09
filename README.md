# vue-oidc-context

[![CI](https://github.com/dlukt/vue-oidc-context/actions/workflows/ci.yml/badge.svg)](https://github.com/dlukt/vue-oidc-context/actions/workflows/ci.yml)

OpenID Connect (OIDC) & OAuth 2.0 authentication for Vue 3 — a lightweight, fully typed wrapper around [oidc-client-ts](https://github.com/authts/oidc-client-ts), ported from [react-oidc-context](https://github.com/authts/react-oidc-context).

> **Status: under construction.** Nothing is published yet. The API contract lives in [docs/SPEC.md](docs/SPEC.md); the implementation roadmap in [docs/PLAN.md](docs/PLAN.md).

Published as **`@dlukt/vue-oidc-context`** — the unscoped npm name `vue-oidc-context` belongs to an unrelated package.

## Planned API at a glance

```ts
// main.ts
import { createOidcAuth } from "@dlukt/vue-oidc-context";

app.use(
  createOidcAuth({
    authority: "https://idp.example.com",
    client_id: "spa",
    redirect_uri: `${window.location.origin}/`,
  }),
);
```

```vue
<script setup lang="ts">
import { useAuth } from "@dlukt/vue-oidc-context";

const { user, isAuthenticated, signinRedirect, signoutRedirect } = useAuth();
</script>
```

See [docs/SPEC.md](docs/SPEC.md) for the full surface (plugin, `<AuthProvider>`, `useAutoSignin`, vue-router guard, `<AuthenticationRequired>`).

## License

[MIT](LICENSE)
