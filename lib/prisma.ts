import { PrismaClient } from "@prisma/client";
import { validateServerEnvironment } from "@/lib/env";

if (process.env.NODE_ENV === "production") validateServerEnvironment();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
