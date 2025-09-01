
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Booking } from './booking-calendar';
import { isToday, format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


export interface Bay {
    id: string;
    name: string;
    status: 'available' | 'booked' | 'maintenance' | 'in-use';
    nextBooking?: string | null;
}

interface BayStatusProps {
    bays: Bay[];
    bookings: Booking[];
    onUpdateBayStatus: (bayId: string, status: Bay['status']) => void;
}

export function BayStatus({ bays, bookings, onUpdateBayStatus }: BayStatusProps) {
    const [viewingBay, setViewingBay] = React.useState<Bay | null>(null);

    const getStatusClass = (status: Bay['status']) => {
        switch (status) {
            case 'available':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'booked':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'in-use':
                 return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'maintenance':
                return 'bg-gray-200 text-gray-800 border-gray-300';
            default:
                return 'bg-gray-100';
        }
    }

    const dailyBookingsForBay = viewingBay 
        ? bookings.filter(b => b.bayId === viewingBay.id && isToday(b.startTime))
                  .sort((a,b) => a.startTime.getTime() - b.startTime.getTime())
        : [];

    return (
        <div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {bays.map(bay => (
                    <Card key={bay.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setViewingBay(bay)}>
                        <CardHeader>
                            <CardTitle className="flex justify-between items-center">
                                {bay.name}
                                <Badge className={cn("capitalize", getStatusClass(bay.status))}>{bay.status === 'in-use' ? 'In Use' : bay.status}</Badge>
                            </CardTitle>
                             <CardDescription>
                                {/* This is placeholder - real logic would find the next confirmed booking */}
                                {bay.status === 'available' && bay.nextBooking ? `Next at ${bay.nextBooking}` : ' '}
                            </CardDescription>
                        </CardHeader>
                    </Card>
                ))}
            </div>

            {/* Bay Schedule Dialog */}
            <Dialog open={viewingBay !== null} onOpenChange={(isOpen) => !isOpen && setViewingBay(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Bookings for {viewingBay?.name}</DialogTitle>
                        <DialogDescription>
                           Showing all scheduled bookings for today, {format(new Date(), 'PPP')}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {dailyBookingsForBay.length > 0 ? (
                           <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Member</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {dailyBookingsForBay.map(booking => (
                                    <TableRow key={booking.id}>
                                        <TableCell>{format(booking.startTime, 'p')} - {format(booking.endTime, 'p')}</TableCell>
                                        <TableCell>{booking.memberName}</TableCell>
                                        <TableCell><Badge className="capitalize">{booking.status.replace('-', ' ')}</Badge></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                           </Table>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">No bookings scheduled for this bay today.</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setViewingBay(null)}>Close</Button>
                        {viewingBay?.status === 'available' && (
                             <Button onClick={() => { if(viewingBay) onUpdateBayStatus(viewingBay.id, 'maintenance')}}>Set to Maintenance</Button>
                        )}
                        {viewingBay?.status === 'maintenance' && (
                             <Button onClick={() => { if(viewingBay) onUpdateBayStatus(viewingBay.id, 'available')}}>Set to Available</Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
