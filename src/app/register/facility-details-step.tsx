
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWizardStore } from '@/hooks/use-wizard-store';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffect } from 'react';
import debounce from 'lodash.debounce';

const timezones = [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Anchorage', 'America/Honolulu'
];

const countries = ['USA', 'Canada'];

// Debounced function to check slug uniqueness against the new API endpoint
const checkSlugUniqueness = debounce(async (slug, resolve) => {
    if (!slug) {
        resolve(true);
        return;
    }
    try {
        const response = await fetch(`/api/facilities/check-slug?slug=${slug}`);
        const data = await response.json();
        resolve(data.ok);
    } catch (error) {
        console.error("Error checking slug uniqueness:", error);
        resolve(true); // Default to true on API error to avoid blocking user
    }
}, 300);


const formSchema = z.object({
  name: z.string().min(1, 'Facility name is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  timeZone: z.string().min(1, 'Time zone is required'),
  slug: z.string()
    .min(3, 'URL must be at least 3 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'URL can only contain lowercase letters, numbers, and hyphens.')
    .superRefine((slug, ctx) => {
        return new Promise<void>((resolve) => {
            checkSlugUniqueness(slug, (isUnique: boolean) => {
                if (!isUnique) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "This facility URL is already taken. Please choose another.",
                    });
                }
                resolve();
            });
        });
    }),
});

type FormData = z.infer<typeof formSchema>;

const generateSlug = (name: string) =>
  (name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');

export const FacilityDetailsStep = () => {
  const { setStep, setFacilityData, facility } = useWizardStore();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: facility,
    mode: 'onBlur', // Validate on blur to accommodate debounced validation
  });

  const watchName = form.watch('name');
  
  useEffect(() => {
    const newSlug = generateSlug(watchName);
    if (newSlug !== form.getValues('slug')) {
        form.setValue('slug', newSlug, { shouldValidate: true });
    }
    return () => {
      checkSlugUniqueness.cancel();
    };
  }, [watchName, form]);


  const onSubmit = (data: FormData) => {
    setFacilityData(data);
    setStep(3);
  };

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Facility Name</FormLabel>
                    <FormControl><Input {...field} placeholder="Example Golf Center" /></FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Facility URL</FormLabel>
                    <FormControl>
                        <div className="flex items-center">
                            <Input {...field} className="rounded-r-none" />
                            <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-l-0 border-gray-300 rounded-r-md h-10">
                            .teeboxed.com
                            </span>
                        </div>
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            
             <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Street Address (Optional)</FormLabel>
                    <FormControl><Input {...field} placeholder="123 Main Street" /></FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem><FormLabel>City (Optional)</FormLabel><FormControl><Input {...field} placeholder="Anytown" /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="state" render={({ field }) => (
                     <FormItem><FormLabel>State / Province (Optional)</FormLabel><FormControl><Input {...field} placeholder="CA" /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="zip" render={({ field }) => (
                    <FormItem><FormLabel>ZIP / Postal (Optional)</FormLabel><FormControl><Input {...field} placeholder="90210" /></FormControl><FormMessage /></FormItem>
                )}/>
            </div>
            
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Country</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select a country" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="timeZone"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Time Zone</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select a time zone" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {timezones.map(tz => <SelectItem key={tz} value={tz}>{tz.replace('America/', '').replace('_', ' ')}</SelectItem>)}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            

            <div className="flex justify-between pt-4">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button type="submit">Next: Select Plan</Button>
            </div>
        </form>
    </Form>
  );
};
