'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { addDays, format, setHours, setMinutes } from 'date-fns'
import {
  Calendar as CalendarIcon,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Check,
  Info,
  Sparkles,
  UserPlus,
  ExternalLink,
  Bot,
} from 'lucide-react'

import config from '@/app/config'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useWallet } from '@/context/wallet-provider'
import React from 'react'
import type { TaskType } from '@/lib/types'
import {
  becomeHost,
  createCampaign,
  createAndActivateCampaign,
} from '@/lib/web3-service'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { generateCampaign } from '@/ai/flows/generate-campaign-flow'

const taskSchema = z.object({
  type: z.enum([
    'SOCIAL_FOLLOW',
    'JOIN_DISCORD',
    'JOIN_TELEGRAM',
    'RETWEET',
    'ONCHAIN_TX',
  ]),
  description: z
    .string()
    .min(3, 'Task description must be at least 3 characters long.'),
  verificationData: z.string().optional(),
  discordInviteLink: z.string().optional(),
  telegramInviteLink: z.string().optional(),
})

const campaignSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters long.'),
  shortDescription: z
    .string()
    .min(10, 'Short description must be at least 10 characters long.'),
  description: z
    .string()
    .min(50, 'Detailed description must be at least 50 characters long.'),
  dates: z
    .object({
      from: z.date({ required_error: 'Start date is required.' }),
      to: z.date({ required_error: 'End date is required.' }),
    })
    .refine((data) => data.to > data.from, {
      message: 'End date must be after the start date.',
      path: ['to'],
    }),
  imageUrl: z.string().url('Please enter a valid image URL.'),
  tasks: z.array(taskSchema).min(1, 'At least one task is required.'),
  reward: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('ERC20'),
      tokenAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, 'Please enter a valid Ethereum address.'),
      amount: z.string().min(1, 'Amount is required for ERC20 tokens.'),
      name: z.string().optional(),
    }),
    z.object({
      type: z.literal('ERC721'),
      tokenAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, 'Please enter a valid Ethereum address.'),
      name: z.string().optional(),
    }),
    z.object({
      type: z.literal('None'),
      name: z.string().min(1, 'A description of the reward is required.'),
    }),
  ]),
})

type CampaignFormValues = z.infer<typeof campaignSchema>

const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'SOCIAL_FOLLOW', label: 'Social Follow' },
  { value: 'JOIN_DISCORD', label: 'Join Discord' },
  { value: 'JOIN_TELEGRAM', label: 'Join Telegram' },
  { value: 'RETWEET', label: 'Retweet Post' },
  { value: 'ONCHAIN_TX', label: 'On-chain Action' },
]

