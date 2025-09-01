
'use client';

import { useState, useEffect, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Calendar, AlertCircle, Clock, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BayStatus, Bay } from './bay-status';
import { BookingCalendar, Booking, BookingFormData } from './booking-calendar';
import { Member } from '../members/members-table';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
    collection, 
    query, 
    onSnapshot, 
    where, 
    getDocs,
    Timestamp,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
    writeBatch,
    orderBy,
    getDoc,
} from 'firebase/firestore';
import { addMinutes, format, parse } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';


interface FacilitySettings {
    maxConcurrentBookings?: number;
    businessHours?: {
      [day: string]: { open: string; close: string; isOpen: boolean };
    };
}

interface Facility {
    id: string;
    name: string;
    slug: string;
    settings?: FacilitySettings;
}

function BookingsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
    const [facilitySettings, setFacilitySettings] = useState<FacilitySettings>({});

    const [bays, setBays] = useState<Bay[]>([]);
    const [baysLoading, setBaysLoading] = useState(false);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [bookingsLoading, setBookingsLoading] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    
    const [isBookingFormOpen, setBookingFormOpen] = useState(false);
    const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
    
    const [overrideConfirmOpen, setOverrideConfirmOpen] = useState(false);
    const [bookingToOverride, setBookingToOverride] = useState<BookingFormData | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            setUser(user);
          } else {
            router.push('/login');
          }
        });
        return () => unsubscribe();
    }, [router]);
    
    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'new') {
            handleCreateBookingClick();
        }
    }, [searchParams]);

    useEffect(() => {
        if (!user) return;
        
        const fetchFacilities = async () => {
            setLoading(true);
            setError(null);
            try {
                const q = query(collection(db, 'facilities'), where('ownerId', '==', user.uid));
                const querySnapshot = await getDocs(q);
                const userFacilities = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        name: data.name as string,
                        slug: data.slug as string,
                        settings: data.settings
                    };
                });
                setFacilities(userFacilities);
                if (userFacilities.length > 0) {
                    setSelectedFacility(userFacilities[0].id);
                }
            } catch (error) {
                console.error('Error fetching facilities:', error);
                setError("Failed to load facilities. Please try again.");
            }
            setLoading(false);
        };
        fetchFacilities();
    }, [user]);

    // Client-side effect to check for expired bookings
    // In a production app, this should be a scheduled server-side function (e.g., Firebase Function) for reliability.
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            bookings.forEach(booking => {
                if (booking.status === 'checked-in' && now > booking.endTime) {
                    console.log(`Booking ${booking.id} has expired. Marking as complete.`);
                    handleCompleteBooking(booking.id);
                }
            });
        }, 60000); // Check every minute

        return () => clearInterval(interval);
    }, [bookings]);

    useEffect(() => {
        if (!selectedFacility) {
            setBays([]);
            setBookings([]);
            setMembers([]);
            setFacilitySettings({});
            return;
        }

        setBaysLoading(true);
        setBookingsLoading(true);
        setMembersLoading(true);
        setError(null);

        const bayQuery = query(collection(db, `facilities/${selectedFacility}/bays`), orderBy('name'));
        const bayUnsubscribe = onSnapshot(bayQuery, (snapshot) => {
            try {
                const fetchedBays = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bay));
                setBays(fetchedBays);
                setBaysLoading(false);
            } catch (error) {
                console.error("Error processing bays data:", error);
                setError("Failed to load bays data.");
                setBaysLoading(false);
            }
        }, (error) => {
            console.error("Error listening to bays:", error);
            setError("Failed to load bays. Please try again.");
            setBaysLoading(false);
        });
        
        const bookingQuery = query(collection(db, `facilities/${selectedFacility}/bookings`));
        const bookingUnsubscribe = onSnapshot(bookingQuery, (snapshot) => {
            try {
                const fetchedBookings = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        startTime: (data.startTime as Timestamp).toDate(),
                        endTime: (data.endTime as Timestamp).toDate(),
                    } as Booking;
                });
                setBookings(fetchedBookings);
                setBookingsLoading(false);
            } catch (error) {
                console.error("Error processing bookings data:", error);
                setError("Failed to load bookings data.");
                setBookingsLoading(false);
            }
        }, (error) => {
            console.error("Error listening to bookings:", error);
            setError("Failed to load bookings. Please try again.");
            setBookingsLoading(false);
        });

        const memberQuery = query(collection(db, `facilities/${selectedFacility}/members`));
        const memberUnsubscribe = onSnapshot(memberQuery, (snapshot) => {
            try {
                const fetchedMembers = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        joinDate: (data.joinDate as Timestamp).toDate(),
                        membershipExpiry: data.membershipExpiry ? (data.membershipExpiry as Timestamp).toDate() : new Date(),
                    } as Member;
                });
                setMembers(fetchedMembers);
                setMembersLoading(false);
            } catch (error) {
                console.error("Error processing members data:", error);
                setMembersLoading(false);
            }
        }, (error) => {
            console.error("Error listening to members:", error);
            setMembersLoading(false);
        });

        // Listen for facility settings changes
        const facilityRef = doc(db, 'facilities', selectedFacility);
        const facilityUnsubscribe = onSnapshot(facilityRef, (docSnap) => {
            try {
                if (docSnap.exists()) {
                    setFacilitySettings(docSnap.data().settings || {});
                }
            } catch (error) {
                console.error("Error processing facility settings:", error);
            }
        }, (error) => {
            console.error("Error listening to facility:", error);
        });

        return () => {
            bayUnsubscribe();
            bookingUnsubscribe();
            memberUnsubscribe();
            facilityUnsubscribe();
        };

    }, [selectedFacility]);


    const handleSaveBooking = async (bookingData: BookingFormData, bypassChecks = false) => {
        if (!selectedFacility || !user || !user.displayName) {
            setError("No facility selected or user not authenticated. Cannot save booking.");
            return;
        }
        
        try {
            setError(null);
        
        const [startHour, startMinute] = bookingData.startTime.split(':').map(Number);
        const [endHour, endMinute] = bookingData.endTime.split(':').map(Number);
        
        const bookingDate = parse(bookingData.date, 'yyyy-MM-dd', new Date());

        const bookingStartTime = new Date(bookingDate);
        bookingStartTime.setHours(startHour, startMinute, 0, 0);

        const bookingEndTime = new Date(bookingDate);
        bookingEndTime.setHours(endHour, endMinute, 0, 0);

        if (!bypassChecks) {
            // --- Business Hours Validation ---
            const bookingDayOfWeek = format(bookingDate, 'eeee').toLowerCase();
            const hoursForDay = facilitySettings.businessHours?.[bookingDayOfWeek];

            if (!hoursForDay || !hoursForDay.isOpen) {
                setError(`The facility is closed on ${format(bookingDate, 'EEEE')}s. Would you like to override?`);
                setBookingToOverride(bookingData);
                setOverrideConfirmOpen(true);
                return;
            }
            
            const [openHour, openMinute] = hoursForDay.open.split(':').map(Number);
            const openTime = new Date(bookingDate);
            openTime.setHours(openHour, openMinute, 0, 0);
            
            const [closeHour, closeMinute] = hoursForDay.close.split(':').map(Number);
            const closeTime = new Date(bookingDate);
            closeTime.setHours(closeHour, closeMinute, 0, 0);

            if (bookingStartTime < openTime || bookingEndTime > closeTime) {
                setError(`Booking is outside of business hours for ${format(bookingDate, 'EEEE')} (${hoursForDay.open} - ${hoursForDay.close}). Would you like to override?`);
                setBookingToOverride(bookingData);
                setOverrideConfirmOpen(true);
                return;
            }
            // --- End Business Hours Validation ---
        }


        // Check for max concurrent bookings
        const maxBookings = facilitySettings.maxConcurrentBookings ?? 999; // Default to a high number if not set
        const memberActiveBookings = bookings.filter(b => 
            b.memberId === bookingData.memberId &&
            ['confirmed', 'checked-in'].includes(b.status) &&
            // Exclude the current booking if we are editing it
            b.id !== bookingData.id 
        ).length;

        if (memberActiveBookings >= maxBookings) {
            const memberName = members.find(m => m.id === bookingData.memberId)?.fullName || 'This member';
            setError(`${memberName} has reached the maximum of ${maxBookings} concurrent bookings.`);
            return;
        }

        const selectedMember = members.find(m => m.id === bookingData.memberId);
        const selectedBay = bays.find(b => b.id === bookingData.bayId);

        if (!selectedMember || !selectedBay) {
            setError("Selected member or bay not found");
            return;
        }

        const bookingPayload: any = {
            memberId: bookingData.memberId,
            memberName: selectedMember.fullName,
            bayId: bookingData.bayId,
            bayName: selectedBay.name,
            startTime: Timestamp.fromDate(bookingStartTime),
            endTime: Timestamp.fromDate(bookingEndTime),
            paymentMethod: bookingData.paymentMethod,
            paymentStatus: bookingData.paymentStatus,
            paymentAmount: bookingData.paymentAmount || 0,
        };

        const batch = writeBatch(db);
        const logRef = doc(collection(db, `facilities/${selectedFacility}/auditLogs`));

        if (bookingData.id) {
            // Update existing booking
            const bookingRef = doc(db, `facilities/${selectedFacility}/bookings`, bookingData.id);
            const originalBooking = bookings.find(b => b.id === bookingData.id);
            batch.update(bookingRef, bookingPayload);

            batch.set(logRef, {
                action: 'update',
                changedBy: user.displayName,
                changedById: user.uid,
                timestamp: serverTimestamp(),
                details: { 
                    objectType: 'Booking', 
                    objectId: bookingData.id, 
                    objectName: `Booking for ${selectedMember.fullName}`,
                    source: 'Bookings Page'
                },
                previousValue: { 
                    bay: originalBooking?.bayName,
                    time: `${format(originalBooking!.startTime, 'P p')} - ${format(originalBooking!.endTime, 'p')}`,
                    payment: originalBooking?.paymentStatus
                },
                newValue: { 
                    bay: selectedBay.name,
                    time: `${format(bookingStartTime, 'P p')} - ${format(bookingEndTime, 'p')}`,
                    payment: bookingData.paymentStatus
                }
            });

        } else {
            // Create new booking
            const bookingRef = doc(collection(db, `facilities/${selectedFacility}/bookings`));
            bookingPayload.status = 'confirmed';
            bookingPayload.createdAt = serverTimestamp();
            batch.set(bookingRef, bookingPayload);

            // Also update the bay status to 'booked'
            const bayRef = doc(db, `facilities/${selectedFacility}/bays`, selectedBay.id);
            batch.update(bayRef, { status: 'booked' });
            
            batch.set(logRef, {
                action: 'create',
                changedBy: user.displayName,
                changedById: user.uid,
                timestamp: serverTimestamp(),
                details: { 
                    objectType: 'Booking', 
                    objectId: bookingRef.id, 
                    objectName: `Booking for ${selectedMember.fullName} on ${selectedBay.name}`,
                    source: 'Bookings Page'
                }
            });
        }
        
            await batch.commit();
            setBookingFormOpen(false);
            setEditingBooking(null);
        } catch (error) {
            console.error("Error saving booking:", error);
            setError("Failed to save booking. Please try again.");
            throw error;
        }
    };

    const handleConfirmOverride = () => {
        if (bookingToOverride) {
            handleSaveBooking(bookingToOverride, true); // Re-run save, bypassing checks
        }
        setOverrideConfirmOpen(false);
        setBookingToOverride(null);
    };
    
    const handleUpdateBayStatus = async (bayId: string, status: Bay['status']) => {
        if (!selectedFacility || !user || !user.displayName) {
            setError("No facility ID, cannot update bay.");
            return;
        }
        
        const bayRef = doc(db, `facilities/${selectedFacility}/bays`, bayId);
        const batch = writeBatch(db);

        batch.update(bayRef, { status });

        // Add audit log for status change
        const logRef = doc(collection(db, `facilities/${selectedFacility}/auditLogs`));
        const bay = bays.find(b => b.id === bayId);

        batch.set(logRef, {
            action: 'update',
            changedBy: user.displayName,
            changedById: user.uid,
            timestamp: serverTimestamp(),
            details: { 
                objectType: 'Bay', 
                objectId: bayId, 
                objectName: bay?.name,
                source: 'Bookings Page'
            },
            previousValue: { status: bay?.status },
            newValue: { status },
        });

        await batch.commit();
    };
    
    const handleUpdateBookingStatus = async (bookingId: string, status: Booking['status']) => {
        if (!selectedFacility || !user || !user.displayName) return;

        const bookingRef = doc(db, `facilities/${selectedFacility}/bookings`, bookingId);
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking) return;

        const batch = writeBatch(db);
        batch.update(bookingRef, { status });

        const bayRef = doc(db, `facilities/${selectedFacility}/bays`, booking.bayId);
        if (status === 'checked-in') {
            batch.update(bayRef, { status: 'in-use' });
        } else if (status === 'no-show' || status === 'canceled') {
            batch.update(bayRef, { status: 'available' });
        }
        
        // Add audit log for status change
        const logRef = doc(collection(db, `facilities/${selectedFacility}/auditLogs`));
        batch.set(logRef, {
            action: 'update',
            changedBy: user.displayName,
            changedById: user.uid,
            timestamp: serverTimestamp(),
            details: { 
                objectType: 'Booking', 
                objectId: booking.id, 
                objectName: `Booking for ${booking.memberName}`,
                source: 'Bookings Page'
            },
            previousValue: { status: booking.status },
            newValue: { status: status },
        });

        await batch.commit();
    };

    const handleCancelBooking = async (bookingId: string) => {
        if (!selectedFacility) return;

        const bookingRef = doc(db, `facilities/${selectedFacility}/bookings`, bookingId);
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking) return;

        const batch = writeBatch(db);
        const updatePayload: {status: Booking['status'], paymentStatus?: Booking['paymentStatus']} = { status: 'canceled' };

        // If booking was paid, mark as refunded.
        // A real app would integrate with a payment provider (e.g. Stripe) here to process the refund.
        if (booking.paymentStatus === 'paid') {
            updatePayload.paymentStatus = 'refunded';
        }
        
        batch.update(bookingRef, updatePayload);
        
        // Make the bay available again
        const bayRef = doc(db, `facilities/${selectedFacility}/bays`, booking.bayId);
        batch.update(bayRef, { status: 'available' });

        await batch.commit();
    }
    
    
    const handleExtendTime = async (bookingId: string, minutes: number) => {
        if (!selectedFacility) return;
        const bookingRef = doc(db, `facilities/${selectedFacility}/bookings`, bookingId);
        const bookingDoc = await getDoc(bookingRef);
        if (!bookingDoc.exists()) return;

        const currentEndTime = (bookingDoc.data().endTime as Timestamp).toDate();
        const newEndTime = addMinutes(currentEndTime, minutes);
        
        await updateDoc(bookingRef, { endTime: Timestamp.fromDate(newEndTime) });
    };

    const handleCreateBookingClick = () => {
        setError(null);
        setEditingBooking(null);
        setBookingFormOpen(true);
    };
    
    const handleCompleteBooking = async (bookingId: string) => {
        if (!selectedFacility) return;
        
        try {
            const booking = bookings.find(b => b.id === bookingId);
            if (!booking) return;

            const batch = writeBatch(db);

            // Set booking to completed
            const bookingRef = doc(db, `facilities/${selectedFacility}/bookings`, bookingId);
            batch.update(bookingRef, { status: 'completed' });

            // Set bay to available
            const bayRef = doc(db, `facilities/${selectedFacility}/bays`, booking.bayId);
            batch.update(bayRef, { status: 'available' });

            await batch.commit();
        } catch (error) {
            console.error("Error completing booking:", error);
            setError("Failed to complete booking. Please try again.");
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col sm:gap-4 sm:py-4 flex-grow">
                <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                    <Skeleton className="h-6 w-32" />
                </header>
                <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-24" />
                            <Skeleton className="h-4 w-64" />
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[...Array(4)].map((_, i) => (
                                    <Skeleton key={i} className="h-24 w-full" />
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </main>
            </div>
        );
    }

    if (facilities.length === 0 && !loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen space-y-4">
                <Calendar className="h-12 w-12 text-muted-foreground" />
                <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">No Facilities Found</h3>
                    <p className="text-muted-foreground">Create your first facility to start managing bookings and bays.</p>
                </div>
                <Button onClick={() => router.push('/register')}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create Facility
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col sm:gap-4 sm:py-4 flex-grow">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    <h1 className="text-xl font-semibold">Bays & Bookings</h1>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Select value={selectedFacility ?? ""} onValueChange={setSelectedFacility}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select Facility" />
                        </SelectTrigger>
                        <SelectContent>
                            {facilities.map(f => (
                                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button size="sm" className="h-8 gap-1" onClick={handleCreateBookingClick} disabled={!selectedFacility}>
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                            Create Booking
                        </span>
                    </Button>
                </div>
            </header>

            {error && (
                <Alert className="mx-4 sm:mx-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                {!selectedFacility ? (
                    <Card>
                        <CardContent className="flex items-center justify-center p-8">
                            <div className="text-center space-y-2">
                                <Calendar className="h-12 w-12 text-muted-foreground mx-auto" />
                                <h3 className="text-lg font-semibold">Select a Facility</h3>
                                <p className="text-muted-foreground">Choose a facility from the dropdown to view bookings and manage bays.</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Clock className="h-5 w-5" />
                                            Bay Status
                                        </CardTitle>
                                        <CardDescription>
                                            Real-time bay availability for {facilities.find(f => f.id === selectedFacility)?.name}
                                        </CardDescription>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {baysLoading ? "Loading..." : `${bays.length} bays`}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {baysLoading ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {[...Array(4)].map((_, i) => (
                                            <Skeleton key={i} className="h-24 w-full" />
                                        ))}
                                    </div>
                                ) : (
                                    <BayStatus bays={bays} bookings={bookings} onUpdateBayStatus={handleUpdateBayStatus} />
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Calendar className="h-5 w-5" />
                                            Booking Calendar
                                        </CardTitle>
                                        <CardDescription>
                                            Manage bookings and schedules for {facilities.find(f => f.id === selectedFacility)?.name}
                                        </CardDescription>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {bookingsLoading ? "Loading..." : `${bookings.length} bookings`}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {bookingsLoading || membersLoading ? (
                                    <div className="space-y-4">
                                        {[...Array(5)].map((_, i) => (
                                            <Skeleton key={i} className="h-16 w-full" />
                                        ))}
                                    </div>
                                ) : (
                                    <BookingCalendar 
                                        bookings={bookings} 
                                        bays={bays}
                                        members={members}
                                        isBookingFormOpen={isBookingFormOpen}
                                        setBookingFormOpen={setBookingFormOpen}
                                        editingBooking={editingBooking}
                                        setEditingBooking={setEditingBooking}
                                        onSave={handleSaveBooking}
                                        onCancelBooking={handleCancelBooking}
                                        onUpdateBookingStatus={handleUpdateBookingStatus}
                                        onExtendTime={handleExtendTime}
                                        onCompleteBooking={handleCompleteBooking}
                                        error={error}
                                        setError={setError}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </>
                )}
            </main>
            
            <AlertDialog open={overrideConfirmOpen} onOpenChange={setOverrideConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Business Hours Override</AlertDialogTitle>
                        <AlertDialogDescription>
                            {error}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setOverrideConfirmOpen(false);
                            setError(null);
                        }}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmOverride}>
                            Confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default function BookingsPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col sm:gap-4 sm:py-4 flex-grow">
                <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                    <Skeleton className="h-6 w-32" />
                </header>
                <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-24" />
                            <Skeleton className="h-4 w-64" />
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {[...Array(3)].map((_, i) => (
                                    <Skeleton key={i} className="h-16 w-full" />
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </main>
            </div>
        }>
            <BookingsPageContent />
        </Suspense>
    );
}
