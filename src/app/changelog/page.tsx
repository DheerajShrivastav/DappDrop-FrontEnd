'use client'
import type {ElementType} from 'react'
import { format } from 'date-fns'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  GitCommit,
  ShieldCheck,
  Zap,
  Bot,
  UserPlus,
  Rocket,
  MessageSquare,
  Send,
  Users,
  CreditCard,
  DollarSign,
  Palette,
  Sparkles,
  Layout,
} from 'lucide-react'

const changelogData = [
  {
    date: new Date('2025-12-01T18:00:00Z'),
    version: 'Design Overhaul',
    title: 'Complete UI/UX Redesign',
    description:
      'Major visual redesign of the entire platform with modern aesthetics, enhanced animations, and improved user experience. Transformed the interface with premium design elements, better visual hierarchy, and responsive layouts across all pages.',
    changes: [
      {
        type: 'Improvement',
        icon: Palette,
        text: 'Redesigned dashboard with modern card layouts, enhanced visual hierarchy, and improved spacing for better readability.',
      },
      {
        type: 'Improvement',
        icon: Sparkles,
        text: 'Added smooth animations and transitions throughout the platform using Framer Motion for enhanced user engagement.',
      },
      {
        type: 'Improvement',
        icon: Layout,
        text: 'Improved campaign card design with hover effects, better status indicators, and responsive button layouts.',
      },
      {
        type: 'Improvement',
        icon: Zap,
        text: 'Enhanced campaign details page with hero image sections, sticky sidebars, and improved task completion progress tracking.',
      },
      {
        type: 'Feature',
        icon: Sparkles,
        text: 'Implemented glassmorphism effects, gradient backgrounds, and modern color schemes for a premium Web3 aesthetic.',
      },
      {
        type: 'Improvement',
        icon: GitCommit,
        text: 'Optimized responsive design for all screen sizes with mobile-first approach and improved touch interactions.',
      },
      {
        type: 'Improvement',
        icon: Layout,
        text: 'Refined typography system with better font hierarchy, improved line heights, and enhanced readability across all components.',
      },
    ],
  },
  {
    date: new Date('2025-11-29T12:00:00Z'),
    version: 'Payment Integration',
    title: 'X402 Payment Protocol Integration',
    description:
      'Revolutionary payment task integration with X402 Payment Protocol, enabling campaigns to require on-chain payment verification for task completion with comprehensive status tracking and user-friendly UI.',
    changes: [
      {
        type: 'Feature',
        icon: CreditCard,
        text: 'Integrated X402 Payment Protocol for secure on-chain payment verification and task completion.',
      },
      {
        type: 'Feature',
        icon: DollarSign,
        text: 'Added ONCHAIN_TX task type with payment amount, network, and recipient address configuration.',
      },
      {
        type: 'Feature',
        icon: Zap,
        text: 'Implemented payment verification API endpoints with transaction hash validation and status checking.',
      },
      {
        type: 'Feature',
        icon: Bot,
        text: 'Created payment task UI with transaction hash input, verification status, and real-time feedback.',
      },
      {
        type: 'Improvement',
        icon: GitCommit,
        text: 'Enhanced campaign creation flow with payment task metadata including amount, network, and recipient fields.',
      },
      {
        type: 'Improvement',
        icon: ShieldCheck,
        text: 'Added comprehensive error handling for payment verification failures and network-specific validation.',
      },
      {
        type: 'Security',
        icon: ShieldCheck,
        text: 'Implemented secure payment verification with blockchain transaction validation and amount verification.',
      },
    ],
  },
  {
    date: new Date('2025-11-20T16:00:00Z'),
    version: 'Identity & Trust',
    title: 'Humanity Protocol Integration',
    description:
      'Revolutionary human verification system integration with Humanity Protocol, enabling campaigns to verify authentic human participation and prevent bot manipulation.',
    changes: [
      {
        type: 'Feature',
        icon: Users,
        text: 'Integrated Humanity Protocol API for comprehensive human verification and sybil resistance.',
      },
      {
        type: 'Feature',
        icon: ShieldCheck,
        text: 'Added HUMANITY_VERIFICATION task type with wallet-based authentication and verification.',
      },
      {
        type: 'Feature',
        icon: Zap,
        text: 'Implemented humanity verification modal with connected and custom wallet address options.',
      },
      {
        type: 'Security',
        icon: ShieldCheck,
        text: 'Enhanced task verification security with fail-closed approach for missing humanity verification metadata.',
      },
      {
        type: 'Feature',
        icon: Bot,
        text: 'Created intelligent caching system with smart refresh logic for verification status management.',
      },
      {
        type: 'Improvement',
        icon: GitCommit,
        text: 'Implemented request-origin-safe URLs and distinguished infrastructure errors from verification failures.',
      },
    ],
  },
  {
    date: new Date('2025-11-07T14:00:00Z'),
    version: 'Communication Expansion',
    title: 'Telegram Bot Verification System',
    description:
      'Expanded social verification capabilities with comprehensive Telegram integration, enabling campaigns to verify user participation in Telegram channels and groups.',
    changes: [
      {
        type: 'Feature',
        icon: Send,
        text: 'Added complete Telegram Bot API integration for channel and group membership verification.',
      },
      {
        type: 'Feature',
        icon: Bot,
        text: 'Implemented Telegram-specific verification logic with both username and user ID support.',
      },
      {
        type: 'Feature',
        icon: Zap,
        text: 'Created Telegram task verification with secure API endpoints and proper error handling.',
      },
      {
        type: 'Security',
        icon: ShieldCheck,
        text: 'Enhanced security with proper Telegram API parameter validation and rate limiting.',
      },
      {
        type: 'Improvement',
        icon: GitCommit,
        text: 'Fixed Telegram getChatMember API implementation to use correct numeric user ID format.',
      },
      {
        type: 'Improvement',
        icon: GitCommit,
        text: 'Added comprehensive Telegram verification debugging and logging capabilities.',
      },
      {
        type: 'Feature',
        icon: MessageSquare,
        text: 'Integrated Telegram invite link management and validation for campaign tasks.',
      },
    ],
  },
  {
    date: new Date('2025-09-20T16:00:00Z'),
    version: 'Social Integration',
    title: 'Discord Verification System',
    description:
      'Enhanced social verification capabilities with comprehensive Discord integration, allowing campaigns to verify user participation in Discord servers.',
    changes: [
      {
        type: 'Feature',
        icon: MessageSquare,
        text: 'Added complete Discord OAuth2 authentication flow with bot-based verification.',
      },
      {
        type: 'Feature',
        icon: Bot,
        text: 'Implemented Discord bot integration to verify user membership in specific servers.',
      },
      {
        type: 'Feature',
        icon: Zap,
        text: 'Created Discord-specific task verification with secure API endpoints and rate limiting.',
      },
      {
        type: 'Security',
        icon: ShieldCheck,
        text: 'Enhanced verification security with encrypted token storage and user data protection.',
      },
      {
        type: 'Improvement',
        icon: GitCommit,
        text: 'Optimized Discord API calls with proper error handling and fallback mechanisms.',
      },
      {
        type: 'Improvement',
        icon: GitCommit,
        text: 'Added comprehensive logging and debugging tools for Discord verification troubleshooting.',
      },
    ],
  },
  {
    date: new Date('2025-08-31T10:00:00Z'),
    version: 'Phase 1 Launch',
    title: 'Smart Contract Security Upgrade',
    description:
      'Deployed Phase 1 of our smart contract with critical security upgrades to lay the foundation for a scalable, secure Web3 campaign platform.',
    changes: [
      {
        type: 'Security',
        icon: ShieldCheck,
        text: 'Integrated ReentrancyGuard and Pausable contracts for enhanced attack resistance.',
      },
      {
        type: 'Feature',
        icon: Zap,
        text: 'Implemented robust role-based access control (RBAC) with distinct HOST and ADMIN roles.',
      },
      {
        type: 'Improvement',
        icon: GitCommit,
        text: 'Added campaign timeframe enforcement to ensure task validity and prevent out-of-bounds interactions.',
      },
      {
        type: 'Improvement',
        icon: GitCommit,
        text: 'Integrated rate-limiting mechanisms to protect against spam and abuse.',
      },
    ],
  },
  {
    date: new Date('2025-08-13T14:30:00Z'),
    version: 'Feature Update',
    title: 'AI-Powered Campaign Generation',
    description:
      'Introduced a new feature allowing hosts to generate complete campaign drafts using AI, streamlining the creation process.',
    changes: [
      {
        type: 'Feature',
        icon: Bot,
        text: 'Added a new Genkit flow to generate campaign titles, descriptions, and tasks from a simple text prompt.',
      },
      {
        type: 'Feature',
        icon: Zap,
        text: 'Integrated an AI generation UI into the "Create Campaign" page to autofill the form for hosts.',
      },
    ],
  },
  {
    date: new Date('2025-08-05T18:00:00Z'),
    version: 'Governance Update',
    title: 'Permissionless Host Role',
    description:
      'Decentralized campaign creation by allowing any user to grant themselves the HOST_ROLE directly via a smart contract interaction.',
    changes: [
      {
        type: 'Feature',
        icon: UserPlus,
        text: 'Users can now self-assign the HOST_ROLE on the "Create Campaign" page without needing admin approval.',
      },
      {
        type: 'Improvement',
        icon: GitCommit,
        text: 'This change removes a centralized bottleneck, empowering the community to create campaigns freely and fostering a more open platform.',
      },
    ],
  },
  {
    date: new Date('2025-08-02T12:00:00Z'),
    version: 'Initial Launch',
    title: 'DApp Drop Zone v1.0 Launch',
    description:
      'The first version of DApp Drop Zone is live, introducing the core functionalities for creating, managing, and participating in Web3 campaigns.',
    changes: [
      {
        type: 'Feature',
        icon: Rocket,
        text: 'Hosts can create, manage, and add tasks to on-chain campaigns.',
      },
      {
        type: 'Feature',
        icon: UserPlus,
        text: 'Participants can join campaigns, complete tasks, and track their progress.',
      },
      {
        type: 'Feature',
        icon: GitCommit,
        text: 'Added a host dashboard with analytics to monitor participant engagement.',
      },
    ],
  },
]

