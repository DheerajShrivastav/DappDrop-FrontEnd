'use client'

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
} from 'lucide-react'

const changelogData = [
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
  icon: React.ElementType
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
