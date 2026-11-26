import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@/lib/ratelimit";

const requireOwner = vi.hoisted(() => vi.fn());
const createSalonPlanCheckout = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({ requireOwner }));
vi.mock("@/lib/payments/checkout", () => ({ createSalonPlanCheckout }));

describe("plan-billing checkout route", () => {
  beforeEach(() => {
    resetRateLimits();
    process.env.RAZORPAY_KEY_ID = "rzp_test";
    process.env.RAZORPAY_KEY_SECRET = "sec_test";
    requireOwner.mockResolvedValue({
      tenant: { id: "pay-tenant-1" },
      session: { user: { id: "owner-1" } },
    });
    createSalonPlanCheckout.mockResolvedValue({
      paymentId: "pid",
      orderId: "oid",
      amountPaise: 79900,
      currency: "INR",
      receiptNumber: "LKV-2026-000001",
    });
  });

  afterEach(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    vi.clearAllMocks();
  });

  it("returns 503 when Razorpay env is missing", async () => {
    delete process.env.RAZORPAY_KEY_ID;
    const { POST } = await import("@/app/api/v1/admin/plan-billing/checkout/route");
    const res = await POST(
      new Request("http://localhost/api/v1/admin/plan-billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ salonPlanId: "plan-1" }),
      }),
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("PAYMENTS_UNAVAILABLE");
    expect(createSalonPlanCheckout).not.toHaveBeenCalled();
  });

  it("rate limits repeated checkout posts", async () => {
    const { POST } = await import("@/app/api/v1/admin/plan-billing/checkout/route");
    const headers = { "content-type": "application/json", "x-forwarded-for": "203.0.113.44" };
    const make = () =>
      POST(
        new Request("http://localhost/api/v1/admin/plan-billing/checkout", {
          method: "POST",
          headers,
          body: JSON.stringify({ salonPlanId: "plan-1" }),
        }),
      );
    for (let i = 0; i < 8; i++) {
      const res = await make();
      expect(res.status).toBe(200);
    }
    const limited = await make();
    expect(limited.status).toBe(429);
    expect((await limited.json()) as { error: string }).toMatchObject({ error: "RATE" });
  });
});