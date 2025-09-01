
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, isToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, getDay } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCheck, UserX, Clock, CheckCircle, ChevronLeft, ChevronRight, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Member } from '../members/members-table';
import { Bay } from './bay-status';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription as AlertDesc } from '@/components/ui/alert';


export interface Booking {
    id: string;
    memberId: string;
    memberName: string;
    bayId: string;
    bayName: string;
    startTime: Date;
    endTime: Date;
    status: 'confirmed' | 'canceled' | 'checked-in' | 'no-show' | 'completed';
    paymentMethod?: 'cash' | 'card' | 'member_account';
    paymentStatus?: 'paid' | 'unpaid' | 'refunded';
    paymentAmount?: number;
}

export const BookingFormSchema = z.object({
    id: z.string().optional(),
    memberId: z.string().min(1, 'Member is required'),
    bayId: z.string().min(1, 'Bay is required'),
    date: z.string().min(1, 'Date is required'),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
    paymentMethod: z.enum(['cash', 'card', 'member_account']),
    paymentStatus: z.enum(['paid', 'unpaid', 'refunded']),
    paymentAmount: z.coerce.number().min(0, 'Amount cannot be negative.').optional(),
});
export type BookingFormData = z.infer<typeof BookingFormSchema>;

interface BookingCalendarProps {
    bookings: Booking[];
    bays: Partial<Bay>[];
    members: Partial<Member>[];
    isBookingFormOpen: boolean;
    setBookingFormOpen: (isOpen: boolean) => void;
    editingBooking: Booking | null;
    setEditingBooking: (booking: Booking | null) => void;
    onSave: (data: BookingFormData) => void;
    onCancelBooking: (bookingId: string) => void;
    onUpdateBookingStatus: (bookingId: string, status: Booking['status']) => void;
    onExtendTime: (bookingId: string, minutes: number) => void;
    onCompleteBooking: (bookingId: string) => void;
    error: string | null;
    setError: (error: string | null) => void;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}


