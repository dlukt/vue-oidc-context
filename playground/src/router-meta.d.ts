import "vue-router";

// The RouteMeta augmentation recommended in SPEC §4.5 (documented, not shipped).
declare module "vue-router" {
  interface RouteMeta {
    requiresAuth?: boolean;
  }
}
