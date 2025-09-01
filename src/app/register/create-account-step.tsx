
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWizardStore } from '@/hooks/use-wizard-store';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const formSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  passcode: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof formSchema>;

export const CreateAccountStep = () => {
  const { setStep, setAccountData, account } = useWizardStore();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        fullName: account.fullName,
        email: account.email,
        password: account.password,
        confirmPassword: account.password,
        passcode: '',
    }
  });

  const onSubmit = (data: FormData) => {
    // A real app would validate the passcode against a secure source.
    if (data.passcode !== 'TeeBoxedDev') {
        form.setError('passcode', { message: 'Invalid passcode.' });
        return;
    }
    
    // Just save to state, don't create user here
    const { confirmPassword, passcode, ...accountData } = data;
    setAccountData(accountData);
    setStep(2);
  };

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {error && (
            <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Heads up!</AlertTitle>
            <AlertDescription>
                {error}
            </AlertDescription>
            </Alert>
        )}
        <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl><Input {...field} placeholder="John Smith" /></FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
        <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl><Input type="email" {...field} placeholder="you@company.com" /></FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
        <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl><Input type="password" {...field} /></FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
        <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl><Input type="password" {...field} /></FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
         <FormField
            control={form.control}
            name="passcode"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Dev Passcode</FormLabel>
                <FormControl><Input type="password" {...field} /></FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
        <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>{isLoading ? "Saving..." : "Next: Facility Details"}</Button>
        </div>
        </form>
    </Form>
  );
};
