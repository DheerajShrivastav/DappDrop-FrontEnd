/**
 * @fileOverview Schemas for the campaign generation AI flow.
 *
 * - GenerateCampaignInput - The input type for the generateCampaign function.
 * - GenerateCampaignOutput - The return type for the generateCampaign function.
 */
import { z } from 'genkit';

export const GenerateCampaignInputSchema = z.string()
  .min(20, 'Project description must be at least 20 characters')
  .max(1000, 'Project description must be under 1000 characters')
  .describe('A description of the Web3 project for which to create a campaign.');

export type GenerateCampaignInput = z.infer<typeof GenerateCampaignInputSchema>;

export const GenerateCampaignOutputSchema = z.object({
  title: z.string()
    .min(5, 'Title too short')
    .max(50, 'Title too long')
    .describe('A catchy and concise title for the campaign. Max 50 characters.'),
  shortDescription: z.string()
    .min(10, 'Short description too short')
    .max(100, 'Short description too long')
    .describe('A brief, one-sentence description of the campaign for a preview card. Max 100 characters.'),
  description: z.string()
    .min(50, 'Description too short')
    .max(500, 'Description too long')
    .describe('A detailed, engaging description for the main campaign page. Min 50, max 500 characters.'),
  tasks: z.array(z.object({
    type: z.enum([
      'SOCIAL_FOLLOW',
      'JOIN_DISCORD',
      'JOIN_TELEGRAM',
      'RETWEET',
      'ONCHAIN_TX',
      'HUMANITY_VERIFICATION'
    ]).describe('The type of task.'),
    description: z.string()
      .min(10, 'Task description too short')
      .max(200, 'Task description too long')
      .describe('A clear, actionable description for the task. E.g., "Follow @MyProject on X" or "Join our Discord server".'),
  }))
    .min(2, 'At least 2 tasks required')
    .max(4, 'Maximum 4 tasks allowed')
    .describe('A list of 2-4 relevant tasks for participants to complete.'),
});

export type GenerateCampaignOutput = z.infer<typeof GenerateCampaignOutputSchema>;
