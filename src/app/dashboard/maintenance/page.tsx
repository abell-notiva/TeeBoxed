
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle } from 'lucide-react';
import { MaintenanceTable, MaintenanceTask, MaintenanceTaskFormData } from './maintenance-table';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
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
    writeBatch,
    orderBy
} from 'firebase/firestore';
import { Staff } from '../staff/staff-table';
import { Bay } from '../bookings/bay-status';
import { InventoryItem } from '../inventory/inventory-table';

export default function MaintenancePage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [facilityId, setFacilityId] = useState<string | null>(null);

    const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [bays, setBays] = useState<Bay[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [isTaskFormOpen, setTaskFormOpen] = useState(false);

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
            setTasks([]);
            setStaff([]);
            setBays([]);
            setInventory([]);
            return;
        }

        // Fetch maintenance tasks
        const tasksQuery = query(collection(db, `facilities/${facilityId}/maintenance`), orderBy('createdAt', 'desc'));
        const tasksUnsubscribe = onSnapshot(tasksQuery, (snapshot) => {
            const fetchedTasks = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date(),
                    resolvedAt: data.resolvedAt ? (data.resolvedAt as Timestamp).toDate() : undefined,
                } as MaintenanceTask;
            });
            setTasks(fetchedTasks);
        });

        // Fetch staff
        const staffQuery = query(collection(db, `facilities/${facilityId}/staff`));
        const staffUnsubscribe = onSnapshot(staffQuery, (snapshot) => {
            const fetchedStaff = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
            if(user) {
                const owner = { id: user.uid, fullName: user.displayName || 'Owner', role: 'owner' } as Staff;
                // Filter out any existing staff member with the owner's UID before adding the owner
                const staffWithoutOwner = fetchedStaff.filter(s => s.id !== user.uid);
                setStaff([owner, ...staffWithoutOwner]);
            } else {
                setStaff(fetchedStaff);
            }
        });

        // Fetch bays
        const baysQuery = query(collection(db, `facilities/${facilityId}/bays`), orderBy('name'));
        const baysUnsubscribe = onSnapshot(baysQuery, (snapshot) => {
            const fetchedBays = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bay));
            setBays(fetchedBays);
        });
        
        // Fetch inventory
        const inventoryQuery = query(collection(db, `facilities/${facilityId}/inventory`), orderBy('itemName'));
        const inventoryUnsubscribe = onSnapshot(inventoryQuery, (snapshot) => {
            const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
            setInventory(fetchedItems);
        });


        return () => {
            tasksUnsubscribe();
            staffUnsubscribe();
            baysUnsubscribe();
            inventoryUnsubscribe();
        };

    }, [facilityId, user]);

    const handleSaveTask = async (taskData: MaintenanceTaskFormData) => {
        if (!facilityId || !user || !user.displayName) return;

        const assignedStaffMember = staff.find(s => s.id === taskData.assignedTo);
        const relatedInventoryItem = inventory.find(i => i.id === taskData.inventoryItemId);
        
        const payload: any = {
            bayId: taskData.bayId,
            bayName: bays.find(b => b.id === taskData.bayId)?.name || 'Unknown Bay',
            title: taskData.title,
            description: taskData.description || '',
            status: taskData.status || 'open',
            priority: taskData.priority,
            assignedTo: taskData.assignedTo || '',
            assignedStaffName: assignedStaffMember?.fullName || 'Unassigned',
            inventoryItemId: taskData.inventoryItemId || '',
            inventoryItemName: relatedInventoryItem ? `${relatedInventoryItem.itemName} ${relatedInventoryItem.brand ? `(${relatedInventoryItem.brand})` : ''}` : '',
        };

        const batch = writeBatch(db);
        const logRef = doc(collection(db, `facilities/${facilityId}/auditLogs`));

        if (taskData.id) { // Editing existing task
            const taskRef = doc(db, `facilities/${facilityId}/maintenance`, taskData.id);
            payload.updatedAt = serverTimestamp();
            batch.update(taskRef, payload);
            
            const originalTask = tasks.find(t => t.id === taskData.id);
            batch.set(logRef, {
                action: 'update',
                changedBy: user.displayName,
                changedById: user.uid,
                timestamp: serverTimestamp(),
                details: { 
                    objectType: 'Maintenance Task', 
                    objectId: taskData.id, 
                    objectName: taskData.title,
                    source: 'Maintenance Page'
                },
                previousValue: { status: originalTask?.status, assignedTo: originalTask?.assignedStaffName },
                newValue: { status: payload.status, assignedTo: payload.assignedStaffName },
            });

        } else { // Creating new task
            const taskRef = doc(collection(db, `facilities/${facilityId}/maintenance`));
            payload.createdAt = serverTimestamp();
            payload.status = 'open'; // Ensure new tasks are always open
            batch.set(taskRef, payload);
            
            // Set bay status to maintenance
            const bayRef = doc(db, `facilities/${facilityId}/bays`, taskData.bayId);
            batch.update(bayRef, { status: 'maintenance' });

            batch.set(logRef, {
                action: 'create',
                changedBy: user.displayName,
                changedById: user.uid,
                timestamp: serverTimestamp(),
                details: { 
                    objectType: 'Maintenance Task', 
                    objectId: taskRef.id, 
                    objectName: payload.title,
                    source: 'Maintenance Page'
                },
            });
        }
        
        await batch.commit();
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!facilityId || !user || !user.displayName) return;

        const taskToDelete = tasks.find(t => t.id === taskId);
        if (!taskToDelete) return;

        const batch = writeBatch(db);
        
        const taskRef = doc(db, `facilities/${facilityId}/maintenance`, taskId);
        batch.delete(taskRef);

        // Check if other open tasks for this bay exist
        const otherOpenTasksForBay = tasks.filter(t => t.bayId === taskToDelete.bayId && t.status !== 'resolved' && t.id !== taskId);

        // If this was the last open task, set bay to available
        if (otherOpenTasksForBay.length === 0) {
            const bayRef = doc(db, `facilities/${facilityId}/bays`, taskToDelete.bayId);
            batch.update(bayRef, { status: 'available' });
        }


        const logRef = doc(collection(db, `facilities/${facilityId}/auditLogs`));
        batch.set(logRef, {
            action: 'delete',
            changedBy: user.displayName,
            changedById: user.uid,
            timestamp: serverTimestamp(),
            details: { 
                objectType: 'Maintenance Task', 
                objectId: taskId, 
                objectName: taskToDelete.title,
                source: 'Maintenance Page'
            }
        });

        await batch.commit();
    };

    const handleResolveTask = async (task: MaintenanceTask) => {
        if (!facilityId || !user || !user.displayName) return;
        
        const batch = writeBatch(db);

        const taskRef = doc(db, `facilities/${facilityId}/maintenance`, task.id);
        batch.update(taskRef, { status: 'resolved', resolvedAt: serverTimestamp() });

        // Check if there are any other open maintenance tasks for this bay
        const otherTasksQuery = query(
            collection(db, `facilities/${facilityId}/maintenance`),
            where('bayId', '==', task.bayId),
            where('status', '!=', 'resolved')
        );
        const otherTasksSnapshot = await getDocs(otherTasksQuery);
        
        // If this is the LAST unresolved task for the bay, set it back to available
        if (otherTasksSnapshot.docs.filter(doc => doc.id !== task.id).length === 0) {
            const bayRef = doc(db, `facilities/${facilityId}/bays`, task.bayId);
            batch.update(bayRef, { status: 'available' });
        }


        const logRef = doc(collection(db, `facilities/${facilityId}/auditLogs`));
        batch.set(logRef, {
            action: 'update',
            changedBy: user.displayName,
            changedById: user.uid,
            timestamp: serverTimestamp(),
            details: { 
                objectType: 'Maintenance Task', 
                objectId: task.id, 
                objectName: task.title,
                source: 'Maintenance Page'
            },
            previousValue: { status: task.status },
            newValue: { status: 'resolved' },
        });

        await batch.commit();
    };

    const handleOpenForm = () => {
        setTaskFormOpen(true);
    }


    if (loading) {
        return <div className="flex items-center justify-center h-screen"><p>Loading...</p></div>;
    }

    if (!facilityId && !loading) {
        return <div className="flex items-center justify-center h-screen"><p>No facility found for this account.</p></div>;
    }

    const maintenanceStaff = staff.filter(s => s.role === 'maintenance' || s.role === 'admin' || s.role === 'owner');


    return (
        <div className="flex flex-col sm:gap-4 sm:py-4 flex-grow">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                <h1 className="text-xl font-semibold">Maintenance</h1>
                <div className="ml-auto">
                    <Button size="sm" className="h-8 gap-1" onClick={handleOpenForm}>
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                            Create Task
                        </span>
                    </Button>
                </div>
            </header>
            <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                 <Card>
                    <CardHeader>
                        <CardTitle>Maintenance Log</CardTitle>
                        <CardDescription>
                            Track and manage all maintenance issues for your facility's bays.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <MaintenanceTable
                            data={tasks}
                            staff={maintenanceStaff}
                            bays={bays}
                            inventory={inventory}
                            isTaskFormOpen={isTaskFormOpen}
                            setTaskFormOpen={setTaskFormOpen}
                            onSave={handleSaveTask}
                            onDelete={handleDeleteTask}
                            onResolve={handleResolveTask}
                        />
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
