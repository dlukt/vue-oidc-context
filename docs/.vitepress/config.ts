import { defineConfig } from "vitepress";

export default defineConfig({
  title: "vue-oidc-context",
  description:
    "OpenID Connect (OIDC) & OAuth 2.0 authentication for Vue 3 — a lightweight, fully typed wrapper around oidc-client-ts, ported from react-oidc-context.",
  // Served from GitHub Pages at https://dlukt.github.io/vue-oidc-context/
  base: "/vue-oidc-context/",
  cleanUrls: true,
  lastUpdated: true,
  markdown: {
    anchor: {
      // GitHub-style slugs (no "_" prefix on numbered headings like "1. Overview"),
      // so SPEC.md's and PLAN.md's contents anchors work here and on GitHub alike.
      slugify: (s: string) =>
        s
          .trim()
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s-]/gu, "")
          .replace(/\s+/g, "-"),
    },
  },
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API", link: "/api/" },
      { text: "Spec", link: "/SPEC" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "Protecting routes", link: "/guide/protecting-routes" },
          { text: "Callbacks & URL cleanup", link: "/guide/callbacks" },
          { text: "Multi-tenant & AuthProvider", link: "/guide/multi-tenant" },
          { text: "SSR & Nuxt", link: "/guide/ssr" },
          {
            text: "Migration from react-oidc-context",
            link: "/guide/migration",
          },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "API", link: "/api/" },
          { text: "Specification (SPEC)", link: "/SPEC" },
          { text: "Roadmap (PLAN)", link: "/PLAN" },
        ],
      },
    ],
    outline: { level: [2, 3] },
    socialLinks: [
      { icon: "github", link: "https://github.com/dlukt/vue-oidc-context" },
      {
        icon: "npm",
        link: "https://www.npmjs.com/package/@dlukt/vue-oidc-context",
      },
    ],
    search: { provider: "local" },
    editLink: {
      pattern: "https://github.com/dlukt/vue-oidc-context/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © Darko Luketic",
    },
  },
});
