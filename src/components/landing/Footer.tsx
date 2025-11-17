import Link from 'next/link'

const navGroups = [
  {
    title: 'Product',
    items: [
      { label: 'Home', href: '/' },
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Create Campaign', href: '/create-campaign' },
      { label: 'About', href: '/about' },
    ],
  },
  {
    title: 'Resources',
    items: [
      { label: 'Changelog', href: '/changelog' },
      { label: 'Documentation', href: '#' },
      { label: 'Support', href: '#' },
    ],
  },
  {
    title: 'Community',
    items: [
      { label: 'Twitter', href: '#' },
      { label: 'Discord', href: '#' },
      { label: 'GitHub', href: '#' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="px-6 pb-12 pt-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 border-b border-slate-200 pb-12 lg:grid-cols-[1.2fr,1fr]">
          <div>
            <div className="inline-flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white font-semibold text-slate-900">
                DD
              </span>
              <span className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                DAppDrop
              </span>
            </div>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-slate-600">
              Helping web3 teams craft campaigns that attract believers, not bots. Built by operators who have sat in your war room.
            </p>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {navGroups.map((group) => (
              <div key={group.title}>
                <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  {group.title}
                </h4>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {group.items.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className="transition-colors hover:text-slate-900"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} DAppDrop. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="#" className="transition-colors hover:text-slate-900">
              Privacy
            </Link>
            <Link href="#" className="transition-colors hover:text-slate-900">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
