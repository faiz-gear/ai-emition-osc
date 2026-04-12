import { describe, expect, test } from "vitest";
import {
  DESKTOP_RUNTIME_MODE_ENV,
  PROVIDER_SECRET_KEY_ENV,
  resolveProviderSecretKey,
  resolveDesktopRuntimeMode
} from "../../../main/runtime/create-desktop-ipc-services";

describe("desktop runtime mode", () => {
  test("prefers an explicit runtime mode override", () => {
    expect(
      resolveDesktopRuntimeMode({
        NODE_ENV: "development",
        [DESKTOP_RUNTIME_MODE_ENV]: "in-memory"
      })
    ).toBe("in-memory");
    expect(
      resolveDesktopRuntimeMode({
        NODE_ENV: "test",
        [DESKTOP_RUNTIME_MODE_ENV]: "desktop"
      })
    ).toBe("desktop");
  });

  test("defaults tests to the in-memory runtime", () => {
    expect(
      resolveDesktopRuntimeMode({
        NODE_ENV: "test"
      })
    ).toBe("in-memory");
  });

  test("defaults non-test environments to the desktop runtime", () => {
    expect(
      resolveDesktopRuntimeMode({
        NODE_ENV: "development"
      })
    ).toBe("desktop");
    expect(
      resolveDesktopRuntimeMode({
        NODE_ENV: "production"
      })
    ).toBe("desktop");
  });

  test("requires an explicit provider secret key for desktop runtime", () => {
    expect(
      resolveProviderSecretKey({
        [PROVIDER_SECRET_KEY_ENV]: " test-provider-secret "
      })
    ).toBe("test-provider-secret");

    expect(() => resolveProviderSecretKey({})).toThrow(
      `${PROVIDER_SECRET_KEY_ENV} is required for desktop runtime mode`
    );
  });
});
