
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, onSnapshot, Timestamp } from 'firebase/firestore';
import { format, subDays, startOfMonth, endOfMonth, differenceInDays, subMonths, getDay, getHours, differenceInMinutes } from 'date-fns';
import { BarChart as BarChartIcon, Users, TrendingUp, TrendingDown, Percent, Download, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { Member } from '../members/members-table';
import { Booking } from '../bookings/booking-calendar';
import { Bay } from '../bookings/bay-status';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, BarChart, AreaChart, Area, Bar, ChartXAxis, ChartYAxis, ChartGrid } from '@/components/ui/chart';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    useReactTable,
} from '@tanstack/react-table';

const StatCard = ({ title, value, comparisonValue, icon: Icon }: { title: string, value: string, comparisonValue: string, icon: React.ElementType }) => {
    const hasComparison = comparisonValue && comparisonValue !== 'N/A';
    const isPositive = hasComparison && comparisonValue.startsWith('+');
    const isNegative = hasComparison && comparisonValue.startsWith('-');

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {hasComparison && (
                    <div className={cn("text-xs flex items-center", isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-muted-foreground")}>
                        {isPositive && <TrendingUp className="h-4 w-4 mr-1" />}
                        {isNegative && <TrendingDown className="h-4 w-4 mr-1" />}
                        {comparisonValue} vs. previous period
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

const chartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--primary))",
    },
    members: {
      label: "New Members",
      color: "hsl(var(--accent-foreground))",
    },
};


const BookingsHeatmap = ({ bookings }: { bookings: Booking[] }) => {
    const hours = Array.from({ length: 16 }, (_, i) => `${i + 7}:00`); // 7 AM to 10 PM
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const heatmapData: number[][] = Array(7).fill(0).map(() => Array(16).fill(0));
    
    bookings.forEach(booking => {
        const day = getDay(booking.startTime);
        const startHour = getHours(booking.startTime);
        
        if (startHour >= 7 && startHour <= 22) {
             heatmapData[day][startHour - 7]++;
        }
    });
    
    const maxBookings = Math.max(...heatmapData.flat(), 1);

    const getColor = (value: number) => {
        if (value === 0) return 'bg-muted/30';
        const intensity = Math.round((value / maxBookings) * 4);
        switch (intensity) {
            case 1: return 'bg-primary/20';
            case 2: return 'bg-primary/40';
            case 3: return 'bg-primary/70';
            case 4: return 'bg-primary';
            default: return 'bg-muted/30';
        }
    };


    return (
        <div className="flex gap-4">
            <div className="flex flex-col gap-2 text-xs text-muted-foreground justify-around">
                 {hours.map(hour => <div key={hour} className="h-6 flex items-center">{hour}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 flex-grow">
                {days.map((day, dayIndex) => (
                    <div key={day} className="flex flex-col gap-1 items-center">
                         <div className="text-xs font-semibold">{day}</div>
                        {hours.map((_, hourIndex) => {
                            const bookingsCount = heatmapData[dayIndex][hourIndex];
                             return (
                                <TooltipProvider key={`${day}-${hourIndex}`} delayDuration={100}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className={cn("h-6 w-full rounded", getColor(bookingsCount))} />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{bookingsCount} booking{bookingsCount !== 1 ? 's' : ''}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                             )
                        })}
                    </div>
                ))}
            </div>
        </div>
    )

}

const getStatusBadgeVariant = (status: Booking['status']) => {
    switch (status) {
        case 'confirmed': return 'secondary';
        case 'checked-in': return 'default'; // yellow in other places
        case 'completed': return 'default';
        case 'canceled': return 'destructive';
        case 'no-show': return 'outline';
        default: return 'outline';
    }
};

const DetailedBookingsTable = ({ data }: { data: Booking[] }) => {
    const columns: ColumnDef<Booking>[] = [
        { accessorKey: 'memberName', header: 'Member' },
        { accessorKey: 'bayName', header: 'Bay' },
        { 
            accessorKey: 'startTime', 
            header: 'Date & Time',
            cell: ({ row }) => format(row.original.startTime, 'Pp')
        },
        { 
            id: 'duration', 
            header: 'Duration',
            accessorFn: row => differenceInMinutes(row.endTime, row.startTime),
            cell: ({ row }) => `${row.getValue('duration')} min`
        },
        { 
            id: 'payment', 
            header: 'Payment',
            accessorFn: row => row.paymentStatus === 'paid' ? row.paymentAmount : 0,
            cell: ({ row }) => {
                const booking = row.original;
                if(booking.paymentStatus === 'paid' && booking.paymentAmount) {
                    return `$${booking.paymentAmount.toFixed(2)}`;
                }
                return <span className="capitalize text-muted-foreground">{booking.paymentStatus}</span>
            }
        },
        { 
            accessorKey: 'status', 
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status;
                return <Badge variant={getStatusBadgeVariant(status)} className="capitalize">{status.replace('-', ' ')}</Badge>
            }
        },
    ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    return (
        <div className="space-y-4">
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                            <TableHead key={header.id}>
                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                            </TableHead>
                            ))}
                        </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                            <TableRow key={row.id}>
                            {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                            ))}
                            </TableRow>
                        ))
                        ) : (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                            No bookings found for the selected period.
                            </TableCell>
                        </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
            </div>
        </div>
    );
};


