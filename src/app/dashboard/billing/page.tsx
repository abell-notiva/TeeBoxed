
'use client';

import * as React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, Download, Edit, DollarSign, PlusCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlanSelectionModal, Plan, PlanID, plansData } from './plan-selection-modal';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { doc, getDoc, onSnapshot, query, collection, where, getDocs, updateDoc, Timestamp, writeBatch, serverTimestamp } from 'firebase/firestore';
import { format, addYears } from 'date-fns';
import Link from 'next/link';


interface Facility {
    id: string;
    name: string;
    plan: {
        id: PlanID;
        billingFrequency: 'monthly' | 'annually';
        isTrial: boolean;
        trialEndDate: Date;
        nextBillingDate: Date;
    };
    // Payment method data would be fetched securely from your backend (e.g. Stripe)
    // and not stored directly in Firestore.
    paymentMethod?: {
        last4: string;
        brand: string;
        expMonth: number;
        expYear: number;
    };
}

// In a real application, this data would come from your backend connected to Stripe.
const mockInvoices: any[] = [];


export default function BillingPage() {
    const router = useRouter();
    const [user, setUser] = React.useState<User | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [facilities, setFacilities] = React.useState<{id: string, name: string}[]>([]);
    const [selectedFacility, setSelectedFacility] = React.useState<string | null>(null);
    const [facility, setFacility] = React.useState<Facility | null>(null);
    const [isPlanModalOpen, setPlanModalOpen] = React.useState(false);

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUser(user);
            } else {
                router.push('/login');
            }
        });
        return () => unsubscribe();
    }, [router]);

    React.useEffect(() => {
        if (!user) return;

        const fetchFacilities = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, 'facilities'), where('ownerId', '==', user.uid));
                const querySnapshot = await getDocs(q);
                const userFacilities = querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name as string }));
                setFacilities(userFacilities);
                if (userFacilities.length > 0) {
                    setSelectedFacility(userFacilities[0].id);
                }
            } catch (error) {
                console.error('Error fetching facilities:', error);
            }
            setLoading(false);
        };
        fetchFacilities();
    }, [user]);

    React.useEffect(() => {
        if (!selectedFacility) return;

        const facilityRef = doc(db, 'facilities', selectedFacility);
        const unsubscribe = onSnapshot(facilityRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const planData = data.plan || {};
                setFacility({
                    id: docSnap.id,
                    name: data.name,
                    plan: {
                        id: planData.id || 'basic',
                        billingFrequency: planData.billingFrequency || 'monthly',
                        isTrial: planData.isTrial === true,
                        // Convert Timestamps to Dates
                        trialEndDate: planData.trialEndDate ? (planData.trialEndDate as Timestamp).toDate() : new Date(),
                        // A real implementation would calculate this based on Stripe subscription data
                        nextBillingDate: planData.nextBillingDate ? (planData.nextBillingDate as Timestamp).toDate() : new Date(new Date().setMonth(new Date().getMonth() + 1)),
                    },
                    // In a real app, you'd fetch this from your backend after getting the stripe customer ID
                    paymentMethod: { last4: '4242', brand: 'Visa', expMonth: 12, expYear: 2028 }
                });
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [selectedFacility]);


    const handleUpdatePlan = async (newPlan: Plan) => {
        if (!selectedFacility || !facility || !user || !user.displayName) return;
        
        const batch = writeBatch(db);
        
        const facilityRef = doc(db, 'facilities', selectedFacility);
        
        const isCurrentlyInTrial = facility.plan.isTrial && facility.plan.trialEndDate.getTime() > new Date().getTime();

        const updateData: any = {
            'plan.id': newPlan.id,
            'plan.billingFrequency': newPlan.billingFrequency,
        };

        if (!isCurrentlyInTrial) {
             updateData['plan.isTrial'] = false;
             updateData['plan.nextBillingDate'] = newPlan.billingFrequency === 'monthly' 
                ? new Date(new Date().setMonth(new Date().getMonth() + 1)) 
                : addYears(new Date(), 1);
        }
        
        batch.update(facilityRef, updateData);

        // Add audit log
        const logRef = doc(collection(db, `facilities/${selectedFacility}/auditLogs`));
        batch.set(logRef, {
            action: 'update',
            changedBy: user.displayName,
            changedById: user.uid,
            timestamp: serverTimestamp(),
            details: { 
                objectType: 'Billing Plan', 
                objectId: facility.id, 
                objectName: facility.name,
                source: 'Billing Page'
            },
            previousValue: {
                plan: facility.plan.id,
                billingFrequency: facility.plan.billingFrequency,
            },
            newValue: {
                plan: newPlan.id,
                billingFrequency: newPlan.billingFrequency,
            }
        });

        await batch.commit();
    };

    const handleUpdatePaymentMethod = () => {
        console.log("Updating payment method...");
        // TODO: Implement Stripe Checkout session to update payment details
        // This would redirect the user to a Stripe-hosted page
        alert("This would redirect to Stripe to update your payment method.");
    }
    
    if (loading) {
        return <div className="flex items-center justify-center h-screen"><p>Loading billing information...</p></div>;
    }
    
    if (facilities.length === 0 && !loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen space-y-4">
                <p className="text-muted-foreground">No facilities found. Create your first facility to get started.</p>
                <Button onClick={() => router.push('/register')}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create Facility
                </Button>
            </div>
        );
    }

    const trialDaysLeft = facility ? Math.ceil((facility.plan.trialEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const currentPlanDetails = facility ? plansData.find(p => p.id === facility.plan.id) : null;

    return (
        <div className="flex flex-col sm:gap-4 sm:py-4 flex-grow">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                <h1 className="text-xl font-semibold">Billing &amp; Subscription</h1>
                <div className="ml-auto flex items-center gap-2">
                    <Select value={selectedFacility ?? ""} onValueChange={setSelectedFacility}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Facility" />
                        </SelectTrigger>
                        <SelectContent>
                            {facilities.map(f => (
                                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </header>
            <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                {!facility ? (
                    <div className="flex items-center justify-center p-8">
                        <p className="text-muted-foreground">Select a facility to view billing information.</p>
                    </div>
                ) : (
                    <>
                        {facility.plan.isTrial && trialDaysLeft > 0 && (
                     <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
                        <CheckCircle className="h-4 w-4 !text-blue-600" />
                        <AlertTitle>You are on a free trial!</AlertTitle>
                        <AlertDescription>
                            You have <strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} left</strong>. You can upgrade to a paid plan at any time.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-8">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Current Plan</CardTitle>
                                    <CardDescription>Your subscription details for {facility.name}.</CardDescription>
                                </div>
                                <Button variant="outline" onClick={() => setPlanModalOpen(true)}>Change Plan</Button>
                            </CardHeader>
                            <CardContent className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground">Plan</p>
                                    <p className="text-lg font-semibold capitalize">{facility.plan.id}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                                    <div>
                                        <Badge variant={facility.plan.isTrial ? 'secondary' : 'default'}>
                                            {facility.plan.isTrial ? 'Trial' : 'Active'}
                                        </Badge>
                                    </div>
                                </div>
                                
                                {facility.plan.isTrial ? (
                                    <>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-muted-foreground">Trial Ends</p>
                                            <p className="font-semibold">
                                                {format(facility.plan.trialEndDate, 'PPP')}
                                            </p>
                                        </div>
                                         <div className="space-y-1">
                                            <p className="text-sm font-medium text-muted-foreground">Upcoming Price</p>
                                            <p className="font-semibold">
                                                {currentPlanDetails && (
                                                    facility.plan.billingFrequency === 'monthly' 
                                                        ? `$${currentPlanDetails.price.monthly}/mo`
                                                        : `$${currentPlanDetails.price.annually.toFixed(0)}/year`
                                                )}
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-muted-foreground">Billing Cycle</p>
                                            <p className="text-lg font-semibold capitalize">{facility.plan.billingFrequency}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-muted-foreground">Next Billing Date</p>
                                            <p className="font-semibold">
                                                {format(facility.plan.nextBillingDate, 'PPP')}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Payment Method</CardTitle>
                                    <CardDescription>Your primary payment method.</CardDescription>
                                </div>
                                <Button variant="outline" size="sm" onClick={handleUpdatePaymentMethod}>
                                    <Edit className="mr-2 h-3 w-3" /> Update
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {facility.paymentMethod ? (
                                    <div className="flex items-center gap-4 rounded-md border bg-muted/50 p-4">
                                        {/* In a real app, you might get the card brand image dynamically */}
                                        <p className="font-semibold">{facility.paymentMethod.brand}</p>
                                        <p className="font-mono">**** **** **** {facility.paymentMethod.last4}</p>
                                        <p className="ml-auto text-muted-foreground">
                                            Expires {facility.paymentMethod.expMonth}/{facility.paymentMethod.expYear}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center text-muted-foreground p-4 border rounded-md">
                                        No payment method on file.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Invoice History</CardTitle>
                            <CardDescription>Your past payments and receipts.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Invoice</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mockInvoices.length > 0 ? mockInvoices.map((invoice) => (
                                        <TableRow key={invoice.id}>
                                            <TableCell>{format(invoice.date, 'MMM d, yyyy')}</TableCell>
                                            <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                                            <TableCell><Badge variant="default">{invoice.status}</Badge></TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" asChild>
                                                    <a href={invoice.url} target="_blank" rel="noopener noreferrer">
                                                        <Download className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">
                                                No invoice history found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
                
                        <PlanSelectionModal 
                            isOpen={isPlanModalOpen}
                            setIsOpen={setPlanModalOpen}
                            currentPlan={facility.plan}
                            onConfirm={handleUpdatePlan}
                        />
                    </>
                )}
            </main>
        </div>
    );
}
