
'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Users,
  Calendar,
  CreditCard,
  Building2,
  Users2,
  Box,
  Wrench,
  ShieldCheck,
  BarChart2,
  Megaphone,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/firebase";
import { signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { Logo } from '@/components/logo';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (!currentUser) {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
        await signOut(auth);
        router.push('/login');
    } catch (error) {
        console.error("Error signing out: ", error);
    }
  };
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  const navLinks = [
    { href: "/dashboard", icon: Home, label: "Dashboard" },
    { href: "/dashboard/bookings", icon: Calendar, label: "Bookings" },
    { href: "/dashboard/members", icon: Users, label: "Members" },
    { href: "/dashboard/staff", icon: Users2, label: "Staff" },
    { href: "/dashboard/inventory", icon: Box, label: "Inventory" },
    { href: "/dashboard/maintenance", icon: Wrench, label: "Maintenance" },
    { href: "/dashboard/reports", icon: BarChart2, label: "Reports" },
    { href: "/dashboard/marketing", icon: Megaphone, label: "Marketing" },
    { href: "/dashboard/audit-logs", icon: ShieldCheck, label: "Audit Logs" },
    { href: "/dashboard/facility", icon: Building2, label: "Facility" },
    { href: "/dashboard/billing", icon: CreditCard, label: "Billing" },
  ];
  
  const isLinkActive = (href: string) => {
    // Exact match for the main dashboard link
    if (href === '/dashboard') {
        return pathname === href;
    }
    // Starts with for all other dashboard links
    return pathname.startsWith(href);
  }
  
  if (loading) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <p>Loading Dashboard...</p>
        </div>
    )
  }

  return (
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <aside className="fixed inset-y-0 left-0 z-10 flex w-64 flex-col border-r bg-background">
          <div className="flex h-full max-h-screen flex-col gap-2">
            <div className="flex h-14 items-center border-b px-4">
                <Logo />
            </div>

            <nav className="flex flex-col gap-1 px-2 flex-grow mt-5">
              {navLinks.map((link) => 
                  <Link
                    key={link.label}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                      isLinkActive(link.href) && "bg-accent text-primary"
                    )}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
              )}
            </nav>
            
            <div className="mt-auto p-2 border-t">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="w-full justify-start gap-2 px-2 h-12">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || ''} />
                            <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col items-start">
                           <span className="text-sm font-medium">{user?.displayName || 'My Account'}</span>
                           <span className="text-xs text-muted-foreground -mt-1">{user?.email}</span>
                        </div>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" className="w-56">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <Link href="/dashboard/account"><DropdownMenuItem>Settings</DropdownMenuItem></Link>
                    <DropdownMenuItem>Support</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </aside>
        <div className="flex flex-col flex-grow sm:pl-64">
            {children}
        </div>
      </div>
  )
}
