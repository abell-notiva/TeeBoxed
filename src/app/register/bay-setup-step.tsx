
'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWizardStore } from '@/hooks/use-wizard-store';
import { Trash2, PlusCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';

const formSchema = z.object({
  bays: z.array(z.object({
    name: z.string().min(1, 'Bay name is required'),
  })).min(1, 'At least one bay is required').max(20, 'You can add a maximum of 20 bays'),
});

type FormData = z.infer<typeof formSchema>;

export const BaySetupStep = () => {
  const { setStep, setBays, bays: initialBays } = useWizardStore();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bays: initialBays,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "bays"
  });

  const onSubmit = (data: FormData) => {
    setBays(data.bays);
    setStep(5);
  };

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
                <CardContent className="pt-6">
                    <div className="space-y-4">
                        {fields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-2">
                            <FormField
                            control={form.control}
                            name={`bays.${index}.name`}
                            render={({ field }) => (
                                <FormItem className="flex-grow">
                                    <FormControl>
                                        <Input 
                                            {...field}
                                            placeholder={`Bay ${index + 1} Name`} 
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
                                onClick={() => remove(index)}
                                disabled={fields.length <= 1}
                                className="text-muted-foreground hover:text-destructive"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        ))}
                    </div>
                     {form.formState.errors.bays && !form.formState.errors.bays.root && (
                        <p className="text-sm text-destructive mt-2">{form.formState.errors.bays.message}</p>
                     )}
                     {form.formState.errors.bays?.root && (
                        <p className="text-sm text-destructive mt-2">{form.formState.errors.bays.root.message}</p>
                     )}
                </CardContent>
            </Card>

            <Button
                type="button"
                variant="outline"
                onClick={() => append({ name: `Bay ${fields.length + 1}` })}
                disabled={fields.length >= 20}
                className="w-full"
                >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Bay
            </Button>
            
            <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(3)}>Back</Button>
                <Button type="submit">Next: Review</Button>
            </div>
        </form>
    </Form>
  );
};
