
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Users,
  Calendar,
  DollarSign,
  BarChart,
  PlusCircle,
  Settings,
  Users2,
  UserPlus,
  LayoutGrid,
  ClipboardCheck,
  CalendarClock,
  UserCheck,
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, Timestamp, orderBy, limit } from 'firebase/firestore';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, BarChart as RechartsBarChart, Bar, ChartXAxis, ChartYAxis, ChartGrid, AreaChart, Area } from '@/components/ui/chart';
import { BayStatus, Bay } from './bookings/bay-status';
import { Booking } from './bookings/booking-calendar';
import { Member } from './members/members-table';
import { format, subMonths, getMonth, getYear, isToday, isFuture, addDays, isWithinInterval } from 'date-fns';
import Link from 'next/link';


// Define the data structure for the dashboard
interface DashboardMetrics {
    currentMembers: number;
    expiringSoon: number;
    bookingsToday: number;
    visitsToday: number;
    bookingsThisMonth: number;
    visitsThisMonth: number;
    revenueThisMonth: number;
    availableBays: number;
    totalBays: number;
}
interface ChartData {
    month: string;
    revenue?: number;
    members?: number;
}

interface FacilityInfo {
    id: string;
    name: string;
    plan: {
      id: string;
      billingFrequency: string;
      isTrial: boolean;
      trialEndDate: Date;
    };
}

const allMetricCards = [
    { id: 'currentMembers', title: 'Current Members', icon: Users },
    { id: 'revenueThisMonth', title: 'Revenue (Month)', icon: DollarSign },
    { id: 'bookingsThisMonth', title: 'Bookings (Month)', icon: Calendar },
    { id: 'visitsThisMonth', title: 'Visits (Month)', icon: UserCheck },
    { id: 'expiringSoon', title: 'Memberships Expiring Soon', icon: CalendarClock },
    { id: 'bookingsToday', title: 'Bookings Today', icon: Calendar },
    { id: 'visitsToday', title: 'Visits Today', icon: ClipboardCheck },
    { id: 'availableBays', title: 'Available Bays', icon: BarChart },
];
  
