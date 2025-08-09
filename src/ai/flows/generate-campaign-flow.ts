
'use server';
/**
 * @fileOverview An AI flow for generating a complete Web3 airdrop campaign draft.
 *
 * - generateCampaign - A function that handles the campaign generation process.
 * - GenerateCampaignInput - The input type for the generateCampaign function.
 * - GenerateCampaignOutput - The return type for the generateCampaign function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const GenerateCampaignInputSchema = z.string().describe('A description of the Web3 project for which to create a campaign.');
export type GenerateCampaignInput = z.infer<typeof GenerateCampaignInputSchema>;

export const GenerateCampaignOutputSchema = z.object({
  title: z.string().describe('A catchy and concise title for the campaign. Max 50 characters.'),
  shortDescription: z.string().describe('A brief, one-sentence description of the campaign for a preview card. Max 100 characters.'),
  description: z.string().describe('A detailed, engaging description for the main campaign page. Min 50 characters.'),
  tasks: z.array(z.object({
    type: z.enum(['SOCIAL_FOLLOW', 'JOIN_DISCORD', 'RETWEET', 'ONCHAIN_TX']).describe('The type of task.'),
    description: z.string().describe('A clear, actionable description for the task. E.g., "Follow @MyProject on X" or "Join our Discord server".'),
  })).describe('A list of 2-3 relevant tasks for participants to complete.'),
});
export type GenerateCampaignOutput = z.infer<typeof GenerateCampaignOutputSchema>;

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
4.  A list of 2-3 relevant and actionable tasks for participants to complete. Task types can be 'SOCIAL_FOLLOW', 'JOIN_DISCORD', 'RETWEET', or 'ONCHAIN_TX'.

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
