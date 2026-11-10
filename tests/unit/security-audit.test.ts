import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { chmod, mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { CREDIT_PACKS } from "@/data/plans";
import { addCreditPack } from "@/lib/billing/apply";
import { contentSecurityPolicy } from "@/lib/csp";
import { possessesWithdrawSession } from "@/lib/data-request";
import { customerActionNeedsOwner, queueActionNeedsOwner } from "@/lib/desk-role";
import { prisma } from "@/lib/prisma";
import { requestClientIp } from "@/lib/ratelimit";
import { deleteObject, getObject, putObject } from "@/lib/storage";

describe("embed content security policy", () => {
  it("keeps the nonce script policy and only relaxes frame-ancestors", () => {
    const policy = contentSecurityPolicy("abc", { dev: false, embed: true });
    expect(policy).toContain("nonce-abc");
    expect(policy).toContain("'strict-dynamic'");
    expect(policy).toContain("'wasm-unsafe-eval'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).toContain("frame-ancestors *");
    expect(policy).not.toContain("frame-ancestors 'self'");
    expect(policy).toContain("object-src 'none'");
  });
});

describe("client ip", () => {
  const headers = {
    get(name: string) {
      if (name === "cf-connecting-ip") return "203.0.113.50";
      if (name === "x-forwarded-for") return "198.51.100.10, 127.0.0.1";
      return null;
    },
  };

  it("ignores cf-connecting-ip unless TRUST_CF_HEADER is true", () => {
    expect(requestClientIp({ headers }, { TRUST_PROXY: "true" })).toBe("198.51.100.10");
    expect(requestClientIp({ headers }, { TRUST_PROXY: "true", TRUST_CF_HEADER: "true" })).toBe("203.0.113.50");
    expect(requestClientIp({ headers }, { TRUST_PROXY: "false", TRUST_CF_HEADER: "true" })).toBe("direct");
  });

  it("uses x-real-ip when the forwarded chain is absent", () => {
    const real = { get: (name: string) => (name === "x-real-ip" ? "198.51.100.8" : null) };
    expect(requestClientIp({ headers: real }, { TRUST_PROXY: "true" })).toBe("198.51.100.8");
  });
});

describe("private object modes", () => {
  it("writes files as 0640 and directories as 0750", async () => {
    const key = "generations/audit-mode/req/result.jpg";
    await putObject(key, Buffer.from("jpeg"), "image/jpeg");
    const file = path.join(process.cwd(), "var", "objects", key);
    const fileMode = (await stat(file)).mode & 0o777;
    const dirMode = (await stat(path.dirname(file))).mode & 0o777;
    expect(fileMode).toBe(0o640);
    expect(dirMode).toBe(0o750);
    expect((await getObject(key))?.toString()).toBe("jpeg");
    await deleteObject(key);
  });

  it("chmods an existing tree", async () => {
    const root = path.join(process.cwd(), "var", "objects-chmod-test");
    await rm(root, { recursive: true, force: true });
    await mkdir(path.join(root, "nested"), { recursive: true });
    await writeFile(path.join(root, "nested", "a.jpg"), "x");
    await chmod(root, 0o755);
    await chmod(path.join(root, "nested"), 0o755);
    await chmod(path.join(root, "nested", "a.jpg"), 0o644);
    execFileSync("sh", ["scripts/chmod-objects.sh", root], { encoding: "utf8" });
    expect((await stat(root)).mode & 0o777).toBe(0o750);
    expect((await stat(path.join(root, "nested"))).mode & 0o777).toBe(0o750);
    expect((await stat(path.join(root, "nested", "a.jpg"))).mode & 0o777).toBe(0o640);
    await rm(root, { recursive: true, force: true });
  });
});

describe("backup scripts", () => {
  it("dumps to /opt/lookuvi/backups with --env-file and a 14 day keep", () => {
    const backup = readFileSync("scripts/backup-postgres.sh", "utf8");
    const cron = readFileSync("deploy/backup.cron", "utf8");
    const verify = readFileSync("scripts/verify-pg-restore.sh", "utf8");
    expect(backup).toContain("--env-file");
    expect(backup).toContain("/opt/lookuvi/backups");
    expect(backup).toContain('KEEP_DAYS:-14');
    expect(backup).not.toMatch(/^set -a/m);
    expect(backup).not.toMatch(/^\s*(?:\.|source)\s+\.env\.production/m);
    expect(cron).toContain("./scripts/backup-postgres.sh");
    expect(verify).toContain("--env-file");
    expect(verify).toContain("lookuvi_restore");
    execFileSync("sh", ["-n", "scripts/backup-postgres.sh"]);
    execFileSync("sh", ["-n", "scripts/restore-postgres.sh"]);
    execFileSync("sh", ["-n", "scripts/verify-pg-restore.sh"]);
    execFileSync("sh", ["-n", "scripts/chmod-objects.sh"]);
  });

  it("ignores .env.production and keeps the example files tracked", () => {
    const ignored = (file: string) => {
      try {
        execFileSync("git", ["check-ignore", "-q", file]);
        return true;
      } catch {
        return false;
      }
    };
    expect(ignored(".env.production")).toBe(true);
    expect(ignored(".env.local")).toBe(true);
    expect(ignored(".env.example")).toBe(false);
    expect(ignored(".env.production.example")).toBe(false);
  });
});

describe("desk roles", () => {
  it("lets staff view points and finish a visit, and keeps adjust and redeem for the owner", () => {
    expect(customerActionNeedsOwner("adjust")).toBe(true);
    expect(customerActionNeedsOwner("add")).toBe(false);
    expect(queueActionNeedsOwner("redeem")).toBe(true);
    expect(queueActionNeedsOwner("done")).toBe(false);
    expect(existsSync("src/app/api/v1/admin/salon-token/route.ts")).toBe(false);
    expect(existsSync("src/components/admin/SalonModeCard.tsx")).toBe(false);
    const customers = readFileSync("src/app/api/v1/admin/customers/route.ts", "utf8");
    expect(customers).toContain("customerActionNeedsOwner");
    const queue = readFileSync("src/app/api/v1/admin/queue/route.ts", "utf8");
    expect(queue).toContain("queueActionNeedsOwner");
    expect(queue).toContain("finishEntry");
  });
});

describe("credit pack grants", () => {
  const slug = `pack-${Date.now()}`;

  afterAll(async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (tenant) {
      await prisma.creditPackGrant.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.invoice.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.creditLedger.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
    await prisma.$disconnect();
  });

  it("grants a pack once for the same provider payment id", async () => {
    const tenant = await prisma.tenant.create({
      data: { slug, name: "Pack salon", plan: "LITE", status: "TRIAL", creditBalance: 3 },
    });
    const pack = CREDIT_PACKS[0];
    const first = await addCreditPack(tenant.id, pack.id, "razorpay", "pay_evt_1");
    const second = await addCreditPack(tenant.id, pack.id, "razorpay", "pay_evt_1");
    expect(first.alreadyApplied).toBe(false);
    expect(second.alreadyApplied).toBe(true);
    expect(second.invoiceNumber).toBe(first.invoiceNumber);
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } })).creditBalance).toBe(3 + pack.credits);
    expect(await prisma.creditLedger.count({ where: { tenantId: tenant.id, reason: "PACK" } })).toBe(1);
    expect(await prisma.creditPackGrant.count({ where: { externalId: "pay_evt_1" } })).toBe(1);
  });
});

