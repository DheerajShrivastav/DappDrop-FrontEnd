/**
 * Route segment config for /create-campaign. Lives here because page.tsx is a client component
 * and can't export it.
 *
 * maxDuration covers the "Generate with AI" server action (src/ai/flows/generate-campaign-flow.ts),
 * which runs under this route. Its pipeline budget is AI_PIPELINE_BUDGET_MS (70s) plus up to one
 * in-flight call's timeout; this ceiling sits comfortably above that so the platform never kills
 * the request first — a killed request is the one failure the client can't tell apart from "slow".
 */
export const maxDuration = 120

export default function CreateCampaignLayout({ children }: { children: React.ReactNode }) {
  return children
}
