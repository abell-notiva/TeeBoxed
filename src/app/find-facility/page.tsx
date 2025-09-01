
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from '@/components/ui/button';
import { Loader2, Search, MapPin, Building, Check } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import debounce from 'lodash.debounce';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Logo } from '@/components/logo';

interface FacilityResult {
    id: string;
    name: string;
    slug: string;
    city?: string;
    state?: string;
}

export default function FindFacilityPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<FacilityResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFacility, setSelectedFacility] = useState<FacilityResult | null>(null);

    const debouncedSearch = useCallback(
        debounce(async (searchVal: string) => {
            if (searchVal.length < 3) {
                setResults([]);
                setIsLoading(false);
                return;
            }
            try {
                const searchLower = searchVal.toLowerCase();
                const q = query(
                    collection(db, "facilities"), 
                    where("searchKeywords", "array-contains", searchLower),
                    limit(10)
                );
                const querySnapshot = await getDocs(q);
                const facilities = querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as FacilityResult));
                setResults(facilities);
            } catch (error) {
                console.error("Error searching facilities: ", error);
            } finally {
                setIsLoading(false);
            }
        }, 500),
    []);

    useEffect(() => {
        setIsLoading(true);
        debouncedSearch(searchTerm);
        // Cleanup on unmount
        return () => debouncedSearch.cancel();
    }, [searchTerm, debouncedSearch]);

    const handleConfirmRedirect = () => {
        if (!selectedFacility) return;
        
        const currentHostname = window.location.hostname;
        const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'teeboxed.com';
        
        let newUrl = '';
        if (currentHostname.includes('localhost') || currentHostname.includes('127.0.0.1')) {
            // For local dev, redirect to the slug path
            newUrl = `/${selectedFacility.slug}`;
        } else if (currentHostname.includes('firebase') || currentHostname.includes('web.app')) {
            // For Firebase hosting, use the slug path
            newUrl = `/${selectedFacility.slug}`;
        } else {
             // For production with custom domain, construct the subdomain URL
            const protocol = window.location.protocol;
            newUrl = `${protocol}//${selectedFacility.slug}.${mainDomain}`;
        }
        window.location.href = newUrl;
    };


    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-muted p-4 sm:p-6">
            <div className="absolute top-8 left-8">
                <Logo />
            </div>
            <Card className="w-full max-w-2xl">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight">Facility Not Found</CardTitle>
                    <CardDescription>
                        Sorry, we couldn't automatically direct you to a facility page.
                        <br />
                        Please search for your facility below.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search by facility name or city..."
                            className="w-full pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                         {isLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin" />}
                    </div>

                    <div className="mt-6 space-y-4">
                        {results.length > 0 ? (
                            results.map(facility => (
                                <Card key={facility.id} className="p-4 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold flex items-center gap-2"><Building className="h-4 w-4 text-muted-foreground" /> {facility.name}</h3>
                                        {facility.city && facility.state && (
                                            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                                <MapPin className="h-4 w-4" /> 
                                                {`${facility.city}, ${facility.state}`}
                                            </p>
                                        )}
                                    </div>
                                    <Button onClick={() => setSelectedFacility(facility)}>
                                        Go to Facility
                                    </Button>
                                </Card>
                            ))
                        ) : (
                            !isLoading && searchTerm.length >= 3 && (
                                <p className="text-center text-muted-foreground py-8">No facilities found for "{searchTerm}".</p>
                            )
                        )}
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={selectedFacility !== null} onOpenChange={(isOpen) => !isOpen && setSelectedFacility(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Facility</AlertDialogTitle>
                        <AlertDialogDescription>
                            You are about to navigate to the page for the following facility. Please confirm this is correct.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {selectedFacility && (
                        <div className="py-4 space-y-2">
                             <h3 className="font-semibold text-lg flex items-center gap-2"><Building className="h-5 w-5 text-primary" /> {selectedFacility.name}</h3>
                             {selectedFacility.city && selectedFacility.state && (
                                <p className="text-muted-foreground flex items-center gap-2">
                                     <MapPin className="h-4 w-4" /> 
                                     {selectedFacility.city}, {selectedFacility.state}
                                </p>
                             )}
                        </div>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel>Go Back</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmRedirect}>
                            <Check className="mr-2 h-4 w-4"/> Go to Page
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
