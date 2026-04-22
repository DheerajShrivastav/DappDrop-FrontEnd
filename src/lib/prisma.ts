import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

function buildDatabaseUrl(): string | undefined {
    const url = process.env.DATABASE_URL
    if (!url) return undefined

    const separator = url.includes('?') ? '&' : '?'
    // Neon pooler uses PgBouncer — Prisma needs pgbouncer=true for compatibility.
    // connect_timeout gives more headroom for cold-start connections.
    // pool_timeout controls how long Prisma waits for a free connection.
    return `${url}${separator}pgbouncer=true&connect_timeout=30&pool_timeout=30&connection_limit=5`
}

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        datasources: {
            db: {
                url: buildDatabaseUrl(),
            },
        },
    })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

