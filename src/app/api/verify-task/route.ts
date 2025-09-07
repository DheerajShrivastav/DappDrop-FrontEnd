// src/app/api/verify-task/route.ts
import { NextResponse } from 'next/server';
import { completeTask, getCampaignById } from '@/lib/web3-service';
import { verifyDiscordJoin } from '@/lib/verification-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { campaignId, taskId, userAddress } = body;

    if (!campaignId || !taskId || !userAddress) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const campaign = await getCampaignById(campaignId);
    const taskIndex = parseInt(taskId, 10);
    const task = campaign?.tasks[taskIndex];

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    let isVerified = false;

    if (task.type === 'JOIN_DISCORD') {
      // In a real app, the server ID would be stored in the task's verificationData
      const discordServerId = "MOCK_SERVER_ID"; 
      isVerified = await verifyDiscordJoin(userAddress, discordServerId);
    } else {
        // For now, only JOIN_DISCORD is handled by this backend verifier
        // Other off-chain tasks could be added here.
        isVerified = true;
    }

    if (isVerified) {
        // This part is tricky without a secure way to call the contract on the user's behalf.
        // In a real production app, you might use a backend wallet with permissions,
        // or a system that generates a signature for the user to use.
        // For this example, we'll assume the client will handle the smart contract call
        // after getting a success response from this API.
        
        // Simulating success of verification, client should now call completeTask
        return NextResponse.json({ success: true, message: 'Task verified successfully.' });
    } else {
      return NextResponse.json({ error: 'Task verification failed.' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'An unknown error occurred' }, { status: 500 });
  }
}
