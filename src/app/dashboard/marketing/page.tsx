
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { PlusCircle, Megaphone, Trash2, Edit, Users, BarChart, Send } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
} from 'firebase/firestore';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface Campaign {
    id: string;
    title: string;
    content: string;
    status: 'draft' | 'published';
    createdAt: Date;
    publishedAt?: Date;
    audience?: string; // e.g., "Current Members"
}

const campaignSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(3, 'Title must be at least 3 characters long.'),
    content: z.string().min(10, 'Content must be at least 10 characters long.'),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

const audiences = [
    { id: 'current_members', name: 'Current Members', description: 'All members with an active subscription.' },
    { id: 'past_guests', name: 'Past Guests', description: 'Users who have booked but never became members.' },
    { id: 'lapsed_members', name: 'Lapsed Members', description: 'Members whose subscriptions have expired or been canceled.' },
    { id: 'vip_members', name: 'VIP Members', description: 'High-value members based on spend or visit frequency.' },
];


export default function MarketingPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [facilityId, setFacilityId] = useState<string | null>(null);
    
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
    const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null);

    const form = useForm<CampaignFormData>({ resolver: zodResolver(campaignSchema) });

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
            setCampaigns([]);
            return;
        }

        const q = query(collection(db, `facilities/${facilityId}/campaigns`), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedCampaigns = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: (data.createdAt as Timestamp).toDate(),
                    publishedAt: data.publishedAt ? (data.publishedAt as Timestamp).toDate() : undefined,
                } as Campaign;
            });
            setCampaigns(fetchedCampaigns);
        });

        return () => unsubscribe();
    }, [facilityId]);
    
    const handleOpenForm = (campaign: Campaign | null = null) => {
        setEditingCampaign(campaign);
        if (campaign) {
            form.reset(campaign);
        } else {
            form.reset({ title: '', content: '' });
        }
        setFormOpen(true);
    };

    const handleCloseForm = () => {
        setFormOpen(false);
        setEditingCampaign(null);
        form.reset();
    };

    const handleSave = async (data: CampaignFormData) => {
        if (!facilityId) return;

        const payload = { ...data, status: 'draft' };

        if (editingCampaign) {
            const docRef = doc(db, `facilities/${facilityId}/campaigns`, editingCampaign.id);
            await updateDoc(docRef, data);
        } else {
            const collectionRef = collection(db, `facilities/${facilityId}/campaigns`);
            await addDoc(collectionRef, { ...payload, createdAt: serverTimestamp() });
        }
        handleCloseForm();
    };

    const handleDelete = async () => {
        if (!facilityId || !deletingCampaign) return;
        
        await deleteDoc(doc(db, `facilities/${facilityId}/campaigns`, deletingCampaign.id));
        setDeletingCampaign(null);
    }
    
    if (loading) {
        return <div className="flex items-center justify-center h-screen"><p>Loading...</p></div>;
    }

    if (!facilityId && !loading) {
        return <div className="flex items-center justify-center h-screen"><p>No facility found for this account.</p></div>;
    }

    return (
        <div className="flex flex-col sm:gap-4 sm:py-4 flex-grow">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                <h1 className="text-xl font-semibold">Marketing Hub</h1>
                <div className="ml-auto">
                    <Button size="sm" className="h-8 gap-1" onClick={() => handleOpenForm()}>
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                            New Campaign
                        </span>
                    </Button>
                </div>
            </header>
            <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                 <Card>
                    <CardHeader>
                        <CardTitle>Dashboard</CardTitle>
                        <CardDescription>
                            An overview of your marketing campaigns and audiences.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="campaigns">
                            <TabsList>
                                <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
                                <TabsTrigger value="audiences">Audiences</TabsTrigger>
                                <TabsTrigger value="reports" disabled>Reports</TabsTrigger>
                            </TabsList>
                            <TabsContent value="campaigns" className="pt-6">
                                <div className="space-y-4">
                                    {campaigns.length > 0 ? (
                                        campaigns.map(campaign => (
                                            <Card key={campaign.id}>
                                                <CardHeader>
                                                    <CardTitle className="flex justify-between items-start">
                                                        <span>{campaign.title}</span>
                                                        <div className="flex items-center gap-2">
                                                             <Badge variant={campaign.status === 'published' ? 'default' : 'secondary'}>{campaign.status}</Badge>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenForm(campaign)}>
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingCampaign(campaign)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </CardTitle>
                                                    <CardDescription>
                                                        Created on {format(campaign.createdAt, 'PPP')}
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent>
                                                    <p className="text-sm text-muted-foreground line-clamp-2">{campaign.content}</p>
                                                </CardContent>
                                                <CardFooter className="flex justify-between">
                                                    <div className="text-sm text-muted-foreground">
                                                        Audience: {campaign.audience || 'None'}
                                                    </div>
                                                    <Button size="sm" variant="outline" disabled={campaign.status === 'published'}>
                                                        <Send className="mr-2 h-4 w-4" /> Send
                                                    </Button>
                                                </CardFooter>
                                            </Card>
                                        ))
                                    ) : (
                                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                                            <Megaphone className="mx-auto h-12 w-12 text-muted-foreground" />
                                            <h3 className="mt-2 text-sm font-semibold text-gray-900">No campaigns yet</h3>
                                            <p className="mt-1 text-sm text-gray-500">Get started by creating a new campaign.</p>
                                            <Button className="mt-4" onClick={() => handleOpenForm()}>Create Campaign</Button>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                             <TabsContent value="audiences" className="pt-6">
                                <div className="grid gap-4 md:grid-cols-2">
                                    {audiences.map(audience => (
                                        <Card key={audience.id}>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <Users className="h-5 w-5 text-primary" />
                                                    {audience.name}
                                                </CardTitle>
                                                <CardDescription>{audience.description}</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                {/* In the future, we'll calculate and show the size here */}
                                                <p className="text-2xl font-bold">--</p>
                                                <p className="text-xs text-muted-foreground">members</p>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                             </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </main>
            
             <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCampaign ? 'Edit Campaign' : 'New Campaign Draft'}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Title</FormLabel>
                                        <FormControl><Input {...field} placeholder="e.g., August Member Promotion" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="content"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Content</FormLabel>
                                        <FormControl><Textarea {...field} rows={8} placeholder="Craft your message here..." /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={handleCloseForm}>Cancel</Button>
                                <Button type="submit">Save Draft</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

             <AlertDialog open={deletingCampaign !== null} onOpenChange={(isOpen) => !isOpen && setDeletingCampaign(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the campaign titled "{deletingCampaign?.title}".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
