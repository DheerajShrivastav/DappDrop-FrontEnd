/**
 * @fileOverview Schemas for the campaign generation AI flow.
 *
 * - GenerateCampaignInput - The input type for the generateCampaign function.
 * - GenerateCampaignOutput - The return type for the generateCampaign function.
 */
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
