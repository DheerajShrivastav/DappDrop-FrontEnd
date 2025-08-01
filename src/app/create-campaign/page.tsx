'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addDays, format } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/context/wallet-provider';
import React from 'react';
import type { TaskType } from '@/lib/types';
import { createCampaign } from '@/lib/web3-service';

const taskSchema = z.object({
  type: z.enum(['SOCIAL_FOLLOW', 'JOIN_DISCORD', 'RETWEET', 'ONCHAIN_TX']),
  description: z.string().min(3, 'Task description must be at least 3 characters long.'),
});

const campaignSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters long.'),
  shortDescription: z.string().min(10, 'Short description must be at least 10 characters long.'),
  description: z.string().min(50, 'Detailed description must be at least 50 characters long.'),
  dates: z.object({
    from: z.date({ required_error: 'Start date is required.' }),
    to: z.date({ required_error: 'End date is required.' }),
  }).refine(data => data.from < data.to, {
    message: "End date must be after the start date.",
    path: ["to"],
  }),
  imageUrl: z.string().url('Please enter a valid image URL.'),
  tasks: z.array(taskSchema).min(1, 'At least one task is required.'),
  reward: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('ERC20'),
      tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Please enter a valid Ethereum address.'),
      amount: z.string().min(1, "Amount is required for ERC20 tokens."),
    }),
    z.object({
      type: z.literal('ERC721'),
      tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Please enter a valid Ethereum address.'),
    }),
  ]),
});

type CampaignFormValues = z.infer<typeof campaignSchema>;

const TASK_TYPE_OPTIONS: { value: TaskType, label: string }[] = [
    { value: 'SOCIAL_FOLLOW', label: 'Social Follow' },
    { value: 'JOIN_DISCORD', label: 'Join Discord/Telegram' },
    { value: 'RETWEET', label: 'Retweet Post' },
    { value: 'ONCHAIN_TX', label: 'On-chain Action' },
]

