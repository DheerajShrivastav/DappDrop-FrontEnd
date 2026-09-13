import 'dotenv/config'
import { ethers } from 'ethers'

/**
 * Mint test ERC721s for NFT-reward campaign testing.
 *
 * The Mock721 test collection on Sepolia has an OPEN `mint(address,uint256)` — no owner, no
 * access control — so anyone can mint any unused tokenId to any address. The contract is not
 * verified on Etherscan, so there is no Write tab; this script is the practical way to mint.
 *
 * Usage:
 *   npx tsx scripts/mint-test-nft.ts <toAddress> <tokenId> [tokenId...]
 *   npx tsx scripts/mint-test-nft.ts 0xYourHostWallet 101 102 103
 *
 * Signs with KEEPER_PRIVATE_KEY purely because it is a funded key already in .env — the mint
 * is unrestricted, so the signer does not have to be the recipient. Gas is a few cents.
 */

const COLLECTION = '0x12dd6beba48297f3509ae71f145df88faf28d347' // Mock721 (M721), Sepolia
const ABI = [
  'function mint(address to, uint256 tokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
]

async function main() {
  const [to, ...ids] = process.argv.slice(2)
  if (!to || !ethers.isAddress(to) || ids.length === 0) {
    console.error('Usage: npx tsx scripts/mint-test-nft.ts <toAddress> <tokenId> [tokenId...]')
    process.exit(1)
  }

  const pk = process.env.KEEPER_PRIVATE_KEY || process.env.SIGNER_PRIVATE_KEY
  if (!pk) throw new Error('No funded key found (KEEPER_PRIVATE_KEY / SIGNER_PRIVATE_KEY)')

  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL)
  const wallet = new ethers.Wallet(pk, provider)
  const c = new ethers.Contract(COLLECTION, ABI, wallet)

  console.log(`collection : ${COLLECTION} (Mock721)`)
  console.log(`minting to : ${to}`)
  console.log(`signer     : ${wallet.address}\n`)

  for (const raw of ids) {
    const id = Number(raw)
    // Skip anything already minted rather than burning gas on a guaranteed revert.
    try {
      const owner = await c.ownerOf(id)
      console.log(`  #${id}  already exists, owned by ${owner} — skipped`)
      continue
    } catch {
      /* does not exist yet — good, mint it */
    }
    const tx = await c.mint(to, id)
    await tx.wait()
    console.log(`  #${id}  minted  (tx ${tx.hash})`)
  }

  console.log('\nPaste into the campaign wizard:')
  console.log(`  Token Contract Address : ${COLLECTION}`)
  console.log(`  NFT standard           : ERC721`)
  console.log(`  Token IDs to deposit   : ${ids.join(', ')}`)
}

main().catch((e) => {
  console.error(e.shortMessage || e.message || e)
  process.exit(1)
})
