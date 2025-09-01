
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
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

export default function MembersPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [facilities, setFacilities] = useState<{id: string, name: string}[]>([]);
    const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
    const [membershipPlans, setMembershipPlans] = useState<string[]>([]);
    
    const [members, setMembers] = useState<Member[]>([]);
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
            try {
                const q = query(collection(db, 'facilities'), where('ownerId', '==', user.uid));
                const querySnapshot = await getDocs(q);
                const userFacilities = querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name as string }));
                setFacilities(userFacilities);
                if (userFacilities.length > 0) {
                    setSelectedFacility(userFacilities[0].id);
                }
            } catch (error) {
                console.error("Error fetching facilities: ", error);
            } finally {
                setLoading(false);
            }
        };
        fetchFacilities();
    }, [user]);

    useEffect(() => {
        if (!selectedFacility) {
            setMembers([]);
            return;
        }

        const memberQuery = query(collection(db, `facilities/${selectedFacility}/members`));
        const memberUnsubscribe = onSnapshot(memberQuery, (snapshot) => {
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
        });

        // Also listen for changes on facility to update plans dynamically
        const facilityRef = doc(db, 'facilities', selectedFacility);
        const facilityUnsubscribe = onSnapshot(facilityRef, (docSnap) => {
            if (docSnap.exists()) {
                const facilityData = docSnap.data();
                if (facilityData.landingPage && Array.isArray(facilityData.landingPage.plans)) {
                    const planNames = facilityData.landingPage.plans.map((p: LandingPagePlan) => p.name);
                    setMembershipPlans(planNames);
                } else {
                    setMembershipPlans([]);
                }
            }
        });


        return () => {
            memberUnsubscribe();
            facilityUnsubscribe();
        }

    }, [selectedFacility]);

    const handleSaveMember = async (memberData: any) => {
        if (!selectedFacility) {
            console.error("No facility ID found, cannot save member.");
            return;
        };
        
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
    };
    
    const handleDeleteMember = async (memberId: string) => {
        if (!selectedFacility) return;
        const memberRef = doc(db, `facilities/${selectedFacility}/members`, memberId);
        await deleteDoc(memberRef);
    };

    if (loading) {
        return <div className="flex items-center justify-center h-screen"><p>Loading...</p></div>;
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

    const filteredMembers = members.filter(member => 
        member.fullName.toLowerCase().includes(filter.toLowerCase()) ||
        member.email.toLowerCase().includes(filter.toLowerCase()) ||
        (member.phone && member.phone.toLowerCase().includes(filter.toLowerCase()))
    );

    return (
        <div className="flex flex-col sm:gap-4 sm:py-4 flex-grow">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                <h1 className="text-xl font-semibold">Members</h1>
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
            <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                {!selectedFacility ? (
                    <div className="flex items-center justify-center p-8">
                        <p className="text-muted-foreground">Select a facility to view and manage members.</p>
                    </div>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle>Member List</CardTitle>
                            <CardDescription>
                                View, manage, and add members to your facility. Click a row to see booking history.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <MembersTable 
                                data={filteredMembers}
                                isAddMemberOpen={isAddMemberOpen}
                                setAddMemberOpen={setAddMemberOpen}
                                onSave={handleSaveMember}
                                onDelete={handleDeleteMember}
                                membershipPlans={membershipPlans}
                            />
                        </CardContent>
                    </Card>
                )}
            </main>
        </div>
    );
}
