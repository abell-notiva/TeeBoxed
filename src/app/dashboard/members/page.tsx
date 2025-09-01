
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
    const [facilityId, setFacilityId] = useState<string | null>(null);
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
        
        const fetchFacility = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, 'facilities'), where('ownerId', '==', user.uid));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const facilityDoc = querySnapshot.docs[0];
                    setFacilityId(facilityDoc.id);

                    // Fetch membership plans from facility settings
                    const facilityData = facilityDoc.data();
                    if (facilityData.landingPage && Array.isArray(facilityData.landingPage.plans)) {
                        const planNames = facilityData.landingPage.plans.map((p: LandingPagePlan) => p.name);
                        setMembershipPlans(planNames);
                    }
                }
            } catch (error) {
                console.error("Error fetching facility: ", error);
            } finally {
                setLoading(false);
            }
        };
        fetchFacility();
    }, [user]);

    useEffect(() => {
        if (!facilityId) {
            setMembers([]);
            return;
        }

        const memberQuery = query(collection(db, `facilities/${facilityId}/members`));
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
        const facilityRef = doc(db, 'facilities', facilityId);
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

    }, [facilityId]);

    const handleSaveMember = async (memberData: any) => {
        if (!facilityId) {
            console.error("No facility ID found, cannot save member.");
            return;
        };
        
        const dataToSave = {
            ...memberData,
            membershipExpiry: Timestamp.fromDate(memberData.membershipExpiry)
        };
        
        if (memberData.id) {
            const memberRef = doc(db, `facilities/${facilityId}/members`, memberData.id);
            const { id, joinDate, ...updateData } = dataToSave;
            await updateDoc(memberRef, updateData);
        } else {
            const collectionRef = collection(db, `facilities/${facilityId}/members`);
            const { id, ...createData } = dataToSave;
            await addDoc(collectionRef, { 
                ...createData, 
                joinDate: serverTimestamp(),
            });
        }
    };
    
    const handleDeleteMember = async (memberId: string) => {
        if (!facilityId) return;
        const memberRef = doc(db, `facilities/${facilityId}/members`, memberId);
        await deleteDoc(memberRef);
    };

    if (loading) {
        return <div className="flex items-center justify-center h-screen"><p>Loading...</p></div>;
    }

    if (!facilityId && !loading) {
        return <div className="flex items-center justify-center h-screen"><p>No facility found for this account.</p></div>;
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
                <div className="relative ml-auto flex-1 md:grow-0">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search by name, email, or phone..."
                        className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
                <Button size="sm" className="h-8 gap-1" onClick={() => setAddMemberOpen(true)}>
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        Add Member
                    </span>
                </Button>
            </header>
            <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
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
            </main>
        </div>
    );
}
