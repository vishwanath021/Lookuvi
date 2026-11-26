import { prisma } from "@/lib/prisma";

export async function expireStalePayments(now = new Date()) {
  const result = await prisma.payment.updateMany({
    where: {
      status: { in: ["created", "authorized"] },
      expiresAt: { lt: now },
    },
    data: { status: "expired" },
  });
  return result.count;
}