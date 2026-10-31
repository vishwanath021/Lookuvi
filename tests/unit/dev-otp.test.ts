import { afterEach, describe, expect, it } from "vitest";
import { exposeDevOtp } from "@/lib/otp";

const keys = ["ALLOW_DEV_OTP", "NODE_ENV"] as const;

describe("exposeDevOtp", () => {
  const previous: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key]!;
      delete previous[key];
    }
  });

  function setEnv(values: Partial<Record<(typeof keys)[number], string>>) {
    for (const key of keys) {
      if (!(key in previous)) previous[key] = process.env[key];
    }
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  it("is off by default", () => {
    setEnv({ ALLOW_DEV_OTP: "", NODE_ENV: "development" });
    delete process.env.ALLOW_DEV_OTP;
    expect(exposeDevOtp()).toBe(false);
  });

  it("is on only when the flag is true outside production", () => {
    setEnv({ ALLOW_DEV_OTP: "true", NODE_ENV: "development" });
    expect(exposeDevOtp()).toBe(true);
  });

  it("stays off in production even if the flag is mistakenly true", () => {
    setEnv({ ALLOW_DEV_OTP: "true", NODE_ENV: "production" });
    expect(exposeDevOtp()).toBe(false);
  });
});