export default function ReportsPage() {
    const router = useRouter();
    const [user, setUser] = React.useState<User | null>(null);
    const [pageLoading, setPageLoading] = React.useState(true);
    const [facilities, setFacilities] = React.useState<{ id: string, name: string }[]>([]);
    const [selectedFacilityId, setSelectedFacilityId] = React.useState<string | null>(null);
    
    const [allBookings, setAllBookings] = React.useState<Booking[] | null>(null);
    const [allMembers, setAllMembers] = React.useState<Member[] | null>(null);

    const [currentPeriodSummary, setCurrentPeriodSummary] = React.useState<PeriodMetrics | null>(null);
    const [previousPeriodSummary, setPreviousPeriodSummary] = React.useState<PeriodMetrics | null>(null);
    const [chartData, setChartData] = React.useState<ChartData[]>([]);

    const [date, setDate] = React.useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });
    
    interface PeriodMetrics {
        totalRevenue: number;
        totalBookings: number;
        activeMembers: number;
        canceledMembers: number;
        bayUtilization: number;
    }
    
    interface ChartData {
        month: string;
        revenue: number;
        members: number;
    }

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
        setPageLoading(true);
        const fetchFacilities = async () => {
            const q = query(collection(db, 'facilities'), where('ownerId', '==', user.uid));
            const querySnapshot = await getDocs(q);
            const userFacilities = querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name as string }));
            setFacilities(userFacilities);
            if (userFacilities.length > 0) {
                setSelectedFacilityId(userFacilities[0].id);
            } else {
                setPageLoading(false);
            }
        };
        fetchFacilities();
    }, [user]);

    React.useEffect(() => {
        if (!selectedFacilityId) return;

        const memberUnsubscribe = onSnapshot(query(collection(db, `facilities/${selectedFacilityId}/members`)), (snapshot) => {
             const membersData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    joinDate: (data.joinDate as Timestamp).toDate(),
                } as Member;
            });
            setAllMembers(membersData);
        });

        const bookingUnsubscribe = onSnapshot(query(collection(db, `facilities/${selectedFacilityId}/bookings`)), (snapshot) => {
             const bookingsData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    startTime: (data.startTime as Timestamp).toDate(),
                    endTime: (data.endTime as Timestamp).toDate(),
                } as Booking;
            });
            setAllBookings(bookingsData);
        });

        return () => {
            memberUnsubscribe();
            bookingUnsubscribe();
        };

    }, [selectedFacilityId]);


    const calculateMetrics = React.useCallback(async (startDate?: Date, endDate?: Date): Promise<PeriodMetrics | null> => {
        if (!selectedFacilityId || !startDate || !endDate || !allMembers || !allBookings) return null;
        
        const activeMembers = allMembers.filter(m => m.status === 'active').length;
        const canceledMembers = allMembers.filter(m => m.status === 'inactive').length;

        const periodBookings = allBookings.filter(b => b.startTime >= startDate && b.startTime <= endDate);

        const bayQuery = query(collection(db, `facilities/${selectedFacilityId}/bays`));
        const baySnapshot = await getDocs(bayQuery);
        const bays = baySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Bay));


        const totalRevenue = periodBookings.reduce((sum, b) => b.paymentStatus === 'paid' ? sum + (b.paymentAmount || 0) : sum, 0);
        const totalBookings = periodBookings.length;
        
        const periodDays = differenceInDays(endDate, startDate) + 1;
        const totalHoursInPeriod = periodDays * 12 * bays.length;
        const bookedHours = periodBookings.reduce((sum, b) => {
            const durationMillis = b.endTime.getTime() - b.startTime.getTime();
            return sum + (durationMillis / (1000 * 60 * 60));
        }, 0);
        const bayUtilization = totalHoursInPeriod > 0 ? (bookedHours / totalHoursInPeriod) * 100 : 0;

        return { totalRevenue, totalBookings, activeMembers, canceledMembers, bayUtilization };
    }, [selectedFacilityId, allMembers, allBookings]);

    const generateChartData = React.useCallback(() => {
        if (!selectedFacilityId || !allMembers || !allBookings) return;
        
        const monthlyData: { [key: string]: { month: string, revenue: number, members: number } } = {};
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = subMonths(today, i);
            const monthKey = format(d, 'MMM yy');
            monthlyData[monthKey] = { month: monthKey, revenue: 0, members: 0 };
        }
        
        allBookings.forEach(booking => {
            if (booking.paymentStatus === 'paid' && booking.paymentAmount) {
                 const monthKey = format(booking.startTime, 'MMM yy');
                 if(monthKey in monthlyData) {
                    monthlyData[monthKey].revenue += booking.paymentAmount;
                 }
            }
        });
        
        allMembers.forEach(member => {
            const monthKey = format(member.joinDate, 'MMM yy');
            if(monthKey in monthlyData) {
                monthlyData[monthKey].members += 1;
            }
        });
        
        setChartData(Object.values(monthlyData));
    }, [selectedFacilityId, allMembers, allBookings]);


    React.useEffect(() => {
        if (!allMembers || !allBookings) return;
        
        const fetchData = async () => {
            if (date?.from && date?.to) {
                const currentMetrics = await calculateMetrics(date.from, date.to);
                setCurrentPeriodSummary(currentMetrics);

                const periodDuration = differenceInDays(date.to, date.from);
                const prevFrom = subDays(date.from, periodDuration + 1);
                const prevTo = subDays(date.from, 1);
                const previousMetrics = await calculateMetrics(prevFrom, prevTo);
                setPreviousPeriodSummary(previousMetrics);
            }
            generateChartData();
            if (pageLoading) setPageLoading(false);
        }

        fetchData();
        
    }, [date, allMembers, allBookings, calculateMetrics, generateChartData, pageLoading]);
    
    const getComparison = (current: number, previous: number) => {
        if (previous === 0) {
            return current > 0 ? '+100.0%' : 'N/A';
        }
        const diff = ((current - previous) / previous) * 100;
        return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
    }

    const summaryData = {
        totalRevenue: {
            value: `$${currentPeriodSummary?.totalRevenue.toLocaleString() ?? '0'}`,
            comparison: getComparison(currentPeriodSummary?.totalRevenue ?? 0, previousPeriodSummary?.totalRevenue ?? 0),
        },
         totalBookings: {
            value: currentPeriodSummary?.totalBookings.toLocaleString() ?? '0',
            comparison: getComparison(currentPeriodSummary?.totalBookings ?? 0, previousPeriodSummary?.totalBookings ?? 0),
        },
        activeMembers: {
            value: `${currentPeriodSummary?.activeMembers ?? 0} / ${currentPeriodSummary?.canceledMembers ?? 0}`,
            comparison: 'N/A', // Comparison not applicable here
        },
        bayUtilization: {
            value: `${currentPeriodSummary?.bayUtilization.toFixed(1) ?? '0.0'}%`,
            comparison: getComparison(currentPeriodSummary?.bayUtilization ?? 0, previousPeriodSummary?.bayUtilization ?? 0),
        },
    }

    const bookingsForHeatmap = allBookings?.filter(b => date?.from && date?.to && b.startTime >= date.from && b.startTime <= date.to) || [];
    const bookingsForTable = allBookings?.filter(b => date?.from && date?.to && b.startTime >= date.from && b.startTime <= date.to).sort((a,b) => b.startTime.getTime() - a.startTime.getTime()) || [];

    if (pageLoading) {
        return <div className="flex items-center justify-center h-screen"><p>Loading reports...</p></div>;
    }

    return (
        <div className="flex flex-col sm:gap-4 sm:py-4 flex-grow">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                <h1 className="text-xl font-semibold">Reports &amp; Analytics</h1>
                <div className="ml-auto flex items-center gap-4">
                    {facilities.length > 1 && (
                         <Select value={selectedFacilityId ?? ""} onValueChange={setSelectedFacilityId}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select Facility" />
                            </SelectTrigger>
                            <SelectContent>
                                {facilities.map(f => (
                                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                    "w-[240px] justify-start text-left font-normal",
                                    !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date?.from ? (
                                    date.to ? (
                                        <>
                                            {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                                        </>
                                    ) : (
                                        format(date.from, "LLL dd, y")
                                    )
                                ) : (
                                    <span>Pick a date</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={setDate}
                                numberOfMonths={2}
                            />
                        </PopoverContent>
                    </Popover>
                    <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Export</Button>
                </div>
            </header>
            <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {!currentPeriodSummary ? (
                       <>
                        <Skeleton className="h-28" />
                        <Skeleton className="h-28" />
                        <Skeleton className="h-28" />
                        <Skeleton className="h-28" />
                       </>
                    ) : (
                        <>
                        <StatCard title="Total Revenue" value={summaryData.totalRevenue.value} comparisonValue={summaryData.totalRevenue.comparison} icon={BarChartIcon} />
                        <StatCard title="Total Bookings" value={summaryData.totalBookings.value} comparisonValue={summaryData.totalBookings.comparison} icon={TrendingUp} />
                        <StatCard title="Active vs Canceled Members" value={summaryData.activeMembers.value} comparisonValue={summaryData.activeMembers.comparison} icon={Users} />
                        <StatCard title="Average Bay Utilization" value={summaryData.bayUtilization.value} comparisonValue={summaryData.bayUtilization.comparison} icon={Percent} />
                        </>
                    )}
                </div>
                
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                     <Card>
                        <CardHeader>
                            <CardTitle>Revenue Over Time</CardTitle>
                             <CardDescription>Showing revenue from the last 6 months.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                                <BarChart data={chartData} accessibilityLayer>
                                    <ChartGrid vertical={false} />
                                    <ChartXAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
                                    <ChartYAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${value/1000}k`} />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <ChartLegend content={<ChartLegendContent />} />
                                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                                </BarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle>Bookings Heatmap</CardTitle>
                            <CardDescription>Visualizing peak booking times for the selected period.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <BookingsHeatmap bookings={bookingsForHeatmap} />
                        </CardContent>
                    </Card>
                </div>

                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle>Detailed Reports</CardTitle>
                             <CardDescription>Select a report type to view detailed data tables.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="bookings">
                                <TabsList>
                                    <TabsTrigger value="bookings">Bookings</TabsTrigger>
                                    <TabsTrigger value="members">Members</TabsTrigger>
                                    <TabsTrigger value="revenue">Revenue</TabsTrigger>
                                </TabsList>
                                <TabsContent value="bookings" className="pt-4">
                                     <DetailedBookingsTable data={bookingsForTable} />
                                </TabsContent>
                                <TabsContent value="members" className="pt-4">
                                    <div className="h-96 flex items-center justify-center border rounded-lg">
                                       <div className="text-center text-muted-foreground">Detailed member reports coming soon.</div>
                                    </div>
                                </TabsContent>
                                <TabsContent value="revenue" className="pt-4">
                                    <div className="h-96 flex items-center justify-center border rounded-lg">
                                       <div className="text-center text-muted-foreground">Detailed revenue reports coming soon.</div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>

            </main>
        </div>
    );
}