function BookingForm({ form, bays, members, bookings, editingBooking, handleSave }: { 
    form: any, 
    bays: Partial<Bay>[], 
    members: Partial<Member>[], 
    bookings: Booking[],
    editingBooking: Booking | null,
    handleSave: (data: BookingFormData) => void 
}) {
    // Always work with concrete arrays
    const safeBays = Array.isArray(bays) ? bays : [];
    const safeMembers = Array.isArray(members) ? members : [];

    const [selDate, selStart, selEnd] = form.watch(['date', 'startTime', 'endTime']);

    const selStartDt = selDate && selStart ? new Date(`${selDate}T${selStart}:00`) : null;
    const selEndDt   = selDate && selEnd   ? new Date(`${selDate}T${selEnd}:00`)   : null;

    const availableBaysForForm = editingBooking
      ? safeBays // when editing, let them keep the current bay even if status changed
      : safeBays.filter(b => b.status === 'available');

    const conflictSafeBays = (!selStartDt || !selEndDt)
      ? availableBaysForForm
      : availableBaysForForm.filter(bay => {
          if (!bay || !bay.id) return false;
          const conflict = bookings.some(b =>
            b.bayId === bay.id &&
            overlaps(selStartDt, selEndDt, b.startTime, b.endTime) &&
            (!editingBooking || b.id !== editingBooking.id)
          );
          return !conflict;
        });

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                <FormField control={form.control} name="memberId" render={({ field }) => (
                    <FormItem><FormLabel>Member</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a member" /></SelectTrigger></FormControl>
                        <SelectContent>
                            {safeMembers.filter(m => m?.id && m?.fullName).map(m => <SelectItem key={m.id!} value={m.id!}>{m.fullName}</SelectItem>)}
                        </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="bayId" render={({ field }) => (
                    <FormItem><FormLabel>Bay</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a bay" /></SelectTrigger></FormControl>
                        <SelectContent>
                            {conflictSafeBays.filter(b => b?.id && b?.name).map(b => <SelectItem key={b.id!} value={b.id!}>{b.name}</SelectItem>)}
                        </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Date</FormLabel>
                        <FormControl>
                            <Input type="date" {...field} />
                        </FormControl>
                    <FormMessage /></FormItem>
                )}/>
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="startTime" render={({ field }) => (
                        <FormItem><FormLabel>Start Time</FormLabel><FormControl><Input {...field} type="time" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="endTime" render={({ field }) => (
                        <FormItem><FormLabel>End Time</FormLabel><FormControl><Input {...field} type="time" /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                        <FormItem><FormLabel>Payment Method</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="card">Card</SelectItem>
                                    <SelectItem value="cash">Cash</SelectItem>
                                    <SelectItem value="member_account">Member Account</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="paymentStatus" render={({ field }) => (
                        <FormItem><FormLabel>Payment Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="unpaid">Unpaid</SelectItem>
                                    <SelectItem value="refunded">Refunded</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
                 <FormField control={form.control} name="paymentAmount" render={({ field }) => (
                    <FormItem><FormLabel>Payment Amount ($)</FormLabel><FormControl><Input {...field} type="number" step="0.01" /></FormControl><FormMessage /></FormItem>
                )} />
                 <DialogFooter>
                    <Button type="submit">Save Booking</Button>
                </DialogFooter>
            </form>
        </Form>
    )
}

export function BookingCalendar({ 
    bookings, 
    bays, 
    members, 
    isBookingFormOpen, 
    setBookingFormOpen, 
    editingBooking, 
    setEditingBooking, 
    onSave, 
    onCancelBooking, 
    onUpdateBookingStatus,
    onExtendTime,
    onCompleteBooking,
    error,
    setError,
}: BookingCalendarProps) {
    const [viewingBooking, setViewingBooking] = React.useState<Booking | null>(null);
    
    // Always work with concrete arrays
    const safeBays = Array.isArray(bays) ? bays : [];
    const safeMembers = Array.isArray(members) ? members : [];

    const form = useForm<BookingFormData>({
        resolver: zodResolver(BookingFormSchema),
        defaultValues: {
            id: undefined, 
            memberId: '', 
            bayId: '', 
            date: format(new Date(), 'yyyy-MM-dd'), 
            startTime: '09:00', 
            endTime: '10:00',
            paymentMethod: 'card',
            paymentStatus: 'unpaid',
            paymentAmount: 0,
        }
    });

    React.useEffect(() => {
        if (isBookingFormOpen) {
            if (editingBooking) {
                form.reset({
                    id: editingBooking.id,
                    memberId: editingBooking.memberId,
                    bayId: editingBooking.bayId,
                    date: format(editingBooking.startTime, 'yyyy-MM-dd'),
                    startTime: format(editingBooking.startTime, 'HH:mm'),
                    endTime: format(editingBooking.endTime, 'HH:mm'),
                    paymentMethod: editingBooking.paymentMethod || 'card',
                    paymentStatus: editingBooking.paymentStatus || 'unpaid',
                    paymentAmount: editingBooking.paymentAmount || 0,
                });
            } else {
                form.reset({ 
                    id: undefined, 
                    memberId: '', 
                    bayId: '', 
                    date: format(new Date(), 'yyyy-MM-dd'), 
                    startTime: '09:00', 
                    endTime: '10:00',
                    paymentMethod: 'card',
                    paymentStatus: 'unpaid',
                    paymentAmount: 0,
                });
            }
        }
    }, [editingBooking, form, isBookingFormOpen]);
    
    const formInstanceKey = editingBooking ? `edit-${editingBooking.id}` : `create-${isBookingFormOpen ? 'open' : 'closed'}`;


    const handleSave = (formData: BookingFormData) => {
        onSave(formData);
        // Do not close form here; parent component will close it on success
    }

    const closeFormDialog = () => {
        setBookingFormOpen(false); 
        setEditingBooking(null);
        setError(null);
        form.clearErrors();
    }

    const handleEditClick = (booking: Booking | null) => {
        if (!booking) return;
        setViewingBooking(null);
        setEditingBooking(booking);
        setBookingFormOpen(true);
    }

    const getStatusBadgeClass = (status: Booking['status']) => {
        switch (status) {
            case 'confirmed':
                return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';
            case 'checked-in':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200';
            case 'completed':
                return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200';
            case 'canceled':
                return 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200';
            case 'no-show':
                return 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200';
        }
    }
    
    const getPaymentStatusBadgeClass = (status: Booking['paymentStatus']) => {
        switch (status) {
            case 'paid':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'unpaid':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'refunded':
                return 'bg-gray-100 text-gray-800 border-gray-200';
            default:
                return 'bg-gray-100';
        }
    }

    const DayView = () => {
        const todayBookings = bookings.filter(booking => isToday(booking.startTime));
        
        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Member</TableHead>
                        <TableHead>Bay</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {todayBookings.length > 0 ? todayBookings.map(booking => (
                        <TableRow key={booking.id} className="cursor-pointer" onClick={() => setViewingBooking(booking)}>
                            <TableCell>{format(booking.startTime, 'p')} - {format(booking.endTime, 'p')}</TableCell>
                            <TableCell>{booking.memberName}</TableCell>
                            <TableCell>{booking.bayName}</TableCell>
                            <TableCell>
                                {booking.paymentStatus ? (
                                    <Badge className={cn("capitalize", getPaymentStatusBadgeClass(booking.paymentStatus))}>{booking.paymentStatus}</Badge>
                                ) : (
                                    <Badge variant="outline">N/A</Badge>
                                )}
                            </TableCell>
                            <TableCell><Badge className={cn("capitalize", getStatusBadgeClass(booking.status))}>{booking.status === 'confirmed' ? 'Booked' : booking.status.replace('-', ' ')}</Badge></TableCell>
                        </TableRow>
                    )) : (
                        <TableRow><TableCell colSpan={5} className="text-center h-24">No bookings for today.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
        );
    }
    
    const WeekView = () => {
        const today = new Date();
        const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

        const weekBookings = bookings.filter(b => b.startTime >= weekStart && b.startTime <= weekEnd);

        return (
            <div>
                {days.map(day => (
                    <div key={day.toString()} className="mb-4">
                        <h3 className="font-semibold text-lg mb-2 pl-2">{format(day, 'EEEE, MMM d')}</h3>
                        <Table>
                             <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Member</TableHead>
                                    <TableHead>Bay</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {weekBookings.filter(b => isSameDay(b.startTime, day)).length > 0 ? (
                                    weekBookings.filter(b => isSameDay(b.startTime, day)).map(booking => (
                                        <TableRow key={booking.id} className="cursor-pointer" onClick={() => setViewingBooking(booking)}>
                                            <TableCell>{format(booking.startTime, 'p')} - {format(booking.endTime, 'p')}</TableCell>
                                            <TableCell>{booking.memberName}</TableCell>
                                            <TableCell>{booking.bayName}</TableCell>
                                            <TableCell><Badge className={cn("capitalize", getStatusBadgeClass(booking.status))}>{booking.status === 'confirmed' ? 'Booked' : booking.status.replace('-', ' ')}</Badge></TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={4} className="text-center h-24">No bookings for this day.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                ))}
            </div>
        )
    }

    const MonthView = () => {
        const [currentMonth, setCurrentMonth] = React.useState(new Date());
        const [selectedDate, setSelectedDate] = React.useState<Date | null>(new Date());

        const firstDayOfMonth = startOfMonth(currentMonth);
        const lastDayOfMonth = endOfMonth(currentMonth);

        const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
        const startingDayOfWeek = getDay(firstDayOfMonth); // 0 = Sunday, 1 = Monday ...

        const monthBookings = bookings.filter(b => isSameMonth(b.startTime, currentMonth));
        const selectedDayBookings = selectedDate ? monthBookings.filter(b => isSameDay(b.startTime, selectedDate)) : [];

        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                    <div className="flex justify-between items-center mb-4">
                        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                        <h3 className="font-semibold text-lg">{format(currentMonth, 'MMMM yyyy')}</h3>
                        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center font-semibold text-sm text-muted-foreground">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day}>{day}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1 mt-1">
                        {Array.from({ length: startingDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
                        {daysInMonth.map(day => {
                            const dayHasBookings = monthBookings.some(b => isSameDay(b.startTime, day));
                            return (
                                <button 
                                    key={day.toString()}
                                    onClick={() => setSelectedDate(day)}
                                    className={cn(
                                        "h-16 w-full text-left p-2 rounded-md transition-colors",
                                        isToday(day) && "bg-muted-foreground/20",
                                        isSameDay(day, selectedDate || new Date()) && "bg-primary text-primary-foreground",
                                        !isSameDay(day, selectedDate || new Date()) && "hover:bg-muted"
                                    )}
                                >
                                    <div className="font-semibold">{format(day, 'd')}</div>
                                    {dayHasBookings && <div className="mt-1 h-2 w-2 rounded-full bg-blue-500 mx-auto" />}
                                </button>
                            )
                        })}
                    </div>
                </div>
                <div>
                     <h3 className="font-semibold text-lg mb-4 pl-2">
                        {selectedDate ? format(selectedDate, 'EEEE, MMM d') : 'Select a date'}
                     </h3>
                    {selectedDate && (
                         <Table>
                            <TableBody>
                                {selectedDayBookings.length > 0 ? selectedDayBookings.map(booking => (
                                    <TableRow key={booking.id} className="cursor-pointer" onClick={() => setViewingBooking(booking)}>
                                        <TableCell>
                                            <div>{format(booking.startTime, 'p')} - {format(booking.endTime, 'p')}</div>
                                            <div className="text-sm text-muted-foreground">{booking.memberName} on {booking.bayName}</div>
                                            <Badge className={cn("capitalize mt-1", getStatusBadgeClass(booking.status))}>{booking.status === 'confirmed' ? 'Booked' : booking.status.replace('-', ' ')}</Badge>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell className="text-center h-24">No bookings for this day.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Booking Calendar</CardTitle>
                <CardDescription>View and manage all upcoming bookings.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="day">
                    <TabsList>
                        <TabsTrigger value="day">Day</TabsTrigger>
                        <TabsTrigger value="week">Week</TabsTrigger>
                        <TabsTrigger value="month">Month</TabsTrigger>
                    </TabsList>
                    <TabsContent value="day"><DayView /></TabsContent>
                    <TabsContent value="week"><WeekView /></TabsContent>
                    <TabsContent value="month"><MonthView /></TabsContent>
                </Tabs>
            </CardContent>

             {/* Booking Details Dialog */}
             <Dialog open={viewingBooking !== null} onOpenChange={(isOpen) => !isOpen && setViewingBooking(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Booking Details</DialogTitle>
                    </DialogHeader>
                    {viewingBooking && (
                        <div className="space-y-4">
                            <div><strong>Member:</strong> {viewingBooking.memberName}</div>
                            <div><strong>Bay:</strong> {viewingBooking.bayName}</div>
                            <div><strong>Time:</strong> {format(viewingBooking.startTime, 'P p')} - {format(viewingBooking.endTime, 'p')}</div>
                            <div><strong>Status:</strong> <Badge className={cn("capitalize", getStatusBadgeClass(viewingBooking.status))}>{viewingBooking.status === 'confirmed' ? 'Booked' : viewingBooking.status.replace('-', ' ')}</Badge></div>
                            <div><strong>Payment:</strong> 
                                {viewingBooking.paymentStatus ? (
                                    <>
                                     <Badge className={cn("capitalize", getPaymentStatusBadgeClass(viewingBooking.paymentStatus))}>{viewingBooking.paymentStatus}</Badge>
                                     {viewingBooking.paymentMethod && (
                                        <> via <span className="capitalize">{viewingBooking.paymentMethod.replace('_', ' ')}</span></>
                                     )}
                                     {viewingBooking.paymentAmount !== undefined && (
                                         <> for <strong>${viewingBooking.paymentAmount.toFixed(2)}</strong></>
                                     )}
                                    </>
                                ) : (
                                    <Badge variant="outline">N/A</Badge>
                                )}
                            </div>
                        </div>
                    )}
                    <DialogFooter className="sm:justify-between items-center pt-4">
                        <div className="flex gap-2">
                             {viewingBooking?.status === 'confirmed' && (
                                <>
                                <Button variant="outline" size="sm" onClick={() => { if(viewingBooking) { onUpdateBookingStatus(viewingBooking.id, 'checked-in'); setViewingBooking(null); } }}>
                                    <UserCheck className="mr-2 h-4 w-4"/> Check In
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => { if(viewingBooking) { onUpdateBookingStatus(viewingBooking.id, 'no-show'); setViewingBooking(null); } }}>
                                    <UserX className="mr-2 h-4 w-4"/> No-Show
                                </Button>
                                </>
                             )}
                             {viewingBooking?.status === 'checked-in' && (
                                <>
                                <Button variant="outline" size="sm" onClick={() => { if(viewingBooking) { onExtendTime(viewingBooking.id, 15); } }}>
                                    <Clock className="mr-2 h-4 w-4"/> Extend (+15m)
                                </Button>
                                <Button size="sm" onClick={() => { if(viewingBooking) { onCompleteBooking(viewingBooking.id); setViewingBooking(null); } }}>
                                    <CheckCircle className="mr-2 h-4 w-4"/> Complete
                                </Button>
                                </>
                             )}
                        </div>

                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setViewingBooking(null)}>Close</Button>
                            <Button onClick={() => handleEditClick(viewingBooking)}>Edit</Button>
                            {viewingBooking?.status === 'confirmed' && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive">Cancel Booking</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will cancel the booking. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Back</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={(e) => { e.preventDefault(); if(viewingBooking) { onCancelBooking(viewingBooking.id); setViewingBooking(null); } }}
                                                className="bg-destructive hover:bg-destructive/90"
                                            >
                                                Confirm Cancellation
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create/Edit Booking Dialog */}
            <Dialog open={isBookingFormOpen} onOpenChange={(isOpen) => {
                if (!isOpen) { closeFormDialog() } else { setBookingFormOpen(true) }
            }}>
                <DialogContent key={formInstanceKey}>
                    <DialogHeader>
                        <DialogTitle>{editingBooking ? 'Edit Booking' : 'Create New Booking'}</DialogTitle>
                        <DialogDescription>
                            {error ? (
                                <Alert variant="destructive" className="mt-2">
                                    <Terminal className="h-4 w-4" />
                                    <AlertDesc>{error}</AlertDesc>
                                </Alert>
                            ) : (
                                "Select a member, bay, and time to create a new booking."
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <BookingForm
                        form={form}
                        bays={safeBays}
                        members={safeMembers}
                        bookings={bookings}
                        editingBooking={editingBooking}
                        handleSave={handleSave}
                    />
                </DialogContent>
            </Dialog>

        </Card>
    );
}
