
'use server';
/**
 * @fileOverview An AI flow for generating a complete Web3 airdrop campaign draft.
 *
 * - generateCampaign - A function that handles the campaign generation process.
 */

import { ai } from '@/ai/genkit';
import {
  GenerateCampaignInputSchema,
  type GenerateCampaignInput,
  GenerateCampaignOutputSchema,
  type GenerateCampaignOutput,
} from './generate-campaign.schema';

export async function generateCampaign(input: GenerateCampaignInput): Promise<GenerateCampaignOutput> {
  return generateCampaignFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCampaignPrompt',
  input: { schema: GenerateCampaignInputSchema },
  output: { schema: GenerateCampaignOutputSchema },
  prompt: `You are an expert marketing agent for Web3 projects. Your goal is to create an engaging airdrop campaign to attract real users.

Based on the project description provided, generate a complete campaign draft.

The campaign should include:
1.  A catchy and concise title.
2.  A short, one-sentence description suitable for a campaign preview card.
3.  A more detailed and engaging description for the main campaign page.
4.  A list of 2-3 relevant and actionable tasks for participants to complete. Task types can be 'SOCIAL_FOLLOW', 'JOIN_DISCORD', 'JOIN_TELEGRAM', 'RETWEET', or 'ONCHAIN_TX' and should align with the project's goals.
5.  A reward structure detailing the type of reward (ERC20, ERC721, or None), token address, amount (if applicable), and a name for the reward as described in the project details.

Project Description:
{{{input}}}
`,
});

const generateCampaignFlow = ai.defineFlow(
  {
    name: 'generateCampaignFlow',
    inputSchema: GenerateCampaignInputSchema,
    outputSchema: GenerateCampaignOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