const TrialBanner = ({ plan }: { plan: FacilityInfo['plan'] | undefined }) => {
    if (!plan || !plan.isTrial) return null;

    const trialEndDate = plan.trialEndDate.getTime();
    const now = new Date().getTime();
    const daysLeft = Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24));
  
    if (daysLeft <= 0) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Trial Expired</AlertTitle>
          <AlertDescription>
            Your free trial has ended. Please upgrade to a paid plan to continue using TeeBoxed.
            <Button asChild className="ml-4" size="sm">
                <Link href="/dashboard/billing">Go to Billing</Link>
            </Button>
          </AlertDescription>
        </Alert>
      );
    }
  
    return (
      <Alert>
        <AlertTitle>Welcome to your free trial!</AlertTitle>
        <AlertDescription>
            You have <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</strong> on the 
            <strong className="capitalize mx-1">{plan.id}</strong> plan.
            <Button asChild variant="outline" className="ml-4" size="sm">
                <Link href="/dashboard/billing">Upgrade Plan</Link>
            </Button>
        </AlertDescription>
      </Alert>
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

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    
    const [facilities, setFacilities] = useState<{id: string, name: string}[]>([]);
    const [selectedFacility, setSelectedFacility] = useState<string | null>(null);

    const [isFetchingData, setIsFetchingData] = useState(false);
    const [facilityInfo, setFacilityInfo] = useState<FacilityInfo | null>(null);
    const [metrics, setMetrics] = useState<DashboardMetrics>({ currentMembers: 0, expiringSoon: 0, bookingsToday: 0, visitsToday: 0, bookingsThisMonth: 0, visitsThisMonth: 0, revenueThisMonth: 0, availableBays: 0, totalBays: 0 });
    const [bays, setBays] = useState<Bay[]>([]);
    const [allBookings, setAllBookings] = useState<Booking[]>([]);
    const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [visibleCards, setVisibleCards] = useState<string[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('dashboard-visible-cards');
            return saved ? JSON.parse(saved) : ['currentMembers', 'revenueThisMonth', 'bookingsToday', 'availableBays'];
        }
        return ['currentMembers', 'revenueThisMonth', 'bookingsToday', 'availableBays'];
    });
    const [isCustomizeModalOpen, setCustomizeModalOpen] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('dashboard-visible-cards', JSON.stringify(visibleCards));
        }
    }, [visibleCards]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            setUser(user);
          } else {
            router.push('/login');
          }
          setLoading(false);
        });
        return () => unsubscribe();
    }, [router]);

    useEffect(() => {
        if (!user) return;
        
        const fetchFacilities = async () => {
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
                setFacilities([]);
            }
        };

        fetchFacilities();
    }, [user]);
    
    useEffect(() => {
        if (!selectedFacility) return;

        setIsFetchingData(true);

        const fetchFacilityInfo = async () => {
            const docRef = doc(db, 'facilities', selectedFacility);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const facilityDoc = docSnap.data();
                setFacilityInfo({
                    id: docSnap.id,
                    name: facilityDoc.name,
                    plan: {
                        ...facilityDoc.plan,
                        trialEndDate: facilityDoc.plan.trialEndDate ? facilityDoc.plan.trialEndDate.toDate() : new Date(),
                    },
                });
            }
        }
        fetchFacilityInfo();
        
        const generateMonthlyKeys = () => {
             const today = new Date();
             const keys: {[key: string]: { month: string, revenue: number, members: number }} = {};
             for (let i = 5; i >= 0; i--) {
                const d = subMonths(today, i);
                const monthKey = format(d, 'MMM yy');
                keys[monthKey] = { month: monthKey, revenue: 0, members: 0 };
             }
             return keys;
        };


        const membersQuery = query(collection(db, `facilities/${selectedFacility}/members`));
        const membersUnsubscribe = onSnapshot(membersQuery, (snapshot) => {
            const members = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    joinDate: data.joinDate ? (data.joinDate as Timestamp).toDate() : new Date(),
                    membershipExpiry: data.membershipExpiry ? (data.membershipExpiry as Timestamp).toDate() : new Date(),
                } as Member;
            });

            const currentMembers = members.filter(m => m.status === 'active').length;
            
            const now = new Date();
            const thirtyDaysFromNow = addDays(now, 30);
            const expiringSoon = members.filter(m => 
                m.status === 'active' &&
                isWithinInterval(m.membershipExpiry, { start: now, end: thirtyDaysFromNow })
            ).length;

            setMetrics(prev => ({...prev, currentMembers, expiringSoon }));
            
            setChartData(prevChartData => {
                const monthlyData = generateMonthlyKeys();
                
                prevChartData.forEach(cd => {
                     if (monthlyData[cd.month]) {
                        monthlyData[cd.month].revenue = cd.revenue || 0;
                     }
                });

                members.forEach(member => {
                    if (member.joinDate) {
                        const monthKey = format(member.joinDate, 'MMM yy');
                        if(monthKey in monthlyData) {
                             monthlyData[monthKey].members = (monthlyData[monthKey].members || 0) + 1;
                        }
                    }
                });
                return Object.values(monthlyData);
            });
        });

        const bookingsQuery = query(collection(db, `facilities/${selectedFacility}/bookings`), orderBy('startTime', 'asc'));
        const bookingsUnsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
            const today = new Date();

            const bookings = snapshot.docs.map(doc => {
                const data = doc.data();
                return { id: doc.id, ...data, startTime: (data.startTime as Timestamp).toDate(), endTime: (data.endTime as Timestamp).toDate() } as Booking;
            });
            setAllBookings(bookings);
            
            const todayBookings = bookings.filter(b => isToday(b.startTime));
            const bookingsTodayCount = todayBookings.length;
            const visitsTodayCount = todayBookings.filter(b => ['checked-in', 'completed'].includes(b.status)).length;
            
            const currentMonth = getMonth(today);
            const currentYear = getYear(today);
            
            const monthBookings = bookings.filter(b => getMonth(b.startTime) === currentMonth && getYear(b.startTime) === currentYear);
            const bookingsThisMonthCount = monthBookings.length;
            const visitsThisMonthCount = monthBookings.filter(b => ['checked-in', 'completed'].includes(b.status)).length;

            const revenueThisMonth = bookings
                .filter(b => b.paymentStatus === 'paid' && getMonth(b.startTime) === currentMonth && getYear(b.startTime) === currentYear)
                .reduce((sum, b) => sum + (b.paymentAmount || 0), 0);

            setMetrics(prev => ({...prev, bookingsToday: bookingsTodayCount, visitsToday: visitsTodayCount, revenueThisMonth, bookingsThisMonth: bookingsThisMonthCount, visitsThisMonth: visitsThisMonthCount }));
            setUpcomingBookings(
                bookings.filter(b => b.status === 'confirmed' && isFuture(b.startTime) && isToday(b.startTime))
            );

            setChartData(prevChartData => {
                const monthlyData = generateMonthlyKeys();

                prevChartData.forEach(cd => {
                     if (monthlyData[cd.month]) {
                        monthlyData[cd.month].members = cd.members || 0;
                     }
                });

                bookings.forEach(booking => {
                    if (booking.paymentStatus === 'paid' && booking.paymentAmount) {
                         const monthKey = format(booking.startTime, 'MMM yy');
                         if(monthKey in monthlyData) {
                            monthlyData[monthKey].revenue = (monthlyData[monthKey].revenue || 0) + booking.paymentAmount;
                         }
                    }
                });

                return Object.values(monthlyData);
            });
        });

        const baysQuery = query(collection(db, `facilities/${selectedFacility}/bays`));
        const baysUnsubscribe = onSnapshot(baysQuery, (snapshot) => {
            const fetchedBays = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bay));
            setBays(fetchedBays);
            const totalBays = snapshot.size;
            const availableBays = fetchedBays.filter(doc => doc.status === 'available').length;
            setMetrics(prev => ({ ...prev, totalBays, availableBays }));
        });
        
        setIsFetchingData(false);

        return () => {
            membersUnsubscribe();
            bookingsUnsubscribe();
            baysUnsubscribe();
        }

    }, [selectedFacility]);

    const displayMetrics: { [key: string]: string } = useMemo(() => ({
        currentMembers: metrics.currentMembers.toString(),
        expiringSoon: metrics.expiringSoon.toString(),
        bookingsToday: metrics.bookingsToday.toString(),
        visitsToday: metrics.visitsToday.toString(),
        bookingsThisMonth: metrics.bookingsThisMonth.toString(),
        visitsThisMonth: metrics.visitsThisMonth.toString(),
        revenueThisMonth: `$${metrics.revenueThisMonth.toLocaleString()}`,
        availableBays: `${metrics.availableBays} / ${metrics.totalBays}`
    }), [metrics]);

    const handleCardVisibilityChange = (cardId: string, checked: boolean) => {
        setVisibleCards(prev => 
            checked ? [...prev, cardId] : prev.filter(id => id !== cardId)
        );
    };

    if (loading || !user) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p>Loading...</p>
            </div>
        )
    }

  return (
    <div className="flex flex-col sm:gap-4 sm:py-4 flex-grow">
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="ml-auto flex items-center gap-2">
            <Select value={selectedFacility ?? ""} onValueChange={setSelectedFacility}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select Facility" />
                </SelectTrigger>
                <SelectContent>
                    {facilities.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                    {facilities.length === 0 && <SelectItem value="no-facilities" disabled>No facilities found</SelectItem>}
                </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setCustomizeModalOpen(true)}>
                <LayoutGrid className="mr-2 h-4 w-4" /> Customize
            </Button>
        </div>
    </header>
    <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
        <div className="space-y-4">
        
        {facilities.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <p className="text-muted-foreground">No facilities found. Create your first facility to get started.</p>
                <Button onClick={() => router.push('/register')}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create Facility
                </Button>
            </div>
        ) : isFetchingData || !facilityInfo ? (
            <div className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">Loading facility data...</p>
            </div>
        ) : (
            <>
                <TrialBanner plan={facilityInfo.plan} />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {allMetricCards.filter(card => visibleCards.includes(card.id)).map(card => (
                         <Card key={card.id}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                                <card.icon className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{displayMetrics[card.id]}</div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Bay Status Overview</CardTitle>
                             <CardDescription>Real-time status of all your golf bays. Click a bay to see today's schedule.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {bays.length > 0 ? (
                                <BayStatus bays={bays} bookings={allBookings} onUpdateBayStatus={() => {}} />
                            ) : (
                                <p className="text-muted-foreground text-center py-8">No bays have been configured for this facility.</p>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                        <CardTitle>Today's Upcoming Bookings</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Member</TableHead>
                                    <TableHead>Bay</TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {upcomingBookings.map((booking) => (
                                        <TableRow key={booking.id}>
                                        <TableCell>{format(booking.startTime, 'p')}</TableCell>
                                        <TableCell className="font-medium">{booking.memberName}</TableCell>
                                        <TableCell>{booking.bayName}</TableCell>
                                        </TableRow>
                                    ))}
                                    {upcomingBookings.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center h-24">No upcoming bookings for today.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Revenue Over Time</CardTitle>
                            <CardDescription>Showing revenue from the last 6 months.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                                <RechartsBarChart data={chartData} accessibilityLayer>
                                    <ChartGrid vertical={false} />
                                    <ChartXAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
                                    <ChartYAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <ChartLegend content={<ChartLegendContent />} />
                                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                                </RechartsBarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>New Members by Month</CardTitle>
                             <CardDescription>Showing new members from the last 6 months.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                                <AreaChart data={chartData} accessibilityLayer margin={{ left: 12, right: 12 }}>
                                    <ChartGrid vertical={false} />
                                    <ChartXAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
                                    <ChartYAxis tickLine={false} axisLine={false} allowDecimals={false} />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <ChartLegend content={<ChartLegendContent />} />
                                    <Area dataKey="members" type="natural" fill="var(--color-members)" fillOpacity={0.4} stroke="var(--color-members)" />
                                </AreaChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Button variant="outline" size="lg" onClick={() => router.push('/dashboard/bookings?action=new')}><PlusCircle className="mr-2 h-4 w-4" /> New Booking</Button>
                    <Button variant="outline" size="lg" onClick={() => router.push('/dashboard/members?action=add')}><UserPlus className="mr-2 h-4 w-4" /> Add Member</Button>
                    <Button variant="outline" size="lg" onClick={() => router.push('/dashboard/staff')}><Users2 className="mr-2 h-4 w-4" /> Manage Staff</Button>
                    <Button variant="outline" size="lg" onClick={() => router.push('/dashboard/facility')}><Settings className="mr-2 h-4 w-4" /> Facility Settings</Button>
                </div>

            </>
        )}
    </div>
        <Dialog open={isCustomizeModalOpen} onOpenChange={setCustomizeModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Customize Dashboard</DialogTitle>
                    <DialogDescription>Select the metrics you want to see on your dashboard.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                    {allMetricCards.map(card => (
                        <div key={card.id} className="flex items-center space-x-2">
                            <Switch
                                id={card.id}
                                checked={visibleCards.includes(card.id)}
                                onCheckedChange={(checked) => handleCardVisibilityChange(card.id, checked)}
                            />
                            <Label htmlFor={card.id} className="cursor-pointer">{card.title}</Label>
                        </div>
                    ))}
                </div>
                <DialogFooter>
                    <Button onClick={() => setCustomizeModalOpen(false)}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </main>
    </div>
  );
}
