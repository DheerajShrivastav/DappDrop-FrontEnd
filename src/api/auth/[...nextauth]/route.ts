import NextAuth from 'next-auth'
import DiscordProvider from 'next-auth/providers/discord'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'

const handler = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      // Add Discord ID to session for membership verification
      const account = await prisma.account.findFirst({
        where: { userId: user.id, provider: 'discord' },
      })
      if (account && session.user) {
        // discordId is defined in src/types/next-auth.d.ts
        session.user.discordId = account.providerAccountId
      }
      return session
    },
  },
})

export { handler as GET, handler as POST }
