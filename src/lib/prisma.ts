// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

// This setup prevents creating too many PrismaClient instances in development
// due to Next.js hot-reloading. In production, a single instance is created.
const prismaClientSingleton = () => {
  return new PrismaClient()
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
