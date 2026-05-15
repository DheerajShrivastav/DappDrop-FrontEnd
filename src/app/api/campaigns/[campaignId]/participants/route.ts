import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignParticipantAddresses } from '@/lib/web3-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    // Await params to support Next.js 15+ dynamic route requirements gracefully
    const resolvedParams = await params;
    const campaignId = parseInt(resolvedParams.campaignId, 10);
    
    if (isNaN(campaignId)) {
      return NextResponse.json({ error: 'Invalid campaign ID' }, { status: 400 });
    }

    // 1. Get raw array of wallet addresses from the blockchain
    const participantAddresses = await getCampaignParticipantAddresses(resolvedParams.campaignId);

    if (!participantAddresses || participantAddresses.length === 0) {
      return NextResponse.json([]);
    }

    // Normalize addresses for predictable matching
    const normalizedAddresses = participantAddresses.map((addr: string) => addr.toLowerCase());

    // 2. Fetch User models for Humanity Verification status
    const users = await prisma.user.findMany({
      where: {
        walletAddress: { in: normalizedAddresses }
      },
      select: {
        walletAddress: true,
        humanityVerified: true,
      }
    });

    const userHumanityMap = new Map();
    for (const u of users) {
      userHumanityMap.set(u.walletAddress.toLowerCase(), u.humanityVerified);
    }

    // 3. Fetch Social Verifications
    // NOTE: Based on your schema, SocialVerification uses `taskId`. We use `has` or `startsWith`
    // to match related tasks for this campaign. We'll simply query all verifications for these users
    // and filter them. If your schema actually has `campaignId` on SocialVerification, you can add:
    // campaignId: campaignId
    const socialVerifications = await prisma.socialVerification.findMany({
      where: {
        userAddress: { in: normalizedAddresses },
      }
    });

    // 4. Group and merge data
    const mergedData = participantAddresses.map((address: string) => {
      const lowerAddress = address.toLowerCase();
      
      const isHumanityVerified = userHumanityMap.get(lowerAddress) || false;

      // Filter social verifications for this user and this campaign (assuming taskId starts with campaignId)
      // Modify the filter below if your taskId format differs or if you have a direct campaignId column!
      const userSocials = socialVerifications.filter(
        (sv) => sv.userAddress.toLowerCase() === lowerAddress && sv.taskId.startsWith(`${campaignId}`)
      );

      let discordUsername = null;
      let telegramUsername = null;

      userSocials.forEach((social) => {
        const proof = (social.proofData as any) || {};
        if (social.platform?.toUpperCase() === 'DISCORD') {
          discordUsername = proof?.username || proof?.discordUsername || null;
        } else if (social.platform?.toUpperCase() === 'TELEGRAM') {
          telegramUsername = proof?.username || proof?.telegramUsername || null;
        }
      });

      return {
        walletAddress: address,
        discordUsername,
        telegramUsername,
        humanityVerified: isHumanityVerified,
      };
    });

    return NextResponse.json(mergedData);
  } catch (error) {
    console.error('Error fetching participants:', error);
    return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
  }
}
