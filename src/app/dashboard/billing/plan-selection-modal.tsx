

'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PlanID = 'basic' | 'growth' | 'pro';
export interface Plan {
    id: PlanID;
    billingFrequency: 'monthly' | 'annually';
}

export const plansData = [
    { id: 'basic' as PlanID, name: 'Basic', price: { monthly: 99, annually: 99 * 12 * 0.8 }, features: ['Up to 100 members', '1 facility', 'Basic booking & analytics'] },
    { id: 'growth' as PlanID, name: 'Growth', price: { monthly: 199, annually: 199 * 12 * 0.8 }, features: ['Up to 400 members', 'Advanced booking', 'Payments & advanced analytics'] },
    { id: 'pro' as PlanID, name: 'Pro', price: { monthly: 299, annually: 299 * 12 * 0.8 }, features: ['Up to 800 members', 'Staff roles', 'Priority support & marketing tools'] },
];

interface PlanSelectionModalProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    currentPlan: Plan;
    onConfirm: (plan: Plan) => void;
}

export function PlanSelectionModal({ isOpen, setIsOpen, currentPlan, onConfirm }: PlanSelectionModalProps) {
    const [selectedPlan, setSelectedPlan] = React.useState<Plan>(currentPlan);

    React.useEffect(() => {
        setSelectedPlan(currentPlan);
    }, [currentPlan]);

    const handleConfirm = () => {
        onConfirm(selectedPlan);
        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Change Your Plan</DialogTitle>
                    <DialogDescription>Select the plan and billing frequency that best fits your needs.</DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                    <div className="flex justify-center items-center space-x-4">
                        <Label htmlFor="billing-toggle">Monthly</Label>
                        <Switch 
                            id="billing-toggle" 
                            checked={selectedPlan.billingFrequency === 'annually'} 
                            onCheckedChange={(checked) => setSelectedPlan(prev => ({ ...prev, billingFrequency: checked ? 'annually' : 'monthly' }))} 
                        />
                        <Label htmlFor="billing-toggle">Annually (Save 20%)</Label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        {plansData.map(p => (
                            <Card 
                                key={p.id} 
                                className={cn('flex flex-col cursor-pointer', selectedPlan.id === p.id ? 'border-primary ring-2 ring-primary' : '')}
                                onClick={() => setSelectedPlan(prev => ({ ...prev, id: p.id }))}
                            >
                                <CardHeader>
                                    <CardTitle>{p.name}</CardTitle>
                                    <div>
                                        <span className="text-4xl font-bold">${selectedPlan.billingFrequency === 'monthly' ? p.price.monthly : Math.round(p.price.annually / 12)}</span>
                                        <span className="text-muted-foreground">/mo</span>
                                    </div>
                                    {selectedPlan.billingFrequency === 'annually' && (
                                        <p className="text-sm text-muted-foreground">Billed as ${p.price.annually.toFixed(0)}/year</p>
                                    )}
                                </CardHeader>
                                <CardContent className="flex flex-col flex-grow">
                                    <ul className="space-y-2 flex-grow">
                                        {p.features.map(feature => (
                                            <li key={feature} className="flex items-start gap-2 text-sm">
                                                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                                <span className="text-muted-foreground">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={selectedPlan.id === currentPlan.id && selectedPlan.billingFrequency === currentPlan.billingFrequency}>
                        Confirm Change
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

    

    