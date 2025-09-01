
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, User, Calendar, MapPin, Package, Ticket } from 'lucide-react';
import Link from 'next/link';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { notFound, useParams, useRouter } from 'next/navigation';


// --- Data Types ---

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

export interface Facility {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    contact?: {
        phone?: string;
        email?: string;
    }
    settings: {
        businessHours: {
            [day: string]: { open: string; close: string; isOpen: boolean };
        };
    };
    landingPage?: {
        heroTitle?: string;
        heroSubtitle?: string;
        aboutSectionText?: string;
        plans?: LandingPagePlan[];
        packages?: LandingPagePackage[];
    };
}


// --- Main Page Component (Client-Side) ---

export default function Page() {
    const params = useParams();
    const router = useRouter();
    const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

    const [facility, setFacility] = useState<Facility | null>(null);
    const [loading, setLoading] = useState(true);
    const [logoError, setLogoError] = useState(false);
    const [isBookingModalOpen, setBookingModalOpen] = useState(false);
    
    useEffect(() => {
        if (!slug) {
            setLoading(false);
            return;
        }

        async function getFacility(slug: string) {
            setLoading(true);
            try {
                const q = query(collection(db, "facilities"), where("slug", "==", slug), limit(1));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    setFacility(null);
                } else {
                    const facilityDoc = querySnapshot.docs[0];
                    const facilityData = facilityDoc.data();
                    
                    setFacility({
                        id: facilityDoc.id,
                        name: facilityData.name || '',
                        slug: facilityData.slug || '',
                        logoUrl: facilityData.logoUrl,
                        address: facilityData.address || '',
                        city: facilityData.city || '',
                        state: facilityData.state || '',
                        zip: facilityData.zip || '',
                        contact: facilityData.contact,
                        settings: {
                            ...facilityData.settings,
                            businessHours: facilityData.settings?.businessHours || {},
                        },
                        landingPage: facilityData.landingPage,
                    });
                }
            } catch (error) {
                console.error("Error fetching facility for page rendering:", error);
                setFacility(null);
            } finally {
                setLoading(false);
            }
        }

        getFacility(slug);

    }, [slug]);

    // Handle redirect when facility is not found
    useEffect(() => {
        if (!loading && !facility) {
            router.replace('/find-facility');
        }
    }, [loading, facility, router]);

    if (loading) {
        return <div className="flex h-screen w-full items-center justify-center">Loading facility...</div>;
    }

    if (!facility) {
        return <div className="flex h-screen w-full items-center justify-center">Facility not found. Redirecting to search...</div>;
    }

    const googleMapsUrl = facility.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${facility.address}, ${facility.city}, ${facility.state} ${facility.zip}`)}` : '#';

    const heroTitle = facility.landingPage?.heroTitle || `Welcome to ${facility.name}`;
    const heroSubtitle = facility.landingPage?.heroSubtitle || 'Your premier indoor golf experience.';
    const aboutText = facility.landingPage?.aboutSectionText || `Located in the heart of ${facility.city || 'town'}, ${facility.name} offers state-of-the-art golf simulators for players of all skill levels. Whether you're a seasoned pro looking to fine-tune your game or a beginner eager to learn, our facility provides a welcoming and professional environment.`;
    const membershipPlans = facility.landingPage?.plans || [];
    const packages = facility.landingPage?.packages || [];

    const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    const formatTime = (time: string) => {
        if (!time) return 'Closed';
        const [hour, minute] = time.split(':').map(Number);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const formattedHour = hour % 12 || 12;
        return `${formattedHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
    };

  return (
    <>
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
          <div className="flex items-center gap-4">
            {facility.logoUrl && !logoError && (
                <img 
                    src={facility.logoUrl} 
                    alt={`${facility.name} Logo`} 
                    className="h-8 w-auto"
                    onError={() => setLogoError(true)}
                />
            )}
            <span className="font-bold text-lg">{facility.name}</span>
          </div>
          <nav className="flex items-center space-x-2">
            <Link href={`/login`}>
                <Button variant="ghost">Member Login</Button>
            </Link>
            <Button onClick={() => setBookingModalOpen(true)}>Book Now</Button>
          </nav>
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-20 sm:py-32 text-center" style={{'--bg-image-url': `url(${facility.logoUrl || ''})`} as React.CSSProperties}>
          <div className="container">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-bold tracking-tighter">
              {heroTitle}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              {heroSubtitle}
            </p>
            <div className="mt-8 flex justify-center gap-4">
                <Button size="lg" onClick={() => setBookingModalOpen(true)}><Calendar className="mr-2 h-5 w-5" /> Book Now</Button>
                <Link href="/login">
                    <Button size="lg" variant="outline"><User className="mr-2 h-5 w-5" /> Become a Member</Button>
                </Link>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="py-20 sm:py-32">
            <div className="container grid md:grid-cols-2 gap-12 items-center">
                 <div>
                    <h2 className="text-3xl font-headline font-bold">About Our Facility</h2>
                    <p className="mt-4 text-muted-foreground">
                       {aboutText}
                    </p>
                </div>
                 <div>
                     <Card className="p-6">
                        <CardTitle className="mb-4">Location & Hours</CardTitle>
                        {facility.address && (
                            <div className="space-y-2 text-muted-foreground">
                                <p className="flex items-start gap-2">
                                    <MapPin className="h-5 w-5 text-primary mt-1" />
                                    <span>{facility.address},<br/>{facility.city}, {facility.state} {facility.zip}</span>
                                </p>
                                <Button asChild variant="link" className="p-0 h-auto">
                                    <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                                        Get Directions
                                    </a>
                                </Button>
                            </div>
                        )}
                        <div className="mt-4 pt-4 border-t space-y-2">
                            {weekDays.map(day => {
                                const hours = facility.settings?.businessHours?.[day];
                                return (
                                    <div key={day} className="flex justify-between text-sm">
                                        <span className="capitalize font-medium">{day}</span>
                                        <span className="text-muted-foreground">
                                            {hours?.isOpen ? `${formatTime(hours.open)} - ${formatTime(hours.close)}` : 'Closed'}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                     </Card>
                </div>
            </div>
        </section>
        
        {/* Membership Plans Preview */}
        {membershipPlans.length > 0 && (
          <section id="memberships" className="py-20 sm:py-32 bg-muted">
              <div className="container">
                  <div className="text-center">
                      <h2 className="text-3xl font-headline font-bold">Membership Plans</h2>
                      <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
                          Enjoy exclusive benefits and save on every visit by becoming a member.
                      </p>
                  </div>
                  <div className="mt-12 grid gap-8 md:grid-cols-3">
                      {membershipPlans.map(plan => (
                          <Card key={plan.name} className="flex flex-col">
                              <CardHeader>
                                  <CardTitle>{plan.name}</CardTitle>
                                  <div>
                                      <span className="text-4xl font-bold">${plan.price}</span>
                                      <span className="text-muted-foreground">/mo</span>
                                  </div>
                              </CardHeader>
                              <CardContent className="flex-grow flex flex-col">
                                <ul className="space-y-3 flex-grow">
                                    {plan.features.map(feature => (
                                      <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                                          <Check className="h-4 w-4 text-green-500" /> {feature}
                                      </li>
                                    ))}
                                </ul>
                                <Link href="/login" className="w-full mt-6">
                                  <Button className="w-full">Choose Plan</Button>
                                </Link>
                              </CardContent>
                          </Card>
                      ))}
                  </div>
              </div>
          </section>
        )}

        {/* Packages Section */}
        {packages.length > 0 && (
          <section id="packages" className="py-20 sm:py-32">
              <div className="container">
                  <div className="text-center">
                      <h2 className="text-3xl font-headline font-bold">Packages & Deals</h2>
                      <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
                          Get more value with our special packages for guests and members.
                      </p>
                  </div>
                  <div className="mt-12 grid gap-8 md:grid-cols-3">
                      {packages.map(pkg => (
                          <Card key={pkg.name} className="flex flex-col text-center">
                              <CardHeader>
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/20 text-accent-foreground">
                                    <Package className="h-6 w-6" />
                                </div>
                                <CardTitle className="mt-4">{pkg.name}</CardTitle>
                              </CardHeader>
                              <CardContent className="flex-grow flex flex-col">
                                <p className="text-muted-foreground mb-4 flex-grow">{pkg.description}</p>
                                <div>
                                    <p className="text-3xl font-bold">${pkg.price}</p>
                                    <Button className="w-full mt-6" onClick={() => setBookingModalOpen(true)}>
                                        <Ticket className="mr-2 h-4 w-4" /> Buy Package
                                    </Button>
                                </div>
                              </CardContent>
                          </Card>
                      ))}
                  </div>
              </div>
          </section>
        )}
        
        {/* Guest Booking CTA */}
        <section className="py-20 bg-muted">
            <div className="container text-center">
                <h2 className="text-3xl font-headline font-bold">Not a Member? No Problem.</h2>
                <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                    Want to play just once or try out our facilities? You can easily book a bay as a guest without any commitment.
                </p>
                <div className="mt-6">
                    <Button size="lg" variant="outline" onClick={() => setBookingModalOpen(true)}>Book a Bay as a Guest</Button>
                </div>
            </div>
        </section>

      </main>

      <footer className="border-t">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {facility.name}. Powered by <a href="https://teeboxed.com" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">TeeBoxed</a>.</p>
          {facility.address && <p>{facility.address}, {facility.city}, {facility.state}</p>}
        </div>
      </footer>
    </div>
    
    <Dialog open={isBookingModalOpen} onOpenChange={setBookingModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Book a Bay</DialogTitle>
                <DialogDescription>
                    Are you a member or a guest? Members get exclusive rates and benefits.
                </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
                <Link href="/login">
                    <Button className="w-full h-24 text-lg" variant="outline">I'm a Member</Button>
                </Link>
                <Link href="/book">
                     <Button className="w-full h-24 text-lg">I'm a Guest</Button>
                </Link>
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
}
