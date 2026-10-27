'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useSwitchChain } from 'wagmi'
import appConfig from '@/app/config'
import { network } from '@/config/landing'
import { shortAddress } from './format'

/** The header's pill shapes (app-design §1.4): 44 px, the touch-target floor. */
const pill = 'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border font-medium leading-none transition-colors [transition-duration:var(--dur-micro)]'
const connectCls = `${pill} border-transparent bg-ink px-4 text-small text-paper can-hover:hover:bg-ink-2 max-[359px]:px-3`
const accountCls = `${pill} border-rule-strong px-3 font-mono text-[0.8125rem] font-normal text-ink can-hover:hover:border-ink sm:px-[0.9rem]`
const attentionCls = `${pill} border-ink px-3 font-mono text-[0.8125rem] font-normal text-ink can-hover:hover:bg-sunk`

/**
 * The account pill: RainbowKit's ConnectButton.Custom rendering our own pills (no new
 * dependency). Three states:
 * - not connected → [Connect wallet] (filled ink pill; "Connect" on phones);
 * - connected to the deployment chain → `● 0x3f9c…a1e2 · Sepolia` (outline, mono), which opens
 *   RainbowKit's account modal (copy, disconnect). Phones show `● 0x3f…e2`;
 * - connected elsewhere → `! Switch to Sepolia` (attention chip), which switches the network.
 * Before RainbowKit has mounted, a same-size placeholder keeps the header from shifting.
 */
export function AccountPill() {
  const { switchChain } = useSwitchChain()
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openConnectModal, mounted }) => {
        if (!mounted) {
          return <span aria-hidden="true" className="dd-skel inline-block h-11 w-[5.75rem] rounded-full lg:w-[9.5rem]" data-account-pill="loading" />
        }
        if (!account || !chain) {
          return (
            <button type="button" onClick={openConnectModal} className={connectCls} data-account-pill="connect">
              <span>
                Connect<span className="max-lg:sr-only"> wallet</span>
              </span>
            </button>
          )
        }
        if (chain.id !== appConfig.chainId) {
          return (
            <button
              type="button"
              onClick={() => switchChain({ chainId: appConfig.chainId })}
              className={attentionCls}
              data-account-pill="wrong-network"
            >
              <span aria-hidden="true" className="font-semibold text-signal">
                !
              </span>
              <span>
                Switch<span className="max-sm:sr-only"> to {network.name}</span>
              </span>
            </button>
          )
        }
        return (
          <button
            type="button"
            onClick={openAccountModal}
            className={accountCls}
            title={account.address}
            data-account-pill="account"
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
            <span className="sr-only">Your wallet: </span>
            <span className="lg:hidden">{shortAddress(account.address, 'short')}</span>
            <span className="max-lg:hidden">{shortAddress(account.address)}</span>
            <span className="text-ink-3 max-lg:sr-only">· {chain.name ?? network.name}</span>
          </button>
        )
      }}
    </ConnectButton.Custom>
  )
}
