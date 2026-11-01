import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function deletedStamp(row: unknown): Date | null | undefined {
  if (!row || typeof row !== "object" || !("deletedAt" in row)) return undefined;
  return (row as { deletedAt: Date | null }).deletedAt;
}

/** Guest and owner lookups use findUnique. A soft-deleted salon is returned as missing. Lists opt in with their own filter so audit history can still name the row. */
async function hideDeleted<T>(base: PrismaClient, row: T, where?: { id?: string; slug?: string }): Promise<T | null> {
  if (!row) return row;
  const marked = deletedStamp(row);
  if (marked instanceof Date) return null;
  if (marked === null) return row;
  const rowId = typeof row === "object" && row && "id" in row && typeof (row as { id: unknown }).id === "string" ? (row as { id: string }).id : "";
  const id = rowId || where?.id || "";
  const slug = where?.slug || "";
  if (!id && !slug) return row;
  const marker = await base.tenant.findUnique({
    where: id ? { id } : { slug },
    select: { deletedAt: true },
  });
  return marker?.deletedAt ? null : row;
}

function uniqueWhere(where: Prisma.TenantWhereUniqueInput | undefined) {
  if (!where) return undefined;
  if ("id" in where && typeof where.id === "string") return { id: where.id };
  if ("slug" in where && typeof where.slug === "string") return { slug: where.slug };
  return undefined;
}

function makePrisma() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  return base.$extends({
    query: {
      tenant: {
        async findUnique({ args, query }) {
          return hideDeleted(base, await query(args), uniqueWhere(args.where));
        },
        async findFirst({ args, query }) {
          return hideDeleted(base, await query(args));
        },
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? makePrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
