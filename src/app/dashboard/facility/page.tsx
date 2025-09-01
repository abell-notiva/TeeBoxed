
'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Trash2, Copy, Upload, PlusCircle, CheckCircle, Terminal } from 'lucide-react';
import { auth, db, storage } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  addDoc,
  serverTimestamp,
  writeBatch,
  Timestamp,
  deleteDoc,
  collectionGroup,
  orderBy,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { Bay } from '../bookings/bay-status';
import { Staff } from '../staff/staff-table';
import { Textarea } from '@/components/ui/textarea';


type PlanID = 'basic' | 'growth' | 'pro' | 'enterprise';

const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const defaultBusinessHours = () => {
    const hours: { [key: string]: { open: string; close: string; isOpen: boolean } } = {};
    weekDays.forEach(day => {
        const isWeekend = day === 'saturday' || day === 'sunday';
        hours[day] = {
            open: isWeekend ? '10:00' : '09:00',
            close: isWeekend ? '20:00' : '22:00',
            isOpen: true
        };
    });
    return hours;
}

interface LandingPagePlan {
    name: string;
    price: number;
    features: string[];
}

interface LandingPagePackage {
    name: string;
    price: number;
    description: string;
}

interface LandingPageSettings {
    heroTitle?: string;
    heroSubtitle?: string;
    aboutSectionText?: string;
    plans?: LandingPagePlan[];
    packages?: LandingPagePackage[];
}


interface Facility {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  timeZone: string;
  slug: string;
  logoUrl?: string;
  ownerId: string;
  plan: {
    id: PlanID;
  };
  colors: {
    primary: string;
    accent: string;
  };
  settings: {
    defaultBookingDuration: number;
    maxConcurrentBookings: number;
    isOpen: boolean;
    businessHours: {
      [day: string]: { open: string; close: string; isOpen: boolean };
    };
  };
  landingPage?: LandingPageSettings;
}

const timezones = [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Anchorage', 'America/Honolulu'
];

const countries = ['USA', 'Canada'];

const planLimits: Record<PlanID, number> = {
    basic: 1,
    growth: 3,
    pro: 10,
    enterprise: Infinity,
};

const planHierarchy: PlanID[] = ['enterprise', 'pro', 'growth', 'basic'];

const addFacilitySchema = z.object({
    name: z.string().min(1, 'Facility name is required'),
    slug: z.string().min(3, 'URL must be at least 3 characters').regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'URL can only contain lowercase letters, numbers, and hyphens.'),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
    timeZone: z.string().optional(),
});
type AddFacilityFormData = z.infer<typeof addFacilitySchema>;

