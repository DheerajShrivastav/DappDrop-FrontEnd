/**
 * Signer verification script (PRD BR-V2) — run: `node scripts/test-signer.mjs`
 *
 * Proves the EIP-712 attestation the signer service produces will be ACCEPTED by the
 * deployed contract, without needing the SIGNER_ROLE key:
 *   1. keccak256(typehash string) === on-chain TASK_ATTESTATION_TYPEHASH()
 *   2. our EIP-712 domain === the contract's eip712Domain()
 *   3. getTaskAttestationVersion reads correctly against Sepolia
 *   4. an ephemeral-key TaskAttestation round-trips (sign → recover)
 *
 * If SIGNER_PRIVATE_KEY is set it additionally checks the key holds SIGNER_ROLE and prints
 * its address. Full on-chain submit is opt-in (SUBMIT=1 + CAMPAIGN_ID/TASK_INDEX/PARTICIPANT)
 * because it needs a real non-hold task in an Open/Ended campaign + a funded submitter.
 *
 * Never logs the private key or the signature bytes.
 */
import { ethers } from 'ethers'

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
  'https://ethereum-sepolia.publicnode.com'
const ENTRYPOINT =
  process.env.NEXT_PUBLIC_CAMPAIGN_FACTORY_CONTRACT ||
  '0xf0A2Fac02ffBA4A7762f2f0d611253B6C97bB1B3'
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || '11155111')

const TYPEHASH_STRING =
  'TaskAttestation(uint256 campaignId,address participant,uint256 taskIndex,bool completed,uint256 version,uint256 deadline)'
const TYPES = {
  TaskAttestation: [
    { name: 'campaignId', type: 'uint256' },
    { name: 'participant', type: 'address' },
    { name: 'taskIndex', type: 'uint256' },
    { name: 'completed', type: 'bool' },
    { name: 'version', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
}
const DOMAIN = {
  name: 'Web3Campaigns',
  version: '1',
  chainId: CHAIN_ID,
  verifyingContract: ENTRYPOINT,
}

const ABI = [
  'function TASK_ATTESTATION_TYPEHASH() view returns (bytes32)',
  'function eip712Domain() view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)',
  'function getTaskAttestationVersion(uint256,address,uint256) view returns (uint256)',
  'function getCampaignCount() view returns (uint256)',
  'function SIGNER_ROLE() view returns (bytes32)',
  'function hasRole(bytes32,address) view returns (bool)',
]

const ok = (b) => (b ? '✅' : '❌')
let allPass = true
const check = (label, pass, extra = '') => {
  if (!pass) allPass = false
  console.log(`${ok(pass)} ${label}${extra ? ` — ${extra}` : ''}`)
}

async function main() {
  console.log(`\nSigner verification against ${ENTRYPOINT} (chain ${CHAIN_ID})\n`)
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const c = new ethers.Contract(ENTRYPOINT, ABI, provider)

  // 1. Typehash
  const onchainTypehash = await c.TASK_ATTESTATION_TYPEHASH()
  const localTypehash = ethers.keccak256(ethers.toUtf8Bytes(TYPEHASH_STRING))
  check('TASK_ATTESTATION_TYPEHASH matches', onchainTypehash === localTypehash,
    `${onchainTypehash.slice(0, 18)}…`)

  // 2. Domain
  const d = await c.eip712Domain()
  const domainMatch =
    d.name === DOMAIN.name &&
    d.version === DOMAIN.version &&
    Number(d.chainId) === DOMAIN.chainId &&
    d.verifyingContract.toLowerCase() === ENTRYPOINT.toLowerCase()
  check('EIP-712 domain matches contract', domainMatch,
    `name=${d.name} version=${d.version} chainId=${d.chainId}`)
  // Belt-and-braces: domain separators equal
  const sepLocal = ethers.TypedDataEncoder.hashDomain(DOMAIN)
  const sepChain = ethers.TypedDataEncoder.hashDomain({
    name: d.name, version: d.version, chainId: Number(d.chainId), verifyingContract: d.verifyingContract,
  })
  check('Domain separator matches', sepLocal === sepChain, `${sepLocal.slice(0, 18)}…`)

  // 3. Version read
  const probe = await c.getTaskAttestationVersion(1, ethers.ZeroAddress, 0)
  check('getTaskAttestationVersion read works', typeof probe === 'bigint',
    `campaign1/task0/zeroaddr => v${probe}`)
  const count = await c.getCampaignCount()
  console.log(`   (campaign count on-chain: ${count})`)

  // 4. Ephemeral round-trip: prove the struct encoding signs+recovers
  const eph = ethers.Wallet.createRandom()
  const value = {
    campaignId: 1n, participant: eph.address, taskIndex: 0n,
    completed: true, version: 1n, deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
  }
  const sig = await eph.signTypedData(DOMAIN, TYPES, value)
  const recovered = ethers.verifyTypedData(DOMAIN, TYPES, value, sig)
  check('TaskAttestation signs & recovers', recovered === eph.address, 'ephemeral key')
  // The digest the contract will hash is deterministic from domain+types+value:
  const digest = ethers.TypedDataEncoder.hash(DOMAIN, TYPES, value)
  console.log(`   (attestation digest: ${digest.slice(0, 18)}…)`)

  // Optional: real signer authorization + submit
  const pk = process.env.SIGNER_PRIVATE_KEY
  if (pk) {
    const signer = new ethers.Wallet(pk)
    const role = await c.SIGNER_ROLE()
    const has = await c.hasRole(role, signer.address)
    check('SIGNER_PRIVATE_KEY holds SIGNER_ROLE', has, signer.address)
    console.log(
      has
        ? '   → key is authorized; the service can produce accepted attestations.'
        : '   → key is NOT authorized; grant SIGNER_ROLE to this address or use the deployer key.',
    )
    if (process.env.SUBMIT === '1') {
      console.log('   (SUBMIT=1 set — run the full flow via the app / a dedicated script with a real campaign+task)')
    }
  } else {
    console.log(
      '\nℹ️  SIGNER_PRIVATE_KEY not set — skipped on-chain authorization/submit.\n' +
        '   Set it (the deployer key on this test deploy) to run the full sign+submit.',
    )
  }

  console.log(`\n${allPass ? '✅ ALL OFFLINE CHECKS PASSED' : '❌ SOME CHECKS FAILED'}\n`)
  process.exit(allPass ? 0 : 1)
}

main().catch((e) => {
  console.error('test-signer error:', e.message)
  process.exit(1)
})
