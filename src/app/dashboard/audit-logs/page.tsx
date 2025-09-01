
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { collection, query, onSnapshot, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

interface AuditLog {
    id: string;
    action: 'create' | 'update' | 'delete';
    changedById: string;
    changedBy: string;
    timestamp: Date;
    details?: any;
    previousValue?: any;
    newValue?: any;
}

const LogDetailsView = ({ log }: { log: AuditLog }) => {
    if (!log) return null;

    const getTitle = () => {
        const objectType = log.details?.objectType || 'Record';
        switch(log.action) {
            case 'create': return `${objectType} Created`;
            case 'update': return `${objectType} Updated`;
            case 'delete': return `${objectType} Deleted`;
            default: return 'Log Details';
        }
    }
    
    const renderSimpleDetails = (details: any) => {
        if (!details || Object.keys(details).length === 0) return <p className="text-sm text-muted-foreground">No additional details recorded.</p>;
        // Filter out objectId, objectType, objectName as they are displayed elsewhere
        const filteredDetails = Object.entries(details).filter(([key]) => !['objectId', 'objectType', 'objectName', 'source'].includes(key));

        if (filteredDetails.length === 0) return <p className="text-sm text-muted-foreground">No additional details recorded.</p>;
        
        return (
             <div className="text-sm grid grid-cols-[120px_1fr] gap-y-1">
                {filteredDetails.map(([key, value]) => (
                    <React.Fragment key={key}>
                        <span className="font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                        <span>{String(value)}</span>
                    </React.Fragment>
                ))}
            </div>
        )
    }

    const renderChangeDetails = () => {
        const hasChanges = log.previousValue && log.newValue && Object.keys(log.newValue).length > 0;

        if (log.action !== 'update' || !hasChanges) {
            return renderSimpleDetails(log.details || {});
        }

        const allKeys = new Set([...Object.keys(log.previousValue || {}), ...Object.keys(log.newValue || {})]);
        const changedKeys = Array.from(allKeys).filter(key => log.previousValue?.[key] !== log.newValue?.[key]);

        if (changedKeys.length === 0) {
             return <p className="text-sm text-muted-foreground">No fields were changed.</p>;
        }

        return (
            <div className="space-y-2">
                {changedKeys.map(key => {
                    const oldValue = log.previousValue?.[key] ?? 'N/A';
                    const newValue = log.newValue?.[key] ?? 'N/A';
                    
                    return (
                         <div key={key} className="text-sm grid grid-cols-[100px_1fr_1fr] gap-x-4 items-center">
                            <span className="font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                            <div className="text-red-600 line-through bg-red-50 p-1 rounded-md">{String(oldValue)}</div>
                            <div className="text-green-600 bg-green-50 p-1 rounded-md">{String(newValue)}</div>
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <>
            <DialogHeader>
                <DialogTitle>{getTitle()}</DialogTitle>
                <DialogDescription>
                    An auditable event was logged.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="text-sm grid grid-cols-[120px_1fr] gap-y-2">
                    <span className="font-semibold text-muted-foreground">Timestamp:</span>
                    <span>{format(log.timestamp, 'PPP p')}</span>

                    <span className="font-semibold text-muted-foreground">Action:</span>
                    <span><Badge variant={getActionBadgeVariant(log.action)} className="capitalize">{log.action}</Badge></span>

                    {log.details?.objectName && (
                         <>
                            <span className="font-semibold text-muted-foreground">{log.details.objectType || 'Subject'}:</span>
                            <span>{log.details.objectName}</span>
                         </>
                    )}

                    <span className="font-semibold text-muted-foreground">Initiated By:</span>
                    <span>{log.changedBy}</span>
                    
                     {log.details?.source && (
                         <>
                            <span className="font-semibold text-muted-foreground">Source:</span>
                            <span>{log.details.source}</span>
                         </>
                    )}
                </div>
                <Separator />
                <div>
                     <h4 className="font-semibold mb-2">{log.action === 'update' ? 'Change Details' : 'Creation/Deletion Details'}</h4>
                     {renderChangeDetails()}
                </div>
            </div>
        </>
    );
};


const getActionBadgeVariant = (action: AuditLog['action']) => {
    switch (action) {
        case 'create': return 'default';
        case 'update': return 'secondary';
        case 'delete': return 'destructive';
        default: return 'outline';
    }
};

export default function AuditLogPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [facilityId, setFacilityId] = useState<string | null>(null);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

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
            setLogs([]);
            return;
        }

        const logQuery = query(collection(db, `facilities/${facilityId}/auditLogs`), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(logQuery, (snapshot) => {
            const fetchedLogs = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    timestamp: (data.timestamp as Timestamp).toDate(),
                } as AuditLog;
            });
            setLogs(fetchedLogs);
        });

        return () => unsubscribe();
    }, [facilityId]);


    const formatDetailsSummary = (log: AuditLog) => {
        const objectName = log.details?.objectName || log.details?.objectId || 'a record';
        const objectType = log.details?.objectType || 'record';
        
        if (log.action === 'update') {
            const changes = log.newValue ? Object.keys(log.newValue).map(key => {
                const oldValue = log.previousValue?.[key];
                const newValue = log.newValue[key];
                 if(oldValue !== newValue) {
                    return key;
                }
                return null;
            }).filter(Boolean).join(', ') : 'fields';
            return `Updated ${changes} for ${objectType.toLowerCase()} "${objectName}"`;
        }
        if (log.action === 'create') {
            return `Created new ${objectType.toLowerCase()} "${objectName}"`;
        }
        if (log.action === 'delete') {
            return `Deleted ${objectType.toLowerCase()} "${objectName}"`;
        }
        return `Action: ${log.action} on ${objectName}`;
    }

    if (loading) {
        return <div className="flex items-center justify-center h-screen"><p>Loading...</p></div>;
    }
    
    return (
        <div className="flex flex-col sm:gap-4 sm:py-4 flex-grow">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                <h1 className="text-xl font-semibold">Audit Logs</h1>
            </header>
            <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Audit Trail</CardTitle>
                        <CardDescription>
                            An immutable log of all important changes made within your facility. Click a row for more details.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Initiated By</TableHead>
                                    <TableHead>Details Summary</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.length > 0 ? logs.map(log => (
                                    <TableRow key={log.id} onClick={() => setSelectedLog(log)} className="cursor-pointer">
                                        <TableCell>{format(log.timestamp, 'Pp')}</TableCell>
                                        <TableCell><Badge variant={getActionBadgeVariant(log.action)} className="capitalize">{log.action}</Badge></TableCell>
                                        <TableCell>{log.changedBy}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground truncate" style={{maxWidth: '450px'}}>{formatDetailsSummary(log)}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            No audit logs have been recorded yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </main>

            <Dialog open={selectedLog !== null} onOpenChange={(isOpen) => !isOpen && setSelectedLog(null)}>
                <DialogContent className="max-w-2xl">
                    {selectedLog && <LogDetailsView log={selectedLog} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}

    

    
