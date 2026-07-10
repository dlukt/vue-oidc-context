<script setup lang="ts">
import { useAuth } from "@dlukt/vue-oidc-context";

const { user, isLoading, isAuthenticated, activeNavigator, error } = useAuth();
</script>

<template>
  <header>
    <nav>
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/protected">Protected route</RouterLink>
      <RouterLink to="/required">&lt;AuthenticationRequired&gt;</RouterLink>
      <RouterLink to="/foreign">Foreign callback</RouterLink>
    </nav>
    <p class="status">
      <span>
        user:
        <code>{{
          user === undefined
            ? "undefined (not settled)"
            : user === null
              ? "null (no session)"
              : "User"
        }}</code>
      </span>
      <span>
        isLoading: <code>{{ isLoading }}</code>
      </span>
      <span>
        isAuthenticated: <code>{{ isAuthenticated }}</code>
      </span>
      <span>
        activeNavigator: <code>{{ activeNavigator ?? "–" }}</code>
      </span>
    </p>
    <p v-if="error" class="error-banner">
      <strong>{{ error.source }}</strong> — {{ error.message }}
      <span class="hint">(clears on the next successful user load)</span>
    </p>
  </header>
  <main>
    <RouterView />
  </main>
</template>
