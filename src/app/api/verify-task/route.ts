// src/app/api/verify-task/route.ts
import { NextResponse } from 'next/server';
import { completeTask, getCampaignById } from '@/lib/web3-service';
import { verifyDiscordJoin } from '@/lib/verification-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { campaignId, taskId, userAddress, discordUsername } = body;

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
      const discordServerId = task.verificationData; 
      if (!discordServerId) {
          return NextResponse.json({ error: 'Discord Server ID not configured for this task.' }, { status: 500 });
      }
      if (!discordUsername) {
          return NextResponse.json({ error: 'Discord username is required for verification.' }, { status: 400 });
      }
      isVerified = await verifyDiscordJoin(discordUsername, discordServerId);
    } else {
        // For now, only JOIN_DISCORD is handled by this backend verifier
        // Other off-chain tasks could be added here.
        isVerified = true;
    }

    if (isVerified) {
        // Since verification is successful on the backend, we now call the smart contract
        // to mark the task as complete on-chain. This uses a backend wallet/signer
        // that has permission to call `completeTask`.
        // IMPORTANT: In a real production app, the `completeTask` function in the contract
        // should be protected, only allowing a trusted backend address (a 'verifier') to call it.
        await completeTask(campaignId, taskIndex, userAddress);
        return NextResponse.json({ success: true, message: 'Task verified and completed successfully.' });
    } else {
      return NextResponse.json({ error: 'Task verification failed.' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'An unknown error occurred' }, { status: 500 });
  }
}