const ChangeTypeIcon = ({
  type,
  icon: Icon,
}: {
  type: string
  icon: ElementType
}) => {
  const getBadgeVariant = () => {
    switch (type) {
      case 'Security':
        return 'destructive'
      case 'Feature':
        return 'default'
      case 'Improvement':
        return 'secondary'
      case 'Governance':
        return 'outline'
      default:
        return 'outline'
    }
  }
  return (
    <Badge variant={getBadgeVariant()} className="mr-2">
      <Icon className="h-3 w-3 mr-1" />
      {type}
    </Badge>
  )
}

export default function ChangelogPage() {
  // Sort data descending by date
  const sortedChangelogData = changelogData.sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  )

  return (
    <div className="bg-background text-foreground">
      <section className="bg-card border-b border-primary/20">
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter">
            Changelog
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-3xl mx-auto">
            Stay updated with the latest features, improvements, and bug fixes
            for DApp Drop Zone.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="relative">
            <div
              className="absolute left-4 top-0 h-full w-0.5 bg-border -translate-x-1/2"
              aria-hidden="true"
            ></div>
            <div className="space-y-12">
              {sortedChangelogData.map((entry, index) => (
                <div key={index} className="relative pl-8">
                  <div className="absolute left-4 top-2 h-4 w-4 bg-primary rounded-full -translate-x-1/2 border-4 border-card"></div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">
                    {format(entry.date, 'MMMM dd, yyyy')}
                  </p>
                  <Card className="bg-card border shadow-md">
                    <CardHeader>
                      <CardTitle className="text-2xl">{entry.title}</CardTitle>
                      <CardDescription>{entry.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {entry.changes.map((change, cIndex) => (
                          <li key={cIndex} className="flex items-start">
                            <ChangeTypeIcon
                              type={change.type}
                              icon={change.icon}
                            />
                            <span className="flex-1 text-muted-foreground">
                              {change.text}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
