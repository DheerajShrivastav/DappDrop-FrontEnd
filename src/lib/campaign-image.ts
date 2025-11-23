/**
 * Get campaign image URL from cache with fallback
 */
export async function getCampaignImageUrl(campaignId: number): Promise<string> {
  try {
    const response = await fetch(`/api/campaigns/${campaignId}/image`, {
      cache: 'no-store',
    })

    if (response.ok) {
      const data = await response.json()
      if (data.imageUrl) {
        return data.imageUrl
      }
    }
  } catch (error) {
    console.error('Error fetching campaign image:', error)
  }

  // Fallback to placeholder
  return '/images/campaign-placeholder.jpg'
}

/**
 * Default placeholder image URL
 */
export const CAMPAIGN_IMAGE_PLACEHOLDER = '/images/campaign-placeholder.jpg'
