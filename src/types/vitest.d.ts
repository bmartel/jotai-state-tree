declare module "vitest" {
  import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "bun:test";
  export { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll };

  export const vi: any;
}
