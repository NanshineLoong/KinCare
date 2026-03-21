import { describe, expect, it } from "vitest";

import { sessionStorageKey } from "./auth/session";
import { appPreferencesStorageKey } from "./preferences";

describe("branding identifiers", () => {
  it("uses kincare session storage", () => {
    expect(sessionStorageKey).toBe("kincare.session");
  });

  it("uses kincare preferences storage", () => {
    expect(appPreferencesStorageKey).toBe("kincare.preferences");
  });
});
