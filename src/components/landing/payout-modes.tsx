import { claims } from '@/config/claims'
import { PhoneDetails } from './phone-details'
import { Receipt } from './receipt'

/**
 * S1-08 block 2: three ways to pay (plan §2.3), every row visible. Flag paths:
 * - tasksEnforcedOnChain → "By rank · best for races and leaderboards" + receipt (S2-02);
 *   otherwise the "Not recommended until our next contract update" chip and its reason (RED-02).
 * - tierModuleFixed → "By points" enabled + receipt (S2-03); otherwise its chip.
 * - nftCustodyFixed → the NFT warning link drops and the NFT receipt appears (S2-06).
 */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-3 bg-surface px-2.5 py-0.5 font-mono text-[0.75rem] text-ink-2">
      <span aria-hidden="true">◷</span>
      {children}
    </span>
  )
}

/** Founder decision 2026-10-11: below 768 px each mode is its name, one tap from the detail. */
function Mode({ name, children }: { name: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="border-t border-rule">
      <PhoneDetails
        summaryClassName="py-1.5 md:py-3"
        summary={<span className="text-small font-semibold text-ink md:font-mono md:text-[0.8125rem] md:font-medium md:uppercase md:tracking-[0.04em]">{name}</span>}
      >
        <div className="space-y-1.5 pb-3 md:pb-5">{children}</div>
      </PhoneDetails>
    </li>
  )
}

export function PayoutModes() {
  const rankLive = claims.tasksEnforcedOnChain
  const pointsLive = claims.tierModuleFixed

  return (
    <div className="mt-8 md:mt-12">
      <h3 className="text-title font-semibold">Three ways to pay</h3>
      <ul className="mt-3 border-b border-rule md:mt-4">
        <Mode name="Equal split">
          <p className="text-small text-ink-2 md:text-body">
            Our app proposes an equal split among wallets that finished every required task. You review and publish it;
            the contract enforces the 24 hours and the claims. <Receipt id="equalSplit" />
          </p>
        </Mode>

        {rankLive && pointsLive ? (
          <>
            <Mode name="By rank · best for races and leaderboards">
              <p className="text-small text-ink-2 md:text-body">
                Payouts by completion rank, for example the first 100 wallets, computed fully on-chain, so there&apos;s no
                list to argue about. <Receipt id="rank" />
              </p>
            </Mode>
            <Mode name="By points">
              <p className="text-small text-ink-2 md:text-body">
                Payouts by points score, computed by the contract. No list. <Receipt id="points" />
              </p>
            </Mode>
          </>
        ) : (
          <Mode name={rankLive ? 'By rank · best for races and leaderboards' : 'By rank or by points'}>
            <p className="text-small text-ink-2 md:text-body">Computed by the contract, no list.</p>
            {rankLive ? (
              <>
                <Receipt id="rank" />
                <p>
                  <Chip>By points: after our next contract update</Chip>
                </p>
              </>
            ) : (
              <details className="lp-details" data-detail="tiers_reason">
                <summary className="inline-flex min-h-11 items-center gap-2">
                  <Chip>Not recommended until our next contract update</Chip>
                  <span className="sr-only">Why?</span>
                </summary>
                <p className="mt-1 text-small text-ink-2">
                  Today a wallet can mark its own tasks done on the contract, so a race can be gamed.
                </p>
              </details>
            )}
          </Mode>
        )}

        <Mode name="NFTs">
          <p className="text-small text-ink-2 md:text-body">
            One item per qualifying wallet: single NFTs (ERC-721) or editions (ERC-1155).{' '}
            {claims.nftCustodyFixed && <Receipt id="nft" />}
          </p>
          {!claims.nftCustodyFixed && (
            <p>
              <a href="#can-cant" className="lp-link text-small">
                What our admin key can do with NFTs ↓
              </a>
            </p>
          )}
        </Mode>
      </ul>
    </div>
  )
}
