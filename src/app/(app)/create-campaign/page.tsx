'use client'

import { useWallet } from '@/context/wallet-provider'
import { CreateCampaign } from './_components/create-campaign'

/**
 * /create-campaign: the host gate and the campaign wizard. The body lives in
 * _components/create-campaign.tsx (08-site phase 2), so the dev fixture can render its
 * wallet-only states; this page just hands it the connected wallet.
 */
export default function CreateCampaignPage() {
  const wallet = useWallet()
  return <CreateCampaign wallet={wallet} />
}