export default function CreateCampaignPage() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { address, isConnected, role } = useWallet();

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      title: '',
      shortDescription: '',
      description: '',
      dates: {
        from: new Date(),
        to: addDays(new Date(), 7),
      },
      imageUrl: `https://placehold.co/600x400`,
      tasks: [{ type: 'SOCIAL_FOLLOW', description: '' }],
      reward: { type: 'ERC20', tokenAddress: '', amount: '' },
    },
    mode: 'onChange',
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "tasks",
  });

  const rewardType = form.watch('reward.type');

  React.useEffect(() => {
    if (role !== 'host') {
        toast({ variant: 'destructive', title: 'Unauthorized', description: 'You must be a host to create a campaign.' });
        router.push('/');
    }
  }, [role, router, toast]);

  const onSubmit = async (data: CampaignFormValues) => {
    if (!isConnected || !address) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please connect your wallet to create a campaign.' });
      return;
    }
    setIsLoading(true);
    try {
      const campaignId = await createCampaign(data);
      toast({ title: 'Success!', description: `Your campaign (ID: ${campaignId}) has been created and is in Draft status.` });
      router.push(`/campaign/${campaignId}`);
    } catch(e) {
      // Error toast is handled in the service
    } finally {
      setIsLoading(false);
    }
  };
  
  const nextStep = async () => {
    let fieldsToValidate: (keyof CampaignFormValues)[] | `tasks.${number}.${"description"|"type"}`[] | `reward.${"type"|"tokenAddress"|"amount"}`[] = [];
    if(step === 1) fieldsToValidate = ['title', 'shortDescription', 'description', 'dates', 'imageUrl'];
    if(step === 2) fieldsToValidate = ['tasks'];
    if(step === 3) fieldsToValidate = ['reward'];
    
    const isValid = await form.trigger(fieldsToValidate as any);
    if(isValid) setStep(s => s + 1);
  }

  const prevStep = () => setStep(s => s - 1);

  const steps = [
    { id: 1, name: 'Details' },
    { id: 2, name: 'Tasks' },
    { id: 3, name: 'Rewards' },
    { id: 4, name: 'Review' }
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Create New Airdrop Campaign</CardTitle>
          <CardDescription className="text-center">Follow the steps to launch your next successful campaign.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="mb-8 flex justify-center">
                <ol className="flex items-center w-full max-w-2xl">
                    {steps.map((s, index) => (
                        <li key={s.id} className={cn("flex w-full items-center", { "after:content-[''] after:w-full after:h-1 after:border-b after:border-border after:border-4 after:inline-block": index !== steps.length - 1 })}>
                            <span className={cn("flex items-center justify-center w-10 h-10 rounded-full lg:h-12 lg:w-12 shrink-0", step > s.id ? 'bg-primary text-primary-foreground' : step === s.id ? 'bg-accent text-accent-foreground' : 'bg-secondary')}>
                                {step > s.id ? <ChevronRight className="w-6 h-6" /> : s.id}
                            </span>
                        </li>
                    ))}
                </ol>
            </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {step === 1 && (
                <section className="space-y-6 animate-in fade-in-50">
                   <h2 className="text-xl font-semibold border-b pb-2">{steps[0].name}</h2>
                   <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem><FormLabel>Campaign Title</FormLabel><FormControl><Input placeholder="E.g., Awesome Project Token Launch" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                   <FormField control={form.control} name="shortDescription" render={({ field }) => (
                    <FormItem><FormLabel>Short Description</FormLabel><FormControl><Textarea placeholder="A brief, catchy description for the campaign card." {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Detailed Description</FormLabel><FormControl><Textarea placeholder="Explain your campaign in detail for the main page." rows={5} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="dates" render={({ field }) => (
                      <FormItem className="flex flex-col"><FormLabel>Campaign Duration</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value.from && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value?.from ? (field.value.to ? (<>{format(field.value.from, "LLL dd, y")} - {format(field.value.to, "LLL dd, y")}</>) : (format(field.value.from, "LLL dd, y"))) : (<span>Pick a date range</span>)}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start"><Calendar mode="range" selected={field.value} onSelect={field.onChange} initialFocus numberOfMonths={2} /></PopoverContent>
                        </Popover><FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField control={form.control} name="imageUrl" render={({ field }) => (
                    <FormItem><FormLabel>Image URL</FormLabel><FormControl><Input placeholder="https://example.com/image.png" {...field} /></FormControl><FormDescription>A visually appealing image for your campaign card.</FormDescription><FormMessage /></FormItem>
                  )} />
                </section>
              )}

              {step === 2 && (
                 <section className="space-y-6 animate-in fade-in-50">
                    <h2 className="text-xl font-semibold border-b pb-2">{steps[1].name}</h2>
                    {fields.map((field, index) => (
                        <div key={field.id} className="flex gap-4 items-start p-4 border rounded-md">
                             <FormField control={form.control} name={`tasks.${index}.type`} render={({ field }) => (
                                <FormItem className="w-1/3"><FormLabel>Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select task type" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {TASK_TYPE_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                <FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name={`tasks.${index}.description`} render={({ field }) => (
                                <FormItem className="flex-1"><FormLabel>Description</FormLabel><FormControl><Input placeholder={`E.g., Follow @project on X`} {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <Button type="button" variant="ghost" size="icon" className="mt-8 text-muted-foreground" onClick={() => remove(index)} disabled={fields.length <= 1}>
                                <Trash2 className="h-4 w-4" /><span className="sr-only">Remove Task</span>
                            </Button>
                        </div>
                    ))}
                     <Button type="button" variant="outline" size="sm" onClick={() => append({ type: 'SOCIAL_FOLLOW', description: "" })}>
                       <Plus className="mr-2 h-4 w-4" /> Add Task
                    </Button>
                </section>
              )}

             {step === 3 && (
                <section className="space-y-6 animate-in fade-in-50">
                    <h2 className="text-xl font-semibold border-b pb-2">{steps[2].name}</h2>
                     <FormField control={form.control} name="reward.type" render={({ field }) => (
                        <FormItem className="space-y-3"><FormLabel>Reward Type</FormLabel>
                            <FormControl>
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                    <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="ERC20" /></FormControl><FormLabel className="font-normal">ERC20 Token (Fungible)</FormLabel></FormItem>
                                    <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="ERC721" /></FormControl><FormLabel className="font-normal">ERC721 Token (NFT)</FormLabel></FormItem>
                                </RadioGroup>
                            </FormControl><FormMessage />
                        </FormItem>
                     )}/>
                     <FormField control={form.control} name="reward.tokenAddress" render={({ field }) => (
                        <FormItem><FormLabel>Token Contract Address</FormLabel><FormControl><Input placeholder="0x..." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    {rewardType === 'ERC20' && (
                        <FormField control={form.control} name="reward.amount" render={({ field }) => (
                            <FormItem><FormLabel>Amount per Participant</FormLabel><FormControl><Input type="number" placeholder="1000" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                    )}
                </section>
             )}

              {step === 4 && (
                <section className="space-y-6 animate-in fade-in-50">
                  <h2 className="text-xl font-semibold border-b pb-2">{steps[3].name} &amp; Create</h2>
                  <div className="space-y-4 rounded-lg border p-6 bg-secondary/50">
                    <h3 className="font-semibold text-lg">{form.getValues('title')}</h3>
                    <p className="text-sm text-muted-foreground">{form.getValues('shortDescription')}</p>
                    <div className="text-sm"><strong>Reward:</strong> {form.getValues('reward.type') === 'ERC20' ? `${form.getValues('reward.amount')} tokens` : '1 NFT'} from contract <code className="text-xs bg-muted p-1 rounded">{form.getValues('reward.tokenAddress')}</code></div>
                    <div className="text-sm"><strong>Tasks:</strong>
                      <ul className="list-disc pl-5 mt-1 space-y-1">
                        {form.getValues('tasks').map((task, i) => <li key={i}>[{TASK_TYPE_OPTIONS.find(t=>t.value === task.type)?.label}] {task.description}</li>)}
                      </ul>
                    </div>
                    <p className="text-xs pt-4 text-center text-muted-foreground">Clicking "Create Campaign" will prepare your campaign. You will need to open it for participants to join.</p>
                  </div>
                </section>
              )}

              <div className="flex justify-between pt-4">
                <Button type="button" variant="outline" onClick={prevStep} disabled={step === 1}>Previous</Button>
                
                {step < 4 ? (
                    <Button type="button" onClick={nextStep}>Next</Button>
                ) : (
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Campaign
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
