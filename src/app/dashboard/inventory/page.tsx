
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle } from 'lucide-react';
import { InventoryTable, InventoryItem, InventoryFormData } from './inventory-table';
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
    orderBy,
    writeBatch,
    getDoc,
} from 'firebase/firestore';
import { Bay } from '../bookings/bay-status';
import { parseISO } from 'date-fns';


export default function InventoryPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [facilityId, setFacilityId] = useState<string | null>(null);

    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [bays, setBays] = useState<Bay[]>([]);
    const [isItemFormOpen, setItemFormOpen] = useState(false);
    
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
            try {
                const q = query(collection(db, 'facilities'), where('ownerId', '==', user.uid));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const facilityDoc = querySnapshot.docs[0];
                    setFacilityId(facilityDoc.id);
                }
            } catch (error) {
                 console.error("Error fetching facility:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchFacility();
    }, [user]);

    useEffect(() => {
        if (!facilityId) {
            setInventory([]);
            setBays([]);
            return;
        }

        const inventoryQuery = query(collection(db, `facilities/${facilityId}/inventory`), orderBy('itemName'));
        const inventoryUnsubscribe = onSnapshot(inventoryQuery, (snapshot) => {
            const fetchedItems = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    warrantyExpiration: data.warrantyExpiration ? (data.warrantyExpiration as Timestamp).toDate() : undefined,
                    createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date(),
                } as InventoryItem;
            });
            setInventory(fetchedItems);
        }, (error) => {
            console.error("Error fetching inventory:", error);
        });

        const baysQuery = query(collection(db, `facilities/${facilityId}/bays`), orderBy('name'));
        const baysUnsubscribe = onSnapshot(baysQuery, (snapshot) => {
            const fetchedBays = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bay));
            setBays(fetchedBays);
        }, (error) => {
            console.error("Error fetching bays:", error);
        });


        return () => {
            inventoryUnsubscribe();
            baysUnsubscribe();
        };

    }, [facilityId]);

    const handleSaveItem = async (itemData: InventoryFormData) => {
        if (!facilityId || !user || !user.displayName) return;

        const batch = writeBatch(db);
        const logRef = doc(collection(db, `facilities/${facilityId}/auditLogs`));

        const assignedBay = bays.find(b => b.id === itemData.assignedBayId);
        const warrantyDate = itemData.warrantyExpiration ? Timestamp.fromDate(parseISO(itemData.warrantyExpiration)) : null;
        
        const payload: any = {
            ...itemData,
            itemName: itemData.itemName === 'Other' ? itemData.customItemName! : itemData.itemName,
            brand: itemData.brand === 'Other' ? itemData.customBrand : (itemData.brand || ''),
            assignedBayId: itemData.assignedBayId === 'clear-selection' ? '' : itemData.assignedBayId || '',
            assignedBayName: itemData.assignedBayId === 'clear-selection' ? '' : assignedBay?.name || '',
            warrantyExpiration: warrantyDate,
            model: itemData.model || '',
            serialNumber: itemData.serialNumber || '',
            notes: itemData.notes || '',
        };
        delete payload.customItemName;
        delete payload.customBrand;


        if (itemData.id) {
            const itemRef = doc(db, `facilities/${facilityId}/inventory`, itemData.id);
            const originalItem = inventory.find(i => i.id === itemData.id);
            batch.update(itemRef, payload);
            
            batch.set(logRef, {
                action: 'update',
                changedBy: user.displayName,
                changedById: user.uid,
                timestamp: serverTimestamp(),
                details: { 
                    objectType: 'Inventory Item', 
                    objectId: itemData.id, 
                    objectName: payload.itemName,
                    source: 'Inventory Page' 
                },
                previousValue: { 
                    name: originalItem?.itemName, 
                    status: originalItem?.status, 
                    bay: originalItem?.assignedBayName || 'Unassigned'
                },
                newValue: { 
                    name: payload.itemName, 
                    status: payload.status, 
                    bay: payload.assignedBayName || 'Unassigned'
                },
            });

        } else {
            const itemRef = doc(collection(db, `facilities/${facilityId}/inventory`));
            batch.set(itemRef, {
                ...payload,
                createdAt: serverTimestamp(),
            });

            batch.set(logRef, {
                action: 'create',
                changedBy: user.displayName,
                changedById: user.uid,
                timestamp: serverTimestamp(),
                details: { 
                    objectType: 'Inventory Item', 
                    objectId: itemRef.id, 
                    objectName: payload.itemName,
                    source: 'Inventory Page'
                },
            });
        }
        await batch.commit();
    };

    const handleDeleteItem = async (itemId: string) => {
        if (!facilityId || !user || !user.displayName) return;

        const batch = writeBatch(db);
        const itemRef = doc(db, `facilities/${facilityId}/inventory`, itemId);
        const itemToDelete = inventory.find(i => i.id === itemId);
        
        if (itemToDelete) {
             const logRef = doc(collection(db, `facilities/${facilityId}/auditLogs`));
             batch.set(logRef, {
                action: 'delete',
                changedBy: user.displayName,
                changedById: user.uid,
                timestamp: serverTimestamp(),
                details: { 
                    objectType: 'Inventory Item', 
                    objectId: itemId, 
                    objectName: itemToDelete.itemName,
                    source: 'Inventory Page'
                },
            });
        }
        
        batch.delete(itemRef);
        await batch.commit();
    };

    const handleUpdateItemField = async (itemId: string, field: Partial<InventoryItem>) => {
        if (!facilityId || !user || !user.displayName) return;
        
        const batch = writeBatch(db);
        const itemRef = doc(db, `facilities/${facilityId}/inventory`, itemId);
        const originalItem = inventory.find(i => i.id === itemId);

        if (!originalItem) return;

        let updateData: {[key: string]: any} = {...field};
        
        if ('assignedBayId' in field) {
            const isUnassigning = field.assignedBayId === 'clear-selection' || field.assignedBayId === '';
            updateData.assignedBayId = isUnassigning ? '' : field.assignedBayId;
            updateData.assignedBayName = isUnassigning ? '' : (bays.find(b => b.id === field.assignedBayId)?.name || '');
        }

        batch.update(itemRef, updateData);

        const logRef = doc(collection(db, `facilities/${facilityId}/auditLogs`));
        batch.set(logRef, {
            action: 'update',
            changedBy: user.displayName,
            changedById: user.uid,
            timestamp: serverTimestamp(),
            details: { 
                objectType: 'Inventory Item', 
                objectId: itemId, 
                objectName: originalItem.itemName,
                source: 'Inventory Page'
            },
            previousValue: { ...Object.keys(field).reduce((acc, key) => ({ ...acc, [key]: originalItem[key as keyof InventoryItem] }), {}) },
            newValue: { ...field },
        });

        await batch.commit();
    };

    if (loading) {
        return <div className="flex items-center justify-center h-screen"><p>Loading...</p></div>;
    }

    if (!facilityId && !loading) {
         return (
            <div className="flex flex-col sm:gap-4 sm:py-4 flex-grow items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold">No Facility Found</h2>
                    <p className="text-muted-foreground">Please complete the registration process to create a facility.</p>
                    <Button onClick={() => router.push('/register')} className="mt-4">Go to Setup</Button>
                </div>
            </div>
        );
    }


    return (
        <div className="flex flex-col sm:gap-4 sm:py-4 flex-grow">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                <h1 className="text-xl font-semibold">Inventory</h1>
                <div className="ml-auto">
                    <Button size="sm" className="h-8 gap-1" onClick={() => setItemFormOpen(true)}>
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                            Add Item
                        </span>
                    </Button>
                </div>
            </header>
            <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Inventory List</CardTitle>
                        <CardDescription>
                            Track and manage all equipment and items for your facility.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <InventoryTable
                            data={inventory}
                            bays={bays}
                            isItemFormOpen={isItemFormOpen}
                            setItemFormOpen={setItemFormOpen}
                            onSave={handleSaveItem}
                            onDelete={handleDeleteItem}
                            onUpdateField={handleUpdateItemField}
                        />
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
