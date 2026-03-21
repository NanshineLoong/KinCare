import { describe, expect, it } from "vitest";

import { resolveApiBaseUrl } from "./client";


describe("resolveApiBaseUrl", () => {
  it("defaults to the current page origin when no VITE_API_BASE_URL is provided", () => {
    expect(resolveApiBaseUrl(undefined, "http://localhost:8080")).toBe("http://localhost:8080");
  });

  it("preserves an explicit env override", () => {
    expect(resolveApiBaseUrl("http://localhost:8000")).toBe("http://localhost:8000");
  });
});