export default function FacilityPage() {
  const router = useRouter();
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [facilities, setFacilities] = React.useState<Facility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = React.useState<string>('');
  const [facilityData, setFacilityData] = React.useState<Partial<Facility>>({});
  const [bays, setBays] = React.useState<Bay[]>([]);
  const [currentUserRole, setCurrentUserRole] = React.useState<Staff['role'] | null>(null);


  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  
  const [highestPlan, setHighestPlan] = React.useState<PlanID>('basic');
  const facilityCount = facilities.length;
  const canAddFacility = facilityCount < (planLimits[highestPlan] || 0);

  const [isAddFacilityModalOpen, setAddFacilityModalOpen] = React.useState(false);
  const form = useForm<AddFacilityFormData>({ 
    resolver: zodResolver(addFacilitySchema),
    defaultValues: {
        name: '',
        slug: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        country: 'USA',
        timeZone: '',
    }
  });
  
  const generateSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');
  const watchName = form.watch('name');
  React.useEffect(() => {
    if (watchName) {
        form.setValue('slug', generateSlug(watchName));
    }
  }, [watchName, form]);

  // --- Data Fetching and State Management ---

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push('/login');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);
  
  React.useEffect(() => {
    if (!user) return;
    
    const q = query(collection(db, 'facilities'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const userFacilities = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Facility));
        setFacilities(userFacilities);
        
        if (userFacilities.length > 0) {
            const bestPlan = userFacilities.reduce((highest, current) => {
                const highestIndex = planHierarchy.indexOf(highest.plan.id);
                const currentIndex = planHierarchy.indexOf(current.plan.id);
                return currentIndex < highestIndex ? current : highest;
            });
            setHighestPlan(bestPlan.plan.id);
        }

        if (userFacilities.length > 0 && !selectedFacilityId) {
            setSelectedFacilityId(userFacilities[0].id);
        }
         // If the selected facility was deleted, select the first one in the list or clear it
         if (selectedFacilityId && !userFacilities.some(f => f.id === selectedFacilityId)) {
            setSelectedFacilityId(userFacilities.length > 0 ? userFacilities[0].id : '');
        }
    });

    return () => unsubscribe();
  }, [user, selectedFacilityId]);

  React.useEffect(() => {
    if (!selectedFacilityId || !user) {
        setFacilityData({});
        setLogoPreview(null);
        setBays([]);
        setCurrentUserRole(null);
        return;
    };

    const selected = facilities.find(f => f.id === selectedFacilityId);
    if(selected) {
        const facilityWithDefaults = {
            ...selected,
            settings: {
                ...selected.settings,
                businessHours: selected.settings?.businessHours || defaultBusinessHours()
            },
            landingPage: {
                heroTitle: selected.landingPage?.heroTitle || `Welcome to ${selected.name}`,
                heroSubtitle: selected.landingPage?.heroSubtitle || 'Your premier indoor golf experience.',
                aboutSectionText: selected.landingPage?.aboutSectionText || `Located in the heart of ${selected.city || 'town'}, ${selected.name} offers state-of-the-art golf simulators for players of all skill levels. Whether you're a seasoned pro looking to fine-tune your game or a beginner eager to learn, our facility provides a welcoming and professional environment.`,
                plans: selected.landingPage?.plans || [
                    { name: 'Basic', price: 99, features: ['2 bookings/month', 'Standard bay access'] },
                    { name: 'Pro', price: 199, features: ['10 bookings/month', 'Priority booking'] },
                    { name: 'Elite', price: 299, features: ['Unlimited bookings', 'Guest passes'] },
                ],
                packages: selected.landingPage?.packages || [],
            }
        };
        setFacilityData(facilityWithDefaults);
        setLogoPreview(selected.logoUrl || null);
    }
    
    // Fetch bays for the selected facility
    const bayQuery = query(collection(db, `facilities/${selectedFacilityId}/bays`), orderBy('name'));
    const bayUnsubscribe = onSnapshot(bayQuery, (snapshot) => {
        const fetchedBays = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bay));
        setBays(fetchedBays);
    });

    // Determine current user's role for this facility
    const checkUserRole = async () => {
        const facilityRef = doc(db, 'facilities', selectedFacilityId);
        const facilityDoc = await getDoc(facilityRef);

        if (facilityDoc.exists() && facilityDoc.data().ownerId === user.uid) {
            setCurrentUserRole('owner');
        } else {
            const staffRef = doc(db, `facilities/${selectedFacilityId}/staff`, user.uid);
            const staffDoc = await getDoc(staffRef);
            if (staffDoc.exists()) {
                setCurrentUserRole(staffDoc.data().role);
            } else {
                setCurrentUserRole(null);
            }
        }
    };
    checkUserRole();
    
    return () => bayUnsubscribe();

  }, [selectedFacilityId, facilities, user]);


  // --- Event Handlers ---
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFacilityData(prev => ({...prev, [name]: value}));
  }

  const handleLandingPageChange = (key: string, value: any) => {
    setFacilityData(prev => ({
        ...prev,
        landingPage: { ...prev.landingPage, [key]: value } as LandingPageSettings,
    }));
  };

  const handleLandingPagePlanChange = (planIndex: number, field: keyof LandingPagePlan, value: string | number) => {
    setFacilityData(prev => {
        const newPlans = [...(prev.landingPage?.plans || [])];
        if (newPlans[planIndex]) {
            (newPlans[planIndex] as any)[field] = value;
        }
        return {
            ...prev,
            landingPage: { ...prev.landingPage, plans: newPlans } as LandingPageSettings,
        };
    });
  };

  const handleLandingPagePlanFeatureChange = (planIndex: number, featureIndex: number, value: string) => {
    setFacilityData(prev => {
        const newPlans = [...(prev.landingPage?.plans || [])];
        if (newPlans[planIndex] && newPlans[planIndex].features[featureIndex] !== undefined) {
            newPlans[planIndex].features[featureIndex] = value;
        }
        return {
            ...prev,
            landingPage: { ...prev.landingPage, plans: newPlans } as LandingPageSettings,
        };
    });
  };

  const addPlanFeature = (planIndex: number) => {
      setFacilityData(prev => {
        const newPlans = [...(prev.landingPage?.plans || [])];
        if (newPlans[planIndex]) {
            newPlans[planIndex].features.push('');
        }
        return {
            ...prev,
            landingPage: { ...prev.landingPage, plans: newPlans } as LandingPageSettings,
        };
      })
  }
  
  const removePlanFeature = (planIndex: number, featureIndex: number) => {
      setFacilityData(prev => {
        const newPlans = [...(prev.landingPage?.plans || [])];
        if (newPlans[planIndex]) {
            newPlans[planIndex].features.splice(featureIndex, 1);
        }
        return {
            ...prev,
            landingPage: { ...prev.landingPage, plans: newPlans } as LandingPageSettings,
        };
      })
  }
  
  const handleAddLandingPagePlan = () => {
    setFacilityData(prev => {
        const newPlans = [...(prev.landingPage?.plans || [])];
        newPlans.push({ name: 'New Plan', price: 0, features: ['Feature 1'] });
        return {
            ...prev,
            landingPage: { ...prev.landingPage, plans: newPlans } as LandingPageSettings,
        };
    });
  }

  const handleDeleteLandingPagePlan = (planIndex: number) => {
     setFacilityData(prev => {
        const newPlans = [...(prev.landingPage?.plans || [])];
        newPlans.splice(planIndex, 1);
        return {
            ...prev,
            landingPage: { ...prev.landingPage, plans: newPlans } as LandingPageSettings,
        };
    });
  }

  const handleLandingPagePackageChange = (packageIndex: number, field: keyof LandingPagePackage, value: string | number) => {
    setFacilityData(prev => {
        const newPackages = [...(prev.landingPage?.packages || [])];
        if (newPackages[packageIndex]) {
            (newPackages[packageIndex] as any)[field] = value;
        }
        return {
            ...prev,
            landingPage: { ...prev.landingPage, packages: newPackages } as LandingPageSettings,
        };
    });
  };

  const handleAddLandingPagePackage = () => {
    setFacilityData(prev => {
        const newPackages = [...(prev.landingPage?.packages || [])];
        newPackages.push({ name: 'New Package', price: 50, description: 'Package description' });
        return {
            ...prev,
            landingPage: { ...prev.landingPage, packages: newPackages } as LandingPageSettings,
        };
    });
  }

  const handleDeleteLandingPagePackage = (packageIndex: number) => {
     setFacilityData(prev => {
        const newPackages = [...(prev.landingPage?.packages || [])];
        newPackages.splice(packageIndex, 1);
        return {
            ...prev,
            landingPage: { ...prev.landingPage, packages: newPackages } as LandingPageSettings,
        };
    });
  }


  const handleSettingsChange = (key: string, value: any) => {
      setFacilityData(prev => ({
          ...prev,
          settings: { ...prev.settings, [key]: value } as Facility['settings']
      }));
  };
  
    const handleBusinessHoursChange = (day: string, field: 'open' | 'close' | 'isOpen', value: string | boolean) => {
        setFacilityData(prev => {
            const newSettings = { ...prev.settings } as Facility['settings'];
            newSettings.businessHours = {
                ...newSettings.businessHours,
                [day]: {
                    ...newSettings.businessHours[day],
                    [field]: value
                }
            };
            return { ...prev, settings: newSettings };
        });
    };

  const handleColorChange = (type: 'primary' | 'accent', value: string) => {
      setFacilityData(prev => ({
          ...prev,
          colors: { ...prev.colors, [type]: value } as Facility['colors']
      }));
  }
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedFacilityId || !facilityData) return;
    
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
        let updatedLogoUrl = facilityData.logoUrl;
        
        if (logoFile) {
            const storageRef = ref(storage, `facility-logos/${selectedFacilityId}/${logoFile.name}`);
            const snapshot = await uploadBytes(storageRef, logoFile);
            updatedLogoUrl = await getDownloadURL(snapshot.ref);
        }

        const { id, ...dataToSave } = facilityData;
        const finalData = { ...dataToSave, logoUrl: updatedLogoUrl || null };
        
        const facilityRef = doc(db, 'facilities', selectedFacilityId);
        await updateDoc(facilityRef, finalData);

        setLogoFile(null);
        setSuccess('Facility settings updated successfully!');

    } catch (err: any) {
        setError('Failed to save changes. Please try again.');
        console.error(err);
    } finally {
        setIsSaving(false);
    }
  };

  const handleCreateFacility = async (data: AddFacilityFormData) => {
    if (!user || !user.displayName) return;
    setIsSaving(true);
    setError(null);
    try {
        const batch = writeBatch(db);
        const facilityRef = doc(collection(db, 'facilities'));
        
        batch.set(facilityRef, {
            name: data.name,
            slug: data.slug,
            ownerId: user.uid,
            createdAt: serverTimestamp(),
            address: data.address || '',
            city: data.city || '',
            state: data.state || '',
            zip: data.zip || '',
            country: data.country || '',
            timeZone: data.timeZone || '',
            colors: { primary: '#059669', accent: '#a7f3d0'},
            settings: { 
                defaultBookingDuration: 60, 
                maxConcurrentBookings: 1, 
                isOpen: true,
                businessHours: defaultBusinessHours(),
            },
            plan: {
                id: 'basic',
                billingFrequency: 'monthly',
                isTrial: false,
                trialEndDate: null,
            }
        });

        const bayRef = doc(collection(db, `facilities/${facilityRef.id}/bays`));
        batch.set(bayRef, { name: 'Bay 1', status: 'available' });
        
        // Add audit log for facility creation
        const logRef = doc(collection(db, `facilities/${facilityRef.id}/auditLogs`));
        batch.set(logRef, {
            action: 'create',
            changedBy: user.displayName,
            changedById: user.uid,
            timestamp: serverTimestamp(),
            details: { 
                objectType: 'Facility', 
                objectId: facilityRef.id, 
                objectName: data.name,
                source: 'Registration Form'
            }
        });

        await batch.commit();
        setSuccess(`Facility "${data.name}" created successfully!`);
        setAddFacilityModalOpen(false);
        form.reset();

    } catch (err: any) {
        setError('Failed to create facility.');
        console.error(err);
    } finally {
        setIsSaving(false);
    }
  };

  const handleDeleteFacility = async () => {
    if(!selectedFacilityId || !user || !user.displayName) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
        const batch = writeBatch(db);
        
        // Add audit log BEFORE deleting the facility so we have a place to write it.
        const logRef = doc(collection(db, `facilities/${selectedFacilityId}/auditLogs`));
        batch.set(logRef, {
            action: 'delete',
            changedBy: user.displayName,
            changedById: user.uid,
            timestamp: serverTimestamp(),
            details: { 
                objectType: 'Facility', 
                objectId: selectedFacilityId, 
                objectName: facilityData.name,
                source: 'Facility Settings'
            }
        });
        
        const facilityToDeleteRef = doc(db, 'facilities', selectedFacilityId);
        batch.delete(facilityToDeleteRef);
        
        await batch.commit();
        
        setSuccess(`Facility "${facilityData.name}" has been deleted. Note: Sub-collections like members and bookings are not automatically deleted in this demo.`);
        setSelectedFacilityId(''); // Clear selection

    } catch (err: any) {
        console.error(err);
        setError("Failed to delete facility. Please try again.");
    } finally {
        setIsSaving(false);
    }
  }

  const copyUrlToClipboard = () => {
      if(!facilityData.slug) return;
      const url = `${facilityData.slug}.teeboxed.com`;
      navigator.clipboard.writeText(url);
      setSuccess(`URL copied to clipboard: ${url}`);
      setTimeout(() => setSuccess(null), 3000);
  };
  
    const handleBayChange = (index: number, newName: string) => {
        const newBays = [...bays];
        newBays[index].name = newName;
        setBays(newBays);
    };

    const handleUpdateBayName = async (bayId: string, newName: string) => {
        if (!selectedFacilityId) return;
        const bayRef = doc(db, `facilities/${selectedFacilityId}/bays`, bayId);
        await updateDoc(bayRef, { name: newName });
        // Optimistic update handled by onSnapshot
    };

    const handleAddBay = async () => {
        if (!selectedFacilityId) return;
        
        const highestBayNum = bays.reduce((max, bay) => {
            const match = bay.name.match(/^Bay (\d+)$/);
            if (match && parseInt(match[1]) > max) {
                return parseInt(match[1]);
            }
            return max;
        }, 0);

        const newBayName = `Bay ${highestBayNum + 1}`;

        const bayRef = collection(db, `facilities/${selectedFacilityId}/bays`);
        await addDoc(bayRef, {
            name: newBayName,
            status: 'available',
        });
    };

    const handleDeleteBay = async (bayId: string) => {
        if (!selectedFacilityId) return;
        const bayRef = doc(db, `facilities/${selectedFacilityId}/bays`, bayId);
        await deleteDoc(bayRef);
    };


  if (loading) {
    return <div className="flex items-center justify-center h-screen"><p>Loading...</p></div>;
  }
  
  const addFacilityButton = (
      <Button size="sm" className="h-8 gap-1" onClick={() => setAddFacilityModalOpen(true)} disabled={!canAddFacility}>
        <PlusCircle className="h-3.5 w-3.5" />
        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            Add Facility
        </span>
      </Button>
  );
  
  const canManageFacility = currentUserRole === 'owner' || currentUserRole === 'admin';


  return (
    <div className="flex flex-col sm:gap-4 sm:py-4 flex-grow">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
        <h1 className="text-xl font-semibold">Facility Settings</h1>
        <div className="relative ml-auto flex items-center gap-4">
          {facilities.length > 1 && (
            <Select value={selectedFacilityId} onValueChange={setSelectedFacilityId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Facility" />
              </SelectTrigger>
              <SelectContent>
                {facilities.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
           <TooltipProvider>
                {currentUserRole === 'owner' ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                           <span>{addFacilityButton}</span>
                        </TooltipTrigger>
                        {!canAddFacility &&
                          <TooltipContent>
                            <p>You've reached the {planLimits[highestPlan]} facility limit for your <span className="capitalize">{highestPlan}</span> plan.</p>
                            <p>Please upgrade your plan to add more facilities.</p>
                          </TooltipContent>
                        }
                    </Tooltip>
                ) : null}
            </TooltipProvider>
        </div>
      </header>
      <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
        {error && <Alert variant="destructive"><Terminal className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        {success && <Alert variant="default" className="border-green-500 text-green-700"><CheckCircle className="h-4 w-4 text-green-600" /><AlertTitle>Success</AlertTitle><AlertDescription>{success}</AlertDescription></Alert>}

        <div className="grid gap-4 md:grid-cols-[1fr_250px] lg:grid-cols-3 lg:gap-8">
            <div className="grid auto-rows-max items-start gap-4 lg:col-span-2 lg:gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Facility Details</CardTitle>
                        <CardDescription>Manage your facility's general information and branding.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="general">
                            <TabsList className="mb-6">
                                <TabsTrigger value="general">General</TabsTrigger>
                                <TabsTrigger value="branding">Branding</TabsTrigger>
                                {canManageFacility && <TabsTrigger value="public-page">Public Page</TabsTrigger>}
                                {canManageFacility && <TabsTrigger value="bays">Bays</TabsTrigger>}
                                {canManageFacility && <TabsTrigger value="operations">Operations</TabsTrigger>}
                            </TabsList>
                            <TabsContent value="general" className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Facility Name</Label>
                                    <Input id="name" name="name" value={facilityData.name || ''} onChange={handleInputChange} disabled={!canManageFacility} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="address">Street Address</Label>
                                    <Input id="address" name="address" value={facilityData.address || ''} onChange={handleInputChange} disabled={!canManageFacility}/>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2"><Label htmlFor="city">City</Label><Input id="city" name="city" value={facilityData.city || ''} onChange={handleInputChange} disabled={!canManageFacility}/></div>
                                    <div className="space-y-2"><Label htmlFor="state">State/Province</Label><Input id="state" name="state" value={facilityData.state || ''} onChange={handleInputChange} disabled={!canManageFacility}/></div>
                                    <div className="space-y-2"><Label htmlFor="zip">ZIP/Postal</Label><Input id="zip" name="zip" value={facilityData.zip || ''} onChange={handleInputChange} disabled={!canManageFacility}/></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <div className="space-y-2"><Label htmlFor="country">Country</Label>
                                        <Select name="country" value={facilityData.country || ''} onValueChange={(value) => setFacilityData(prev => ({...prev, country: value}))} disabled={!canManageFacility}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>{countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2"><Label htmlFor="timeZone">Time Zone</Label>
                                        <Select name="timeZone" value={facilityData.timeZone || ''} onValueChange={(value) => setFacilityData(prev => ({...prev, timeZone: value}))} disabled={!canManageFacility}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>{timezones.map(tz => <SelectItem key={tz} value={tz}>{tz.replace('America/', '').replace('_', ' ')}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </TabsContent>
                             <TabsContent value="branding" className="space-y-6">
                                <div className="space-y-2">
                                    <Label>Facility Logo</Label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-24 h-24 rounded-md border flex items-center justify-center bg-muted overflow-hidden">
                                            {logoPreview ? <img src={logoPreview} alt="Logo Preview" className="object-contain h-full w-full"/> : <span>No Logo</span>}
                                        </div>
                                        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!canManageFacility}><Upload className="mr-2 h-4 w-4"/> Upload Logo</Button>
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg" />
                                    </div>
                                    <p className="text-xs text-muted-foreground">Recommended: Square PNG up to 2MB.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <div className="space-y-2">
                                        <Label htmlFor="primaryColor">Primary Color</Label>
                                        <div className="flex items-center gap-2">
                                            <Input type="color" value={facilityData.colors?.primary || '#000000'} onChange={(e) => handleColorChange('primary', e.target.value)} className="p-1 h-10 w-14" disabled={!canManageFacility}/>
                                            <Input id="primaryColor" value={facilityData.colors?.primary || '#000000'} onChange={(e) => handleColorChange('primary', e.target.value)} disabled={!canManageFacility}/>
                                        </div>
                                    </div>
                                     <div className="space-y-2">
                                        <Label htmlFor="accentColor">Accent Color</Label>
                                         <div className="flex items-center gap-2">
                                            <Input type="color" value={facilityData.colors?.accent || '#000000'} onChange={(e) => handleColorChange('accent', e.target.value)} className="p-1 h-10 w-14" disabled={!canManageFacility}/>
                                            <Input id="accentColor" value={facilityData.colors?.accent || '#000000'} onChange={(e) => handleColorChange('accent', e.target.value)} disabled={!canManageFacility}/>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                            <TabsContent value="public-page" className="space-y-8">
                                <div className="space-y-2">
                                    <Label htmlFor="heroTitle">Hero Title</Label>
                                    <Input id="heroTitle" value={facilityData.landingPage?.heroTitle || ''} onChange={(e) => handleLandingPageChange('heroTitle', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="heroSubtitle">Hero Subtitle</Label>
                                    <Input id="heroSubtitle" value={facilityData.landingPage?.heroSubtitle || ''} onChange={(e) => handleLandingPageChange('heroSubtitle', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="aboutSectionText">About Section Text</Label>
                                    <Textarea id="aboutSectionText" value={facilityData.landingPage?.aboutSectionText || ''} onChange={(e) => handleLandingPageChange('aboutSectionText', e.target.value)} rows={5} />
                                </div>
                                 <div>
                                    <Label className="text-base font-semibold">Membership Plans</Label>
                                    <div className="space-y-4 mt-2">
                                    {facilityData.landingPage?.plans?.map((plan, planIndex) => (
                                        <Card key={planIndex} className="p-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Plan Name</Label>
                                                    <Input value={plan.name} onChange={(e) => handleLandingPagePlanChange(planIndex, 'name', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Price (per month)</Label>
                                                    <Input type="number" value={plan.price} onChange={(e) => handleLandingPagePlanChange(planIndex, 'price', parseFloat(e.target.value))} />
                                                </div>
                                            </div>
                                            <div className="mt-4 space-y-2">
                                                <Label>Features</Label>
                                                {plan.features.map((feature, featureIndex) => (
                                                    <div key={featureIndex} className="flex items-center gap-2">
                                                        <Input value={feature} onChange={(e) => handleLandingPagePlanFeatureChange(planIndex, featureIndex, e.target.value)} />
                                                        <Button variant="ghost" size="icon" onClick={() => removePlanFeature(planIndex, featureIndex)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                                <Button variant="outline" size="sm" onClick={() => addPlanFeature(planIndex)}>Add Feature</Button>
                                            </div>
                                            <CardFooter className="px-0 pt-4 mt-4 border-t">
                                                <Button variant="destructive" size="sm" onClick={() => handleDeleteLandingPagePlan(planIndex)}>Delete Plan</Button>
                                            </CardFooter>
                                        </Card>
                                    ))}
                                    </div>
                                    <Button variant="outline" onClick={handleAddLandingPagePlan} className="mt-4 w-full">
                                        <PlusCircle className="mr-2 h-4 w-4"/> Add New Plan
                                    </Button>
                                </div>
                                <div>
                                    <Label className="text-base font-semibold">Packages</Label>
                                    <div className="space-y-4 mt-2">
                                    {facilityData.landingPage?.packages?.map((pkg, pkgIndex) => (
                                        <Card key={pkgIndex} className="p-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Package Name</Label>
                                                    <Input value={pkg.name} onChange={(e) => handleLandingPagePackageChange(pkgIndex, 'name', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Price</Label>
                                                    <Input type="number" value={pkg.price} onChange={(e) => handleLandingPagePackageChange(pkgIndex, 'price', parseFloat(e.target.value))} />
                                                </div>
                                            </div>
                                            <div className="mt-4 space-y-2">
                                                <Label>Description</Label>
                                                <Textarea value={pkg.description} onChange={(e) => handleLandingPagePackageChange(pkgIndex, 'description', e.target.value)} />
                                            </div>
                                            <CardFooter className="px-0 pt-4 mt-4 border-t">
                                                <Button variant="destructive" size="sm" onClick={() => handleDeleteLandingPagePackage(pkgIndex)}>Delete Package</Button>
                                            </CardFooter>
                                        </Card>
                                    ))}
                                    </div>
                                    <Button variant="outline" onClick={handleAddLandingPagePackage} className="mt-4 w-full">
                                        <PlusCircle className="mr-2 h-4 w-4"/> Add New Package
                                    </Button>
                                </div>
                            </TabsContent>
                             {canManageFacility && (
                                <TabsContent value="bays" className="space-y-4">
                                    <div className="space-y-2">
                                        {bays.map((bay, index) => (
                                            <div key={bay.id} className="flex items-center gap-2">
                                                <Input
                                                    value={bay.name}
                                                    onChange={(e) => handleBayChange(index, e.target.value)}
                                                    onBlur={(e) => handleUpdateBayName(bay.id, e.target.value)}
                                                />
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete {bay.name}?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will permanently delete the bay. This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteBay(bay.id)} className="bg-destructive hover:bg-destructive/90">
                                                                Confirm Deletion
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        ))}
                                    </div>
                                    <Button variant="outline" onClick={handleAddBay} className="w-full">
                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Bay
                                    </Button>
                                </TabsContent>
                            )}
                            {canManageFacility && (
                            <TabsContent value="operations" className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Default Booking Duration</Label>
                                        <Select value={facilityData.settings?.defaultBookingDuration?.toString()} onValueChange={(v) => handleSettingsChange('defaultBookingDuration', parseInt(v))}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="30">30 minutes</SelectItem>
                                                <SelectItem value="60">60 minutes</SelectItem>
                                                <SelectItem value="90">90 minutes</SelectItem>
                                                <SelectItem value="120">120 minutes</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="maxConcurrentBookings">Max Concurrent Bookings</Label>
                                        <Input id="maxConcurrentBookings" type="number" value={facilityData.settings?.maxConcurrentBookings || ''} onChange={(e) => handleSettingsChange('maxConcurrentBookings', parseInt(e.target.value))} />
                                    </div>
                                </div>
                                <Card className="p-4 space-y-4">
                                    <div>
                                        <h4 className="font-semibold text-card-foreground mb-4">Business Hours</h4>
                                        <div className="space-y-4">
                                            {weekDays.map(day => (
                                                <div key={day} className="flex items-center gap-4">
                                                    <Switch 
                                                        id={`hours-${day}-toggle`} 
                                                        checked={facilityData.settings?.businessHours?.[day]?.isOpen}
                                                        onCheckedChange={(c) => handleBusinessHoursChange(day, 'isOpen', c)}
                                                    />
                                                    <Label htmlFor={`hours-${day}-toggle`} className="capitalize w-20">{day}</Label>
                                                    <div className="flex items-center gap-2 flex-grow">
                                                        <Input 
                                                            type="time" 
                                                            value={facilityData.settings?.businessHours?.[day]?.open}
                                                            onChange={(e) => handleBusinessHoursChange(day, 'open', e.target.value)}
                                                            disabled={!facilityData.settings?.businessHours?.[day]?.isOpen}
                                                        />
                                                        <span>-</span>
                                                        <Input 
                                                            type="time" 
                                                            value={facilityData.settings?.businessHours?.[day]?.close}
                                                            onChange={(e) => handleBusinessHoursChange(day, 'close', e.target.value)}
                                                            disabled={!facilityData.settings?.businessHours?.[day]?.isOpen}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-4 border-t">
                                        <div>
                                            <Label htmlFor="isOpen">Facility Status</Label>
                                            <p className="text-sm text-muted-foreground">Is your facility currently open for bookings?</p>
                                        </div>
                                        <Switch id="isOpen" checked={facilityData.settings?.isOpen} onCheckedChange={(c) => handleSettingsChange('isOpen', c)} />
                                    </div>
                                </Card>
                            </TabsContent>
                            )}
                        </Tabs>
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                         {canManageFacility
                          ? <Button onClick={handleSaveChanges} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</Button>
                          : <p className="text-sm text-muted-foreground">You do not have permission to modify these settings.</p>
                         }
                    </CardFooter>
                </Card>
            </div>
            
            <div className="grid auto-rows-max items-start gap-4 lg:gap-8">
                 <Card>
                    <CardHeader>
                        <CardTitle>Facility URL</CardTitle>
                        <CardDescription>This is the unique web address for your facility.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
                            <span className="text-sm font-semibold truncate">{facilityData.slug || 'your-facility'}.teeboxed.com</span>
                            <Button variant="ghost" size="icon" className="ml-auto" onClick={copyUrlToClipboard}>
                                <Copy className="h-4 w-4"/>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                 {currentUserRole === 'owner' && (
                     <Card className="border-destructive">
                        <CardHeader>
                            <CardTitle>Danger Zone</CardTitle>
                            <CardDescription>These actions are irreversible. Please proceed with caution.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="w-full" disabled={isSaving}>
                                        <Trash2 className="mr-2 h-4 w-4" /> 
                                        {isSaving ? 'Deleting...' : 'Delete This Facility'}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete the <strong>{facilityData.name}</strong> facility and all of its associated data, including members, bookings, and staff. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteFacility} className="bg-destructive hover:bg-destructive/90">Confirm Deletion</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardContent>
                    </Card>
                 )}
            </div>
        </div>

        {/* Add Facility Dialog */}
        <Dialog open={isAddFacilityModalOpen} onOpenChange={setAddFacilityModalOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Add New Facility</DialogTitle>
                    <DialogDescription>Create a new facility under your account. You can add more details later.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleCreateFacility)} className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto px-2">
                         <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Facility Name</FormLabel>
                                <FormControl><Input {...field} placeholder="My New Golf Center" /></FormControl>
                                <FormMessage />
                            </FormItem>
                         )}/>
                         <FormField control={form.control} name="slug" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Facility URL</FormLabel>
                                <FormControl>
                                    <div className="flex items-center">
                                        <Input {...field} className="rounded-r-none" />
                                        <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-l-0 border-gray-300 rounded-r-md h-10">
                                        .teeboxed.com
                                        </span>
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="address" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Street Address (Optional)</FormLabel>
                                <FormControl><Input {...field} placeholder="123 Main Street" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField control={form.control} name="city" render={({ field }) => (
                                <FormItem><FormLabel>City (Optional)</FormLabel><FormControl><Input {...field} placeholder="Anytown" /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="state" render={({ field }) => (
                                <FormItem><FormLabel>State / Province (Optional)</FormLabel><FormControl><Input {...field} placeholder="CA" /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="zip" render={({ field }) => (
                                <FormItem><FormLabel>ZIP / Postal (Optional)</FormLabel><FormControl><Input {...field} placeholder="90210" /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <FormField control={form.control} name="country" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Country (Optional)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select a country" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}/>
                            <FormField control={form.control} name="timeZone" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Time Zone (Optional)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select a time zone" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {timezones.map(tz => <SelectItem key={tz} value={tz}>{tz.replace('America/', '').replace('_', ' ')}</SelectItem>)}
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setAddFacilityModalOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? 'Creating...' : 'Create Facility'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
