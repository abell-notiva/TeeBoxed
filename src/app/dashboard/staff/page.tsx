
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { StaffTable, Staff, StaffFormData, AddStaffFormData } from './staff-table';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User, sendPasswordResetEmail } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import {
    collection,
    query,
    onSnapshot,
    where,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
    deleteDoc,
    writeBatch,
    Timestamp,
    getDoc
} from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, CheckCircle } from 'lucide-react';


export default function StaffPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [facilityId, setFacilityId] = useState<string | null>(null);

    const [staff, setStaff] = useState<Staff[]>([]);
    const [isAddStaffOpen, setAddStaffOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const currentUserRole = staff.find(s => s.id === user?.uid)?.role;
    const canManageStaff = currentUserRole === 'owner' || currentUserRole === 'admin';

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
        if (!user) return;

        const fetchFacility = async () => {
            setLoading(true);
            const q = query(collection(db, 'facilities'), where('ownerId', '==', user.uid));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const facilityDoc = querySnapshot.docs[0];
                setFacilityId(facilityDoc.id);
            }
            setLoading(false);
        };
        fetchFacility();
    }, [user]);

    useEffect(() => {
        if (!facilityId) {
            setStaff([]);
            return;
        }

        const staffQuery = query(collection(db, `facilities/${facilityId}/staff`));
        const staffUnsubscribe = onSnapshot(staffQuery, (snapshot) => {
            const fetchedStaff = snapshot.docs.map(doc => {
                 const data = doc.data();
                 return {
                     id: doc.id,
                     ...data,
                     lastLogin: data.lastLogin ? (data.lastLogin as Timestamp).toDate() : new Date(0),
                     createdByOwner: data.createdByOwner === true,
                 } as Staff
            });
            // Add owner to the list, ensuring user and displayname are available
            if (user && user.displayName && user.email) {
                const owner: Staff = {
                    id: user.uid,
                    fullName: user.displayName,
                    email: user.email,
                    role: 'owner',
                    status: 'active',
                    lastLogin: user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime) : new Date(),
                    createdByOwner: false,
                    facilityId: facilityId,
                };
                // Prevent duplicate owners if they are also in staff collection
                const staffWithoutOwner = fetchedStaff.filter(s => s.id !== user.uid);
                setStaff([owner, ...staffWithoutOwner]);
            } else {
                 // If user details aren't loaded yet, just show the fetched staff
                setStaff(fetchedStaff);
            }
        });

        return () => staffUnsubscribe();

    }, [facilityId, user]);


    const handleSaveStaff = async (staffData: StaffFormData) => {
        if (!facilityId || !user || !user.displayName) {
            setError("Cannot update staff member. Missing required information.");
            return;
        };
        if (!staffData.id) {
             setError("Cannot update staff member without an ID.");
             return;
        }

        setError(null);
        setSuccess(null);
    
        const batch = writeBatch(db);
        const staffRef = doc(db, `facilities/${facilityId}/staff`, staffData.id);
        const staffDoc = await getDoc(staffRef);

        if (!staffDoc.exists()) {
            setError("This staff member does not exist.");
            return;
        }

        const previousData = staffDoc.data();
        const { id, ...updateData } = staffData;
        batch.update(staffRef, updateData);

        const logRef = doc(collection(db, `facilities/${facilityId}/auditLogs`));
        batch.set(logRef, {
            action: 'update',
            changedBy: user.displayName,
            changedById: user.uid,
            timestamp: serverTimestamp(),
            details: { 
                objectType: 'Staff', 
                objectId: id, 
                objectName: staffData.fullName,
                source: 'Staff Page' 
            },
            previousValue: {
                role: previousData?.role,
                status: previousData?.status,
            },
            newValue: {
                role: updateData.role,
                status: updateData.status,
            }
        });

        try {
            await batch.commit();
            setSuccess(`Staff member updated successfully.`);
            setAddStaffOpen(false);
        } catch(err: any) {
            setError(`Failed to update staff member: ${'err.message'}`);
        }
    };
    
    const handleInviteStaff = async (data: AddStaffFormData) => {
        setError("Creating new staff members is disabled in this version. Please contact support to enable this feature.");
    };

    const handleDeleteStaff = async (staffId: string) => {
        if (!facilityId || !user || !user.displayName) {
            setError("Cannot remove staff member. Missing required information.");
            return;
        }
        
        const staffToDelete = staff.find(s => s.id === staffId);
        if (!staffToDelete) {
             setError("Could not find staff member to remove.");
            return;
        }

        // In a real app, you would call a cloud function to delete the auth user as well.
        // For this example, we only delete from the Firestore collection.
        const batch = writeBatch(db);
        const staffRef = doc(db, `facilities/${facilityId}/staff`, staffId);
        batch.delete(staffRef);

        const logRef = doc(collection(db, `facilities/${facilityId}/auditLogs`));
        batch.set(logRef, {
            action: 'delete',
            changedBy: user.displayName,
            changedById: user.uid,
            timestamp: serverTimestamp(),
            details: { 
                objectType: 'Staff', 
                objectId: staffId,
                objectName: staffToDelete.fullName,
                source: 'Staff Page'
            },
        });
        
        await batch.commit();
        setSuccess('Staff member removed.');
    }

    const handleResetPassword = async (staffId: string) => {
         if (!facilityId) return;
         setError(null);
         setSuccess(null);
         const staffToReset = staff.find(s => s.id === staffId);
         if (!staffToReset) {
            setError("Could not find staff member.");
            return;
         }
         try {
            await sendPasswordResetEmail(auth, staffToReset.email);
            setSuccess(`Password reset email sent to ${staffToReset.fullName}.`);
         } catch(err: any) {
            setError(err.message);
         }
    };
    
     if (loading) {
        return <div className="flex items-center justify-center h-screen"><p>Loading...</p></div>;
    }

    if (!facilityId && !loading) {
        return <div className="flex items-center justify-center h-screen"><p>No facility found for this account.</p></div>;
    }

    const filteredStaff = filter ? staff.filter(s => 
        s.fullName.toLowerCase().includes(filter.toLowerCase()) ||
        (s.email && s.email.toLowerCase().includes(filter.toLowerCase()))
    ) : staff;

    return (
        <div className="flex flex-col sm:gap-4 sm:py-4 flex-grow">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                <h1 className="text-xl font-semibold">Staff &amp; Roles</h1>
                <div className="relative ml-auto flex-1 md:grow-0">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search by name or email..."
                        className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
                {canManageStaff && (
                    <Button size="sm" className="h-8 gap-1" onClick={() => setAddStaffOpen(true)}>
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                            Add Staff
                        </span>
                    </Button>
                )}
            </header>
            <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                {error && <Alert variant="destructive"><Terminal className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                {success && <Alert variant="default" className="border-green-500 text-green-700"><CheckCircle className="h-4 w-4 text-green-600" /><AlertTitle>Success</AlertTitle><AlertDescription>{success}</AlertDescription></Alert>}

                 <Card>
                    <CardHeader>
                        <CardTitle>Staff List</CardTitle>
                        <CardDescription>
                            Create, manage, and assign roles to your staff members.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <StaffTable
                            data={filteredStaff}
                            isAddStaffOpen={isAddStaffOpen}
                            setAddStaffOpen={setAddStaffOpen}
                            onSave={handleSaveStaff}
                            onDelete={handleDeleteStaff}
                            onResetPassword={handleResetPassword}
                            onInvite={handleInviteStaff}
                            currentUserRole={currentUserRole}
                        />
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
