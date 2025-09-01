
'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useWizardStore } from '@/hooks/use-wizard-store';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const plansData = [
    { id: 'basic' as const, name: 'Basic', price: { monthly: 99, annually: 99 * 12 * 0.8 }, features: ['Up to 100 members', '1 facility', 'Bookings, memberships, kiosk, billing', 'Basic analytics'] },
    { id: 'growth' as const, name: 'Growth', price: { monthly: 199, annually: 199 * 12 * 0.8 }, features: ['Up to 400 members', 'Up to 3 facilities', 'Everything in Basic', 'Advanced analytics'] },
    { id: 'pro' as const, name: 'Pro', price: { monthly: 299, annually: 299 * 12 * 0.8 }, features: ['Up to 800 members', 'Up to 10 facilities', 'Everything in Growth', 'Priority support & marketing tools'] },
];

export const PlanSelectionStep = () => {
  const { setStep, plan, setPlanData } = useWizardStore();
  const [billingFrequency, setBillingFrequency] = useState(plan.billingFrequency);

  const handlePlanSelect = (planId: 'basic' | 'growth' | 'pro') => {
    setPlanData({ id: planId, billingFrequency });
  };
  
  const handleBillingChange = (isAnnual: boolean) => {
    const newFrequency = isAnnual ? 'annually' : 'monthly';
    setBillingFrequency(newFrequency);
    // update plan in store as well
    setPlanData({ billingFrequency: newFrequency });
  };

  const onSubmit = () => {
    setStep(4);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-center items-center space-x-4">
        <Label htmlFor="billing-toggle">Monthly</Label>
        <Switch id="billing-toggle" checked={billingFrequency === 'annually'} onCheckedChange={handleBillingChange} />
        <Label htmlFor="billing-toggle">Annually (Save 20%)</Label>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:items-stretch">
        {plansData.map(p => (
          <Card 
            key={p.id} 
            className={cn('flex flex-col cursor-pointer', plan.id === p.id ? 'border-primary ring-2 ring-primary' : '')}
            onClick={() => handlePlanSelect(p.id)}
            >
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
                <div>
                  <span className="text-4xl font-bold">${billingFrequency === 'monthly' ? p.price.monthly : Math.round(p.price.annually / 12)}</span>
                  <span className="text-muted-foreground">/mo</span>
                   <p className="text-xs text-muted-foreground mt-1">
                    After your 7-day free trial.
                  </p>
                </div>
               {billingFrequency === 'annually' && (
                  <p className="text-sm text-muted-foreground">Billed as ${p.price.annually.toFixed(0)}/year</p>
                )}
            </CardHeader>
            <CardContent className="flex flex-col flex-grow">
              <ul className="space-y-4 flex-grow">
                {p.features.map(feature => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                    <span className="text-muted-foreground text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
        
      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button>
        <Button type="button" onClick={onSubmit}>Next: Bay Setup</Button>
      </div>
    </div>
  );
};
