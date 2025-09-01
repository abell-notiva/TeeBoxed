
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, CheckCircle, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, writeBatch, doc, Timestamp } from 'firebase/firestore';
import { Logo } from '@/components/logo';
import { addMinutes, parse } from 'date-fns';

const guestBookingSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  marketingOptIn: z.boolean().default(false),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
});

type GuestBookingFormData = z.infer<typeof guestBookingSchema>;

interface Facility {
    id: string;
    name: string;
    slug: string;
}

interface Bay {
    id: string;
    name: string;
}

interface BookingFormProps {
    facility: Facility;
}

export function BookingForm({ facility }: BookingFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [availableBays, setAvailableBays] = useState<Bay[]>([]);
    const [pageLoading, setPageLoading] = useState(true);

    const form = useForm<GuestBookingFormData>({
        resolver: zodResolver(guestBookingSchema),
        defaultValues: { 
            fullName: '', 
            email: '', 
            phone: '', 
            marketingOptIn: false,
            date: new Date().toISOString().split('T')[0],
            time: '14:00',
        },
    });
    
     useEffect(() => {
        const getAvailableBays = async () => {
            if (!facility) return;
            setPageLoading(true);
            try {
                // Fetch available bays for the given facility
                const baysQuery = query(collection(db, `facilities/${facility.id}/bays`), where("status", "==", "available"), limit(1));
                const baysSnapshot = await getDocs(baysQuery);
                if (!baysSnapshot.empty) {
                    const baysData = baysSnapshot.docs.map(d => ({id: d.id, name: d.data().name}));
                    setAvailableBays(baysData);
                } else {
                     setError("We're sorry, there are no bays available for booking at this time.");
                }
            } catch (error) {
                console.error("Error fetching available bays:", error);
                setError("There was an error finding an available bay.");
            } finally {
                setPageLoading(false);
            }
        };

        getAvailableBays();
    }, [facility]);

    const onSubmit = async (data: GuestBookingFormData) => {
        if (!facility || availableBays.length === 0) {
            setError("Cannot submit booking: facility or available bay not found.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const batch = writeBatch(db);

            // 1. Create Guest Record
            const guestRef = doc(collection(db, 'guests'));
            batch.set(guestRef, {
                fullName: data.fullName,
                email: data.email,
                phone: data.phone || '',
                marketingOptIn: data.marketingOptIn,
                facilityId: facility.id,
                facilityName: facility.name,
                createdAt: serverTimestamp(),
                isMember: false,
            });
            
            // 2. Create Booking Record
            const bookingDate = parse(`${data.date} ${data.time}`, 'yyyy-MM-dd HH:mm', new Date());
            const startTime = Timestamp.fromDate(bookingDate);
            const endTime = Timestamp.fromDate(addMinutes(bookingDate, 60)); // Assume 1hr booking for guests
            const bayToBook = availableBays[0]; // Book the first available bay

            const bookingRef = doc(collection(db, `facilities/${facility.id}/bookings`));
            batch.set(bookingRef, {
                bayId: bayToBook.id,
                bayName: bayToBook.name,
                createdAt: serverTimestamp(),
                startTime: startTime,
                endTime: endTime,
                status: 'confirmed',
                // Using guest details for booking
                memberId: guestRef.id, // Associate booking with guest record
                memberName: data.fullName, 
                paymentStatus: 'unpaid', // Guest pays on arrival
            });
            
            // 3. Update Bay Status
            const bayRef = doc(db, `facilities/${facility.id}/bays`, bayToBook.id);
            batch.update(bayRef, { status: 'booked' });

            await batch.commit();

            setIsSubmitted(true);
        } catch (err: any) {
            setError("Failed to save booking. Please try again.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    if (pageLoading) {
        return (
             <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4">Finding an available bay at {facility.name}...</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-muted p-4 sm:p-6">
             <div className="absolute top-8 left-8">
                <Logo />
            </div>
            <Card className="w-full max-w-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight">Book as a Guest</CardTitle>
                    <CardDescription>
                        {isSubmitted ? "Thank you for your booking request!" : `You're booking a bay at ${facility?.name || 'our facility'}.`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isSubmitted ? (
                        <div className="text-center space-y-4 py-8">
                            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                            <h3 className="text-xl font-semibold">Your Booking is Almost Complete!</h3>
                            <p className="text-muted-foreground">
                                We've reserved a bay for you. Please proceed to the facility to complete payment and check-in.
                            </p>
                             <Card className="text-left bg-green-50 p-4 border-green-200 mt-6">
                                <CardHeader className="p-2">
                                    <CardTitle className="text-base">Want to save 20% on your next booking?</CardTitle>
                                </CardHeader>
                                <CardContent className="p-2">
                                    <p className="text-sm text-green-800">Become a member today to enjoy exclusive discounts and benefits!</p>
                                    <Button className="mt-4 w-full" variant="outline">View Membership Plans</Button>
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                {error && (
                                    <Alert variant="destructive">
                                    <Terminal className="h-4 w-4" />
                                    <AlertTitle>Request Failed</AlertTitle>
                                    <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}
                                
                                <Card>
                                    <CardHeader><CardTitle className="text-lg">Select Your Time</CardTitle></CardHeader>
                                    <CardContent className="grid grid-cols-2 gap-4">
                                         <FormField control={form.control} name="date" render={({ field }) => (
                                            <FormItem className="space-y-2">
                                                <FormLabel>Date</FormLabel>
                                                <FormControl><Input type="date" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                         )} />
                                          <FormField control={form.control} name="time" render={({ field }) => (
                                            <FormItem className="space-y-2">
                                                <FormLabel>Time</FormLabel>
                                                <FormControl><Input type="time" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                         )} />
                                    </CardContent>
                                </Card>
                                
                                <Card>
                                    <CardHeader><CardTitle className="text-lg">Your Information</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <FormField control={form.control} name="fullName" render={({ field }) => (
                                            <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} placeholder="Jane Doe" /></FormControl><FormMessage /></FormItem>
                                        )}/>
                                        <FormField control={form.control} name="email" render={({ field }) => (
                                            <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} placeholder="you@example.com" /></FormControl><FormMessage /></FormItem>
                                        )}/>
                                        <FormField control={form.control} name="phone" render={({ field }) => (
                                            <FormItem><FormLabel>Phone (Optional)</FormLabel><FormControl><Input {...field} placeholder="+1 555-555-5555" /></FormControl><FormMessage /></FormItem>
                                        )}/>
                                        <FormField control={form.control} name="marketingOptIn" render={({ field }) => (
                                             <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                <div className="space-y-1 leading-none">
                                                <FormLabel>I’d like to receive special offers and updates.</FormLabel>
                                                </div>
                                            </FormItem>
                                        )}/>
                                    </CardContent>
                                </Card>
                                
                                <Button type="submit" className="w-full" disabled={isLoading || !facility || availableBays.length === 0}>
                                    {isLoading ? 'Submitting...' : 'Request to Book'}
                                </Button>
                            </form>
                        </Form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