export default function CreateCampaignPage() {
  const [step, setStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isBecomingHost, setIsBecomingHost] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [createMode, setCreateMode] = useState<'draft' | 'activate'>('activate')
  const router = useRouter()
  const { toast } = useToast()
  const { address, isConnected, role, checkRoles } = useWallet()

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      title: '',
      shortDescription: '',
      description: '',
      dates: {
        from: new Date(),
        to: addDays(new Date(), 1),
      },
      imageUrl: `https://placehold.co/600x400`,
      tasks: [
        {
          type: 'SOCIAL_FOLLOW',
          description: '',
          verificationData: '',
          discordInviteLink: '',
          telegramInviteLink: '',
        },
      ],
      reward: { type: 'ERC20', tokenAddress: '', amount: '', name: '' },
    },
    mode: 'onChange',
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'tasks',
  })

  const rewardType = form.watch('reward.type')
  const dates = form.watch('dates')
  const tasks = form.watch('tasks')

  const onSubmit = async (data: CampaignFormValues) => {
    console.log('🚀 === FORM SUBMISSION STARTED ===')
    console.log('📋 Form data received:', JSON.stringify(data, null, 2))
    console.log('📋 Tasks in form data:', data.tasks)
    console.log('📋 Create mode:', createMode)

    if (!isConnected || !address) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please connect your wallet to create a campaign.',
      })
      return
    }
    setIsLoading(true)
    try {
      console.log('🔄 About to call campaign creation function...')
      const campaignId =
        createMode === 'activate'
          ? await createAndActivateCampaign(data)
          : await createCampaign(data)

      console.log('✅ Campaign created successfully with ID:', campaignId)

      const successMessage =
        createMode === 'activate'
          ? `Your campaign (ID: ${campaignId}) has been created and activated!`
          : `Your campaign (ID: ${campaignId}) has been created in Draft status.`

      toast({
        title: 'Success!',
        description: successMessage,
      })
      router.push(`/campaign/${campaignId}`)
    } catch (e) {
      // Error toast is handled in the service
    } finally {
      setIsLoading(false)
    }
  }

  const handleBecomeHost = async () => {
    if (!isConnected || !address) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please connect your wallet first.',
      })
      return
    }
    setIsBecomingHost(true)
    try {
      await becomeHost()
      // Re-check role after transaction
      await checkRoles(address)
    } catch (e) {
      // Error toast is handled in the service
    } finally {
      setIsBecomingHost(false)
    }
  }

  const nextStep = async () => {
    let fieldsToValidate:
      | (keyof CampaignFormValues)[]
      | `tasks.${number}.${'description' | 'type'}`[]
      | `reward.${'type' | 'tokenAddress' | 'amount' | 'name'}`[] = []
    if (step === 1)
      fieldsToValidate = [
        'title',
        'shortDescription',
        'description',
        'dates',
        'imageUrl',
      ]
    if (step === 2) fieldsToValidate = ['tasks']
    if (step === 3) fieldsToValidate = ['reward']

    const isValid = await form.trigger(fieldsToValidate as any)
    if (isValid) setStep((s) => s + 1)
  }

  const prevStep = () => setStep((s) => s - 1)

  const handleGenerate = async () => {
    if (!aiPrompt) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please provide a project description.',
      })
      return
    }
    setIsGenerating(true)
    try {
      const result = await generateCampaign(aiPrompt)
      const currentValues = form.getValues()
      form.reset({
        ...currentValues, // Keep existing values for reward, dates, etc.
        title: result.title,
        shortDescription: result.shortDescription,
        description: result.description,
        tasks: result.tasks,
      })
      toast({
        title: 'Campaign Drafted!',
        description: 'The campaign details have been filled in for you.',
      })
      setStep(1) // Move to the first step of the form
    } catch (e) {
      console.error('Error generating campaign:', e)
      toast({
        variant: 'destructive',
        title: 'AI Generation Failed',
        description: 'Could not generate the campaign. Please try again.',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const steps = [
    { id: 1, name: 'Details' },
    { id: 2, name: 'Tasks' },
    { id: 3, name: 'Rewards' },
    { id: 4, name: 'Review' },
  ]

  if (role !== 'host') {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Card className="bg-card border shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center flex items-center justify-center gap-2">
              <UserPlus /> Become a Host
            </CardTitle>
            <CardDescription className="text-center">
              Get the HOST_ROLE to start creating campaigns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="default" className="border-primary/20 bg-card mb-6">
              <Info className="h-4 w-4 text-primary" />
              <AlertTitle>Permissionless Hosting</AlertTitle>
              <AlertDescription>
                To create a campaign, you need the HOST_ROLE. You can grant this
                role to your connected wallet address yourself.
              </AlertDescription>
            </Alert>
            <div className="text-center">
              <p className="mb-4 text-muted-foreground">
                Click the button below to sign a transaction and grant yourself
                the HOST_ROLE.
              </p>
              <Button
                size="lg"
                onClick={handleBecomeHost}
                disabled={isBecomingHost || !isConnected}
              >
                {isBecomingHost ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                Get Host Role
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <Card className="bg-card border shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">
            Create New Campaign
          </CardTitle>
          <CardDescription className="text-center">
            Follow the steps to launch your next successful campaign.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step > 0 && (
            <div className="mb-8 flex justify-center">
              <ol className="flex items-center w-full max-w-2xl">
                {steps.map((s, index) => (
                  <li
                    key={s.id}
                    className={cn('flex w-full items-center', {
                      "after:content-[''] after:w-full after:h-1 after:border-b after:border-border after:border-4 after:inline-block":
                        index !== steps.length - 1,
                    })}
                  >
                    <span
                      className={cn(
                        'flex items-center justify-center w-10 h-10 rounded-full lg:h-12 lg:w-12 shrink-0 font-bold',
                        step > s.id
                          ? 'bg-primary text-primary-foreground'
                          : step === s.id
                          ? 'bg-primary/20 border-2 border-primary text-primary'
                          : 'bg-secondary'
                      )}
                    >
                      {step > s.id ? <Check className="w-6 h-6" /> : s.id}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {step === 0 && (
                <section className="space-y-6 animate-in fade-in-50">
                  <h2 className="text-xl font-semibold border-b pb-2 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" /> Generate with
                    AI
                  </h2>
                  <div className="p-6 border-dashed border-2 rounded-lg bg-secondary/50">
                    <p className="mb-1 text-sm font-medium">
                      Describe your project
                    </p>
                    <Textarea
                      placeholder="E.g., 'My project is a decentralized lending protocol on Sepolia that allows users to borrow against their NFTs...'"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      rows={4}
                      className="bg-card"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Our AI will draft a campaign title, description, and tasks
                      for you.
                    </p>
                    <div className="flex justify-end gap-4 mt-4">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setStep(1)}
                      >
                        Skip &amp; Create Manually
                      </Button>
                      <Button
                        type="button"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                      >
                        {isGenerating && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Generate Campaign
                      </Button>
                    </div>
                  </div>
                </section>
              )}
              {step === 1 && (
                <section className="space-y-6 animate-in fade-in-50">
                  <h2 className="text-xl font-semibold border-b pb-2">
                    {steps[0].name}
                  </h2>
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="E.g., Awesome Project Token Launch"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="shortDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Short Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="A brief, catchy description for the campaign card."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Detailed Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Explain your campaign in detail for the main page."
                            rows={5}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dates"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Campaign Duration</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={'outline'}
                                className={cn(
                                  'w-full justify-start text-left font-normal',
                                  !field.value?.from && 'text-muted-foreground'
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value?.from ? (
                                  field.value.to ? (
                                    <>
                                      {format(
                                        field.value.from,
                                        'LLL dd, y HH:mm'
                                      )}{' '}
                                      -{' '}
                                      {format(
                                        field.value.to,
                                        'LLL dd, y HH:mm'
                                      )}
                                    </>
                                  ) : (
                                    format(field.value.from, 'LLL dd, y HH:mm')
                                  )
                                ) : (
                                  <span>Pick a date range</span>
                                )}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="range"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                              numberOfMonths={2}
                            />
                            <div className="p-4 border-t grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="start-time-h">Start Time</Label>
                                <div className="flex gap-2">
                                  <Input
                                    type="number"
                                    id="start-time-h"
                                    min="0"
                                    max="23"
                                    className="w-16"
                                    placeholder="HH"
                                    value={dates?.from?.getHours() ?? 0}
                                    onChange={(e) => {
                                      const newHour = parseInt(
                                        e.target.value,
                                        10
                                      )
                                      if (!isNaN(newHour))
                                        field.onChange({
                                          ...dates,
                                          from: setHours(
                                            dates.from ?? new Date(),
                                            newHour
                                          ),
                                        })
                                    }}
                                  />
                                  <Input
                                    type="number"
                                    id="start-time-m"
                                    min="0"
                                    max="59"
                                    className="w-16"
                                    placeholder="MM"
                                    value={dates?.from?.getMinutes() ?? 0}
                                    onChange={(e) => {
                                      const newMin = parseInt(
                                        e.target.value,
                                        10
                                      )
                                      if (!isNaN(newMin))
                                        field.onChange({
                                          ...dates,
                                          from: setMinutes(
                                            dates.from ?? new Date(),
                                            newMin
                                          ),
                                        })
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="end-time-h">End Time</Label>
                                <div className="flex gap-2">
                                  <Input
                                    type="number"
                                    id="end-time-h"
                                    min="0"
                                    max="23"
                                    className="w-16"
                                    placeholder="HH"
                                    value={dates?.to?.getHours() ?? 0}
                                    onChange={(e) => {
                                      const newHour = parseInt(
                                        e.target.value,
                                        10
                                      )
                                      if (!isNaN(newHour))
                                        field.onChange({
                                          ...dates,
                                          to: setHours(
                                            dates.to ?? new Date(),
                                            newHour
                                          ),
                                        })
                                    }}
                                  />
                                  <Input
                                    type="number"
                                    id="end-time-m"
                                    min="0"
                                    max="59"
                                    className="w-16"
                                    placeholder="MM"
                                    value={dates?.to?.getMinutes() ?? 0}
                                    onChange={(e) => {
                                      const newMin = parseInt(
                                        e.target.value,
                                        10
                                      )
                                      if (!isNaN(newMin))
                                        field.onChange({
                                          ...dates,
                                          to: setMinutes(
                                            dates.to ?? new Date(),
                                            newMin
                                          ),
                                        })
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Image URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://example.com/image.png"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          A visually appealing image for your campaign card.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </section>
              )}

              {step === 2 && (
                <section className="space-y-6 animate-in fade-in-50">
                  <h2 className="text-xl font-semibold border-b pb-2">
                    {steps[1].name}
                  </h2>

                  {/* Discord Bot Warning - Show if Discord tasks exist but bot URL is not configured */}
                  {tasks.some((task) => task.type === 'JOIN_DISCORD') &&
                    !config.discordBotInviteUrl && (
                      <Alert
                        variant="destructive"
                        className="border-red-200 bg-red-50"
                      >
                        <Bot className="h-4 w-4" />
                        <AlertTitle>Discord Bot Not Configured</AlertTitle>
                        <AlertDescription>
                          You have Discord join tasks but the bot invite URL is
                          not configured. Discord verification will not work
                          until the bot is properly set up. Please contact
                          support to configure the Discord bot.
                        </AlertDescription>
                      </Alert>
                    )}

                  {/* Telegram Bot Warning - Show if Telegram tasks exist but bot username is not configured */}
                  {tasks.some((task) => task.type === 'JOIN_TELEGRAM') &&
                    !config.telegramBotUsername && (
                      <Alert
                        variant="destructive"
                        className="border-orange-200 bg-orange-50"
                      >
                        <Bot className="h-4 w-4" />
                        <AlertTitle>Telegram Bot Not Configured</AlertTitle>
                        <AlertDescription>
                          You have Telegram join tasks but the bot username is
                          not configured. Telegram verification will not work
                          until the bot is properly set up. Please contact
                          support to configure the Telegram bot.
                        </AlertDescription>
                      </Alert>
                    )}

                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex flex-col gap-4 p-4 border rounded-md"
                    >
                      <div className="flex gap-4 items-start">
                        <FormField
                          control={form.control}
                          name={`tasks.${index}.type`}
                          render={({ field }) => (
                            <FormItem className="w-1/3">
                              <FormLabel>Type</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select task type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {TASK_TYPE_OPTIONS.map((opt) => (
                                    <SelectItem
                                      key={opt.value}
                                      value={opt.value}
                                    >
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`tasks.${index}.description`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={`E.g., Follow @project on X`}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-8 text-muted-foreground hover:text-destructive"
                          onClick={() => remove(index)}
                          disabled={fields.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove Task</span>
                        </Button>
                      </div>
                      {tasks[index].type === 'JOIN_DISCORD' && (
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name={`tasks.${index}.verificationData`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Discord Server ID</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., 1024849645714206720"
                                    {...field}
                                    value={field.value ?? ''}
                                  />
                                </FormControl>
                                <FormDescription>
                                  The Discord server ID used for verification
                                  purposes.
                                </FormDescription>
                                <details className="mt-2">
                                  <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                    How to get your Discord Server ID
                                  </summary>
                                  <div className="mt-2 text-xs space-y-1 text-muted-foreground">
                                    <p>
                                      1. Enable Developer Mode in Discord
                                      Settings → Advanced → Developer Mode
                                    </p>
                                    <p>2. Right-click your server name</p>
                                    <p>3. Click "Copy Server ID"</p>
                                  </div>
                                </details>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`tasks.${index}.discordInviteLink`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Discord Invite Link</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., https://discord.gg/yourcode or just 'yourcode'"
                                    {...field}
                                    value={field.value ?? ''}
                                  />
                                </FormControl>
                                <FormDescription>
                                  The invite link participants will use to join
                                  your Discord server
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Discord Bot Setup Instructions */}
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                            <div className="flex items-center gap-2 text-blue-800">
                              <Bot className="h-5 w-5" />
                              <h4 className="font-semibold">
                                Required: Add DappDrop Bot to Your Server
                              </h4>
                            </div>
                            <p className="text-sm text-blue-700">
                              To enable automatic verification of Discord join
                              tasks, you must add our bot to your Discord
                              server.
                            </p>
                            <div className="flex flex-col gap-2">
                              {config.discordBotInviteUrl ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-fit bg-white border-blue-300 text-blue-700 hover:bg-blue-50"
                                  onClick={() =>
                                    window.open(
                                      config.discordBotInviteUrl!,
                                      '_blank'
                                    )
                                  }
                                >
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Add DappDrop Bot to Server
                                </Button>
                              ) : (
                                <p className="text-sm text-blue-600 font-medium">
                                  Discord bot invite URL not configured. Please
                                  contact support.
                                </p>
                              )}
                              <div className="text-xs text-blue-600 space-y-1">
                                <p>
                                  <strong>Required Permissions:</strong>
                                </p>
                                <ul className="list-disc list-inside ml-2 space-y-0.5">
                                  <li>View Server Members</li>
                                  <li>Read Message History</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {tasks[index].type === 'JOIN_TELEGRAM' && (
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name={`tasks.${index}.verificationData`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Telegram Channel/Group ID</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., @yourchannel or -100123456789"
                                    {...field}
                                    value={field.value ?? ''}
                                  />
                                </FormControl>
                                <FormDescription>
                                  The Telegram channel/group ID or username
                                  (with @) used for verification
                                </FormDescription>
                                <details className="mt-2">
                                  <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                    How to get your Telegram Channel/Group ID
                                  </summary>
                                  <div className="mt-2 text-xs space-y-1 text-muted-foreground">
                                    <p>
                                      <strong>
                                        For Channels with username:
                                      </strong>{' '}
                                      Use @channelname
                                    </p>
                                    <p>
                                      <strong>
                                        For Groups/Channels without username:
                                      </strong>
                                    </p>
                                    <p>
                                      1. Add @userinfobot to your group/channel
                                    </p>
                                    <p>2. The bot will show the chat ID</p>
                                    <p>3. Use the ID (starts with -100)</p>
                                  </div>
                                </details>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`tasks.${index}.telegramInviteLink`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Telegram Invite Link</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., https://t.me/yourchannel or https://t.me/+invitecode"
                                    {...field}
                                    value={field.value ?? ''}
                                  />
                                </FormControl>
                                <FormDescription>
                                  The invite link participants will use to join
                                  your Telegram channel/group
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Telegram Bot Setup Instructions */}
                          <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg space-y-3">
                            <div className="flex items-center gap-2 text-sky-800">
                              <Bot className="h-5 w-5" />
                              <h4 className="font-semibold">
                                Required: Add DappDrop Bot to Your Channel/Group
                              </h4>
                            </div>
                            <p className="text-sm text-sky-700">
                              To enable automatic verification of Telegram join
                              tasks, you must add our bot to your Telegram
                              channel/group.
                            </p>
                            <div className="flex flex-col gap-2">
                              {config.telegramBotUsername ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-fit bg-white border-sky-300 text-sky-700 hover:bg-sky-50"
                                  onClick={() =>
                                    window.open(
                                      `https://t.me/${config.telegramBotUsername}`,
                                      '_blank'
                                    )
                                  }
                                >
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Add @{config.telegramBotUsername} to
                                  Channel/Group
                                </Button>
                              ) : (
                                <p className="text-sm text-sky-600 font-medium">
                                  Telegram bot username not configured. Please
                                  contact support.
                                </p>
                              )}
                              <div className="text-xs text-sky-600 space-y-1">
                                <p>
                                  <strong>Required Permissions:</strong>
                                </p>
                                <ul className="list-disc list-inside ml-2 space-y-0.5">
                                  <li>Read Messages</li>
                                  <li>See Members List (for groups)</li>
                                </ul>
                                <p className="mt-2">
                                  <strong>Note:</strong> For channels, make sure
                                  the bot is added as an admin. For groups, it
                                  can be a regular member.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({
                        type: 'SOCIAL_FOLLOW',
                        description: '',
                        verificationData: '',
                        discordInviteLink: '',
                        telegramInviteLink: '',
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Task
                  </Button>
                </section>
              )}

              {step === 3 && (
                <section className="space-y-6 animate-in fade-in-50">
                  <h2 className="text-xl font-semibold border-b pb-2">
                    {steps[2].name}
                  </h2>
                  <FormField
                    control={form.control}
                    name="reward.type"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Reward Type</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="ERC20" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                ERC20 Token (Fungible)
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="ERC721" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                ERC721 Token (NFT)
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="None" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                None (Text description)
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {rewardType !== 'None' && (
                    <FormField
                      control={form.control}
                      name="reward.tokenAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Token Contract Address</FormLabel>
                          <FormControl>
                            <Input placeholder="0x..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {rewardType === 'ERC20' && (
                    <FormField
                      control={form.control}
                      name="reward.amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount per Participant</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="1000"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {rewardType === 'None' && (
                    <FormField
                      control={form.control}
                      name="reward.name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reward Description</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., A special role in our Discord"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </section>
              )}

              {step === 4 && (
                <section className="space-y-6 animate-in fade-in-50">
                  <h2 className="text-xl font-semibold border-b pb-2">
                    {steps[3].name} &amp; Create
                  </h2>
                  <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-6">
                    <h3 className="font-semibold text-lg">
                      {form.getValues('title')}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {form.getValues('shortDescription')}
                    </p>
                    <div className="text-sm">
                      <strong>Reward:</strong>{' '}
                      {form.getValues('reward.type') === 'ERC20'
                        ? `${form.getValues(
                            'reward.amount'
                          )} tokens from contract `
                        : form.getValues('reward.type') === 'ERC721'
                        ? `1 NFT from contract `
                        : `${(form.getValues('reward') as any).name}`}
                      {form.getValues('reward.type') !== 'None' && (
                        <code className="text-xs bg-muted p-1 rounded">
                          {(form.getValues('reward') as any).tokenAddress}
                        </code>
                      )}
                    </div>
                    <div className="text-sm">
                      <strong>Tasks:</strong>
                      <ul className="list-disc pl-5 mt-1 space-y-1">
                        {form.getValues('tasks').map((task, i) => (
                          <li key={i}>
                            [
                            {
                              TASK_TYPE_OPTIONS.find(
                                (t) => t.value === task.type
                              )?.label
                            }
                            ] {task.description}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Campaign Mode Selection */}
                    <div className="mt-6 p-4 border rounded-lg bg-muted/30">
                      <h3 className="font-medium mb-3">Campaign Activation</h3>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="createMode"
                            value="activate"
                            checked={createMode === 'activate'}
                            onChange={(e) => setCreateMode('activate')}
                            className="text-primary focus:ring-primary"
                          />
                          <div>
                            <span className="font-medium">
                              Create & Activate
                            </span>
                            <p className="text-xs text-muted-foreground">
                              Campaign becomes active immediately (recommended)
                            </p>
                          </div>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="createMode"
                            value="draft"
                            checked={createMode === 'draft'}
                            onChange={(e) => setCreateMode('draft')}
                            className="text-primary focus:ring-primary"
                          />
                          <div>
                            <span className="font-medium">Create as Draft</span>
                            <p className="text-xs text-muted-foreground">
                              Campaign stays in draft mode until manually opened
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>

                    <p className="text-xs pt-4 text-center text-muted-foreground">
                      {createMode === 'activate'
                        ? 'Your campaign will be created and become active based on your selected dates.'
                        : 'Your campaign will be created in draft mode. You will need to open it manually for participants to join.'}
                    </p>
                  </div>
                </section>
              )}

              {step > 0 && (
                <div className="flex justify-between pt-4 mt-8 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    disabled={step === 1}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>

                  {step < 4 ? (
                    <Button type="button" onClick={nextStep}>
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={isLoading}>
                      {isLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create Campaign
                    </Button>
                  )}
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