describe("withdraw possession", () => {
  const slug = `withdraw-${Date.now()}`;

  afterAll(async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return;
    await prisma.queueSession.deleteMany({ where: { entry: { tenantId: tenant.id } } });
    await prisma.queueEntry.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.lead.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.consentLog.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.customer.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  });

  it("deletes leads only for the guest cookie or the matching queue ref", async () => {
    const tenant = await prisma.tenant.create({ data: { slug, name: "Withdraw salon" } });
    const customer = await prisma.customer.create({ data: { tenantId: tenant.id, phone: "919811111111", name: "Guest" } });
    const other = await prisma.customer.create({ data: { tenantId: tenant.id, phone: "919822222222", name: "Other" } });
    await prisma.lead.create({
      data: { tenantId: tenant.id, sessionId: "sess-owned-1", phone: "9811111111", lookName: "Bob", name: "Guest" },
    });
    await prisma.consentLog.create({
      data: {
        tenantId: tenant.id,
        sessionId: "sess-owned-1",
        purpose: "TRYON_PREVIEW",
        textVersion: "1",
        textHash: "abc",
        lang: "en",
        accepted: true,
      },
    });
    const stranger = await possessesWithdrawSession({
      tenantId: tenant.id,
      sessionId: "sess-owned-1",
      guest: null,
      ref: null,
    });
    expect(stranger).toBe(false);
    const wrongGuest = await possessesWithdrawSession({
      tenantId: tenant.id,
      sessionId: "sess-owned-1",
      guest: { customerId: other.id, tenantId: tenant.id },
    });
    expect(wrongGuest).toBe(false);
    const owner = await possessesWithdrawSession({
      tenantId: tenant.id,
      sessionId: "sess-owned-1",
      guest: { customerId: customer.id, tenantId: tenant.id },
    });
    expect(owner).toBe(true);

    const entry = await prisma.queueEntry.create({
      data: {
        tenantId: tenant.id,
        dayKey: "2026-11-07",
        token: 1,
        status: "WAITING",
        source: "qr",
        cancelToken: "queue-ref-owned-0001",
        sessionId: "sess-queue-1",
        phone: "919833333333",
      },
    });
    await prisma.lead.create({
      data: { tenantId: tenant.id, sessionId: "sess-queue-1", phone: "9833333333", lookName: "Crop", name: "Walk" },
    });
    expect(await possessesWithdrawSession({
      tenantId: tenant.id,
      sessionId: "sess-queue-1",
      guest: null,
      ref: "wrong-ref-value",
    })).toBe(false);
    expect(await possessesWithdrawSession({
      tenantId: tenant.id,
      sessionId: "sess-queue-1",
      guest: null,
      ref: entry.cancelToken,
    })).toBe(true);
    await prisma.queueSession.create({ data: { entryId: entry.id, sessionId: "sess-linked-1" } });
    expect(await possessesWithdrawSession({
      tenantId: tenant.id,
      sessionId: "sess-linked-1",
      guest: null,
      ref: entry.cancelToken,
    })).toBe(true);
  });
});
