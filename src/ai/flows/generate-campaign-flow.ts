'use server'
/**
 * @fileOverview An AI flow for generating a complete Web3 airdrop campaign draft.
 *
 * - generateCampaign - A function that handles the campaign generation process.
 */

import { ai } from '@/ai/genkit'
import {
  GenerateCampaignInputSchema,
  type GenerateCampaignInput,
  GenerateCampaignOutputSchema,
  type GenerateCampaignOutput,
} from './generate-campaign.schema'

export async function generateCampaign(
  input: GenerateCampaignInput,
): Promise<GenerateCampaignOutput> {
  return generateCampaignFlow(input)
}

const prompt = ai.definePrompt({
  name: 'generateCampaignPrompt',
  input: { schema: GenerateCampaignInputSchema },
  output: { schema: GenerateCampaignOutputSchema },
  prompt: `You are an expert marketing agent for Web3 airdrop campaigns.

Your task: Generate ONLY a campaign title, descriptions, and tasks based on the user's project description.

STRICT RULES:
1. Use ONLY information from the project description provided below
2. DO NOT invent or hallucinate details not mentioned in the description
3. DO NOT generate reward information (user will add this separately)
4. Keep tasks directly relevant to the specific project described
5. Be concise and actionable
6. If the description is vague, create general Web3 tasks

Generate:
1. Title: Catchy, max 50 characters, relevant to the project mentioned
2. Short Description: One sentence, max 100 characters, for campaign preview card
3. Detailed Description: Engaging, min 50 characters, explains the campaign purpose based on the project
4. Tasks: 2-3 actionable tasks that make sense for THIS specific project

Available task types and when to use them:
- SOCIAL_FOLLOW: Follow the project on social media (Twitter/X, etc.)
- JOIN_DISCORD: Join the project's Discord community server
- JOIN_TELEGRAM: Join the project's Telegram group/channel
- RETWEET: Share or retweet project announcements
- ONCHAIN_TX: Perform a blockchain action (stake, swap, mint, bridge, etc.)
- HUMANITY_VERIFICATION: Verify as a real human using Humanity Protocol

Example good tasks:
- "Follow @ProjectName on X (Twitter)"
- "Join our Discord community"
- "Stake 10 tokens in the protocol"
- "Mint your genesis NFT"

Example bad tasks (too generic):
- "Complete social tasks"
- "Do stuff"
- "Participate"

Project Description:
{{{input}}}

IMPORTANT: Generate tasks that are SPECIFIC to this project. Match the task descriptions to what the project actually does.`,
})

const generateCampaignFlow = ai.defineFlow(
  {
    name: 'generateCampaignFlow',
    inputSchema: GenerateCampaignInputSchema,
    outputSchema: GenerateCampaignOutputSchema,
  },
  async (input) => {
    // Additional runtime validation
    const trimmedInput = input.trim()

    if (trimmedInput.length < 20) {
      throw new Error(
        'Project description must be at least 20 characters. Please provide more details about your project.',
      )
    }

    if (trimmedInput.length > 1000) {
      throw new Error(
        'Project description is too long (max 1000 characters). Please be more concise.',
      )
    }

    const { output } = await prompt(trimmedInput)

    if (!output) {
      throw new Error(
        'AI failed to generate campaign. Please try again with a clearer project description.',
      )
    }

    // Post-process AI output to ensure it meets character limits
    // (LLMs don't always respect character limits in prompts)
    const sanitizedOutput = {
      title: truncateText(output.title, 50),
      shortDescription: truncateText(output.shortDescription, 100),
      description:
        output.description.length > 500
          ? output.description.slice(0, 497) + '...'
          : output.description,
      tasks: output.tasks.slice(0, 4).map((task) => ({
        type: task.type,
        description: truncateText(task.description, 200),
      })),
    }

    return sanitizedOutput
  },
)

/**
 * Truncate text to a maximum length, trying to break at a word boundary
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text

  // Try to find a good break point (space, comma, etc.)
  const truncated = text.slice(0, maxLength - 3)
  const lastSpace = truncated.lastIndexOf(' ')

  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace) + '...'
  }

  return truncated + '...'
}
