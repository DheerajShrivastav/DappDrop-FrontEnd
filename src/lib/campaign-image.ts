/**
 * Get a campaign's stored image URL, or '' when it has none. Never a stock placeholder:
 * a campaign without an image renders without one.
 */
export async function getCampaignImageUrl(campaignId: number): Promise<string> {
  try {
    const response = await fetch(`/api/campaigns/${campaignId}/image`, {
      cache: 'no-store',
    })

    if (response.ok) {
      const data = await response.json()
      return displayImageUrl(data.imageUrl) ?? ''
    }
  } catch (error) {
    console.error('Error fetching campaign image:', error)
  }
  return ''
}

/**
 * The image to show for a campaign, or undefined for "no image". Older campaigns stored the
 * wizard's stock "600 × 400" placeholder as their image, so that counts as no image too.
 */
export function displayImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const trimmed = url.trim()
  if (!trimmed || trimmed.includes('placehold.co')) return undefined
  return trimmed
}
