
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/context/wallet-provider';
import { grantHostRole } from '@/lib/web3-service';

const hostRoleSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Please enter a valid Ethereum address.'),
});

type HostRoleFormValues = z.infer<typeof hostRoleSchema>;

export default function AdminPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { isConnected, isSuperAdmin, address } = useWallet();
  const router = useRouter();
  
  useEffect(() => {
    if (!isConnected) {
        toast({
            variant: 'destructive',
            title: 'Unauthorized',
            description: 'Please connect your wallet to view this page.'
        });
      router.push('/');
      return;
    }
    if (!isSuperAdmin) {
         toast({
            variant: 'destructive',
            title: 'Unauthorized',
            description: 'You do not have permission to view this page.'
        });
      router.push('/');
    }
  }, [isConnected, isSuperAdmin, router, toast]);


  const form = useForm<HostRoleFormValues>({
    resolver: zodResolver(hostRoleSchema),
    defaultValues: {
      address: '',
    },
    mode: 'onChange',
  });

  const onSubmit = async (data: HostRoleFormValues) => {
    if (!isConnected) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please connect your wallet.' });
      return;
    }
    setIsLoading(true);
    try {
        await grantHostRole(data.address);
        // The success toast is now handled in the grantHostRole function
        form.reset();
    } catch(e) {
      // Error toast is handled in the web3-service
    } finally {
      setIsLoading(false);
    }
  };

  // Render a loading state or access denied message while checking role
  if (!isSuperAdmin) {
    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <Alert variant="destructive">
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>
                    You are not authorized to view this page. Please connect as the contract administrator.
                </AlertDescription>
            </Alert>
        </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-lg">
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Admin Panel</CardTitle>
          <CardDescription className="text-center">Grant Host Role to an Address</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ethereum Address</FormLabel>
                    <FormControl>
                      <Input placeholder="0x..." {...field} />
                    </FormControl>
                    <FormDescription>
                      The address to be granted the HOST_ROLE.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading || !isConnected} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Grant Host Role
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
