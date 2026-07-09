import { describe, expect, it } from "vitest";

import * as lib from "../src/index";
import * as router from "../src/router";

// Placeholder suite keeping the M0 pipeline green; replaced by real suites in M1+.
describe("scaffold", () => {
  it("main entry is importable", () => {
    expect(lib.SCAFFOLD_PLACEHOLDER).toBe(true);
  });

  it("router entry is importable", () => {
    expect(router.ROUTER_SCAFFOLD_PLACEHOLDER).toBe(true);
  });
});
