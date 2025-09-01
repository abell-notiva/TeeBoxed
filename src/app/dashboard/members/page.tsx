
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Search, Users, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MembersTable, Member } from './members-table';
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
    deleteDoc,
    getDoc,
} from 'firebase/firestore';

interface LandingPagePlan {
    name: string;
    price: number;
    features: string[];
}

interface Facility {
    id: string;
    name: string;
    slug: string;
    landingPage?: {
        plans?: LandingPagePlan[];
    };
}

export default function MembersPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
    const [membershipPlans, setMembershipPlans] = useState<string[]>([]);
    
    const [members, setMembers] = useState<Member[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [isAddMemberOpen, setAddMemberOpen] = useState(false);
    const [filter, setFilter] = useState('');

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
        if (action === 'add') {
            setAddMemberOpen(true);
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
                        landingPage: data.landingPage
                    };
                });
                setFacilities(userFacilities);
                if (userFacilities.length > 0) {
                    setSelectedFacility(userFacilities[0].id);
                }
            } catch (error) {
                console.error("Error fetching facilities: ", error);
                setError("Failed to load facilities. Please try again.");
            } finally {
                setLoading(false);
            }
        };
        fetchFacilities();
    }, [user]);

    useEffect(() => {
        if (!selectedFacility) {
            setMembers([]);
            setMembershipPlans([]);
            return;
        }

        setMembersLoading(true);
        setError(null);

        const memberQuery = query(collection(db, `facilities/${selectedFacility}/members`));
        const memberUnsubscribe = onSnapshot(memberQuery, (snapshot) => {
            try {
                const fetchedMembers = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        joinDate: data.joinDate ? (data.joinDate as Timestamp).toDate() : new Date(),
                        membershipExpiry: data.membershipExpiry ? (data.membershipExpiry as Timestamp).toDate() : new Date(),
                    } as Member;
                });
                setMembers(fetchedMembers);
                setMembersLoading(false);
            } catch (error) {
                console.error("Error processing members data:", error);
                setError("Failed to load members data.");
                setMembersLoading(false);
            }
        }, (error) => {
            console.error("Error listening to members:", error);
            setError("Failed to load members. Please try again.");
            setMembersLoading(false);
        });

        // Listen for facility changes to update membership plans
        const facilityRef = doc(db, 'facilities', selectedFacility);
        const facilityUnsubscribe = onSnapshot(facilityRef, (docSnap) => {
            try {
                if (docSnap.exists()) {
                    const facilityData = docSnap.data();
                    if (facilityData.landingPage && Array.isArray(facilityData.landingPage.plans)) {
                        const planNames = facilityData.landingPage.plans.map((p: LandingPagePlan) => p.name);
                        setMembershipPlans(planNames);
                    } else {
                        setMembershipPlans([]);
                    }
                }
            } catch (error) {
                console.error("Error processing facility data:", error);
            }
        }, (error) => {
            console.error("Error listening to facility:", error);
        });

        return () => {
            memberUnsubscribe();
            facilityUnsubscribe();
        };

    }, [selectedFacility]);

    const handleSaveMember = async (memberData: any) => {
        if (!selectedFacility) {
            setError("No facility selected. Cannot save member.");
            return;
        }
        
        try {
            setError(null);
            const dataToSave = {
                ...memberData,
                membershipExpiry: Timestamp.fromDate(memberData.membershipExpiry)
            };
            
            if (memberData.id) {
                const memberRef = doc(db, `facilities/${selectedFacility}/members`, memberData.id);
                const { id, joinDate, ...updateData } = dataToSave;
                await updateDoc(memberRef, updateData);
            } else {
                const collectionRef = collection(db, `facilities/${selectedFacility}/members`);
                const { id, ...createData } = dataToSave;
                await addDoc(collectionRef, { 
                    ...createData, 
                    joinDate: serverTimestamp(),
                });
            }
        } catch (error) {
            console.error("Error saving member:", error);
            setError("Failed to save member. Please try again.");
            throw error;
        }
    };
    
    const handleDeleteMember = async (memberId: string) => {
        if (!selectedFacility) {
            setError("No facility selected. Cannot delete member.");
            return;
        }
        
        try {
            setError(null);
            const memberRef = doc(db, `facilities/${selectedFacility}/members`, memberId);
            await deleteDoc(memberRef);
        } catch (error) {
            console.error("Error deleting member:", error);
            setError("Failed to delete member. Please try again.");
            throw error;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col sm:gap-4 sm:py-4 flex-grow">
                <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                    <Skeleton className="h-6 w-24" />
                </header>
                <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-4 w-64" />
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {[...Array(3)].map((_, i) => (
                                    <Skeleton key={i} className="h-12 w-full" />
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
                <Users className="h-12 w-12 text-muted-foreground" />
                <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">No Facilities Found</h3>
                    <p className="text-muted-foreground">Create your first facility to start managing members.</p>
                </div>
                <Button onClick={() => router.push('/register')}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create Facility
                </Button>
            </div>
        );
    }

    const filteredMembers = members.filter(member => 
        member.fullName.toLowerCase().includes(filter.toLowerCase()) ||
        member.email.toLowerCase().includes(filter.toLowerCase()) ||
        (member.phone && member.phone.toLowerCase().includes(filter.toLowerCase()))
    );

    return (
        <div className="flex flex-col sm:gap-4 sm:py-4 flex-grow">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    <h1 className="text-xl font-semibold">Members</h1>
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
                    <div className="relative flex-1 md:grow-0">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search members..."
                            className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[250px]"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>
                    <Button size="sm" className="h-8 gap-1" onClick={() => setAddMemberOpen(true)} disabled={!selectedFacility}>
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                            Add Member
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
                                <Users className="h-12 w-12 text-muted-foreground mx-auto" />
                                <h3 className="text-lg font-semibold">Select a Facility</h3>
                                <p className="text-muted-foreground">Choose a facility from the dropdown to view and manage members.</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Users className="h-5 w-5" />
                                        Member Management
                                    </CardTitle>
                                    <CardDescription>
                                        Manage members for {facilities.find(f => f.id === selectedFacility)?.name}. Add new members, update details, and track membership status.
                                    </CardDescription>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {membersLoading ? "Loading..." : `${filteredMembers.length} of ${members.length} members`}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {membersLoading ? (
                                <div className="space-y-4">
                                    {[...Array(5)].map((_, i) => (
                                        <Skeleton key={i} className="h-12 w-full" />
                                    ))}
                                </div>
                            ) : (
                                <MembersTable 
                                    data={filteredMembers}
                                    isAddMemberOpen={isAddMemberOpen}
                                    setAddMemberOpen={setAddMemberOpen}
                                    onSave={handleSaveMember}
                                    onDelete={handleDeleteMember}
                                    membershipPlans={membershipPlans}
                                />
                            )}
                        </CardContent>
                    </Card>
                )}
            </main>
        </div>
    );
}
