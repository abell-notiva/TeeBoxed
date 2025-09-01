
'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Check } from 'lucide-react';
import Link from 'next/link';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import { Logo } from '@/components/logo';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Megaphone, Lock, Users, BarChart, CreditCard, BadgePercent } from 'lucide-react';
import Image from 'next/image';


const plans = [
    { id: 'basic', name: 'Basic', price: { monthly: 99, annually: 99 * 12 * 0.8 }, features: ['1 facility', 'Up to 100 members', 'Bookings, memberships, kiosk, billing, basic analytics'] },
    { id: 'growth', name: 'Growth', price: { monthly: 199, annually: 199 * 12 * 0.8 }, features: ['Up to 3 facilities', 'Up to 400 members', 'Everything in Basic + multi-facility dashboard + advanced analytics'] },
    { id: 'pro', name: 'Pro', price: { monthly: 299, annually: 299 * 12 * 0.8 }, features: ['Up to 10 facilities', 'Up to 800 members', 'Everything in Growth + priority support, marketing tools'] },
    { id: 'enterprise', name: 'Enterprise', price: { monthly: 0, annually: 0 }, features: ['11+ facilities', 'Unlimited members', 'Custom solutions, API integrations, enterprise support'] },
];

export default function MarketingPage() {
    const [billingFrequency, setBillingFrequency] = useState('monthly');
    const [isContactModalOpen, setContactModalOpen] = useState(false);
    
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <a href="#features" className="transition-colors hover:text-primary">Features</a>
            <a href="#pricing" className="transition-colors hover:text-primary">Pricing</a>
            <a href="#how-it-works" className="transition-colors hover:text-primary">How It Works</a>
          </nav>
          <div className="flex items-center space-x-2">
             <Link href="/login">
                <Button variant="outline">Login</Button>
            </Link>
            <Link href="/register">
              <Button>Start Free Trial</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-20 sm:py-32">
          <div className="container grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-bold tracking-tighter">
                The All-In-One Operating System for Indoor Golf.
              </h1>
              <p className="mx-auto lg:mx-0 mt-6 max-w-2xl text-lg text-muted-foreground">
                From bookings and memberships to payments and analytics, TeeBoxed is the single platform to run your entire business.
              </p>
              <div className="mt-8 flex justify-center lg:justify-start gap-4">
                <Link href="/register">
                  <Button size="lg">Start Free Trial</Button>
                </Link>
                <Button size="lg" variant="outline">View Demo</Button>
              </div>
            </div>
            <div className="relative h-64 lg:h-auto lg:min-h-[400px] rounded-lg overflow-hidden shadow-2xl">
                 <Image 
                    src="https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?q=80&w=2070&auto=format&fit=crop"
                    alt="Modern indoor golf facility"
                    fill
                    style={{ objectFit: 'cover' }}
                    className="bg-muted"
                    priority
                    data-ai-hint="indoor golf"
                 />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 sm:py-32 bg-muted">
          <div className="container">
            <div className="text-center">
              <h2 className="text-3xl font-headline font-bold">A Complete OS for Your Facility.</h2>
              <p className="mt-4 text-muted-foreground max-w-xl mx-auto">TeeBoxed provides a comprehensive suite of tools designed to streamline operations, increase revenue, and deliver an unparalleled member experience.</p>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: <Lock className="h-8 w-8 text-primary" />, title: 'Access Control', desc: 'Seamlessly manage facility access for members and staff.' },
                { icon: <Users className="h-8 w-8 text-primary" />, title: 'Membership Management', desc: 'Create, track, and manage flexible membership plans.' },
                { icon: <BarChart className="h-8 w-8 text-primary" />, title: 'Online Booking', desc: 'Intuitive calendars for members to book bays anytime.' },
                { icon: <CreditCard className="h-8 w-8 text-primary" />, title: 'Integrated Billing', desc: 'Automate recurring payments and invoicing.' },
                { icon: <BadgePercent className="h-8 w-8 text-primary" />, title: 'Staff & Roles', desc: 'Assign permissions and manage your team effectively.' },
                { icon: <Megaphone className="h-8 w-8 text-primary" />, title: 'Marketing Tools', desc: 'Engage your members. (Coming Soon)' },
              ].map(feature => (
                <Card key={feature.title} className="text-center">
                  <CardHeader>
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      {feature.icon}
                    </div>
                    <CardTitle className="mt-4">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
        
        {/* Product Showcase Section */}
        <section className="py-20 sm:py-32">
            <div className="container grid md:grid-cols-2 gap-16 items-center">
                <div className="order-2 md:order-1">
                    <h2 className="text-3xl font-headline font-bold">Intuitive Dashboard, Powerful Control.</h2>
                    <p className="mt-4 text-muted-foreground">Manage every aspect of your facility from one central hub. View real-time bay status, track key metrics, and access all your management tools with a single click.</p>
                    <ul className="mt-6 space-y-4">
                        <li className="flex items-start gap-3">
                            <Check className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                            <div>
                                <h4 className="font-semibold">At-a-Glance Overview</h4>
                                <p className="text-sm text-muted-foreground">Monitor revenue, member growth, and daily bookings from a customizable dashboard.</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <Check className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                            <div>
                                <h4 className="font-semibold">Streamlined Operations</h4>
                                <p className="text-sm text-muted-foreground">Quickly add members, create bookings, and manage staff roles without leaving the dashboard.</p>
                            </div>
                        </li>
                    </ul>
                </div>
                <div className="order-1 md:order-2 relative min-h-[300px] md:min-h-[450px] rounded-lg overflow-hidden shadow-xl">
                    <Image
                        src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2070&auto=format&fit=crop"
                        alt="TeeBoxed software dashboard"
                        fill
                        style={{ objectFit: 'cover' }}
                        className="bg-muted"
                        data-ai-hint="software dashboard"
                    />
                </div>
            </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 sm:py-32 bg-muted">
          <div className="container">
            <div className="text-center">
              <h2 className="text-3xl font-headline font-bold">Flexible pricing for facilities of all sizes.</h2>
              <p className="mt-4 text-muted-foreground">Choose a plan that fits your needs. Cancel anytime.</p>
            </div>
            <div className="mt-8 flex justify-center items-center space-x-4">
              <Label htmlFor="billing-toggle">Monthly</Label>
              <Switch id="billing-toggle" checked={billingFrequency === 'annually'} onCheckedChange={(checked) => setBillingFrequency(checked ? 'annually' : 'monthly')} />
              <Label htmlFor="billing-toggle">Annually (Save 20%)</Label>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
              {plans.map(plan => (
                <Card key={plan.id} className={`flex flex-col ${plan.id === 'growth' ? 'border-primary ring-2 ring-primary' : ''}`}>
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.id !== 'enterprise' ? (
                      <div>
                        <span className="text-4xl font-bold">${billingFrequency === 'monthly' ? plan.price.monthly : Math.round(plan.price.annually / 12)}</span>
                        <span className="text-muted-foreground">/mo</span>
                      </div>
                    ) : (
                      <CardDescription>Custom pricing for your unique needs.</CardDescription>
                    )}
                     {plan.id !== 'enterprise' && billingFrequency === 'annually' && (
                        <p className="text-sm text-muted-foreground">Billed as ${plan.price.annually.toFixed(0)}/year</p>
                      )}
                  </CardHeader>
                  <CardContent className="flex flex-col flex-grow">
                    <ul className="space-y-4 flex-grow">
                      {plan.features.map(feature => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                     <Button
                        className="w-full mt-8"
                        onClick={() => {
                          if (plan.id === 'enterprise') {
                            setContactModalOpen(true);
                          }
                        }}
                        asChild={plan.id !== 'enterprise'}
                      >
                        {plan.id === 'enterprise' ? (
                            'Contact Sales'
                        ) : (
                            <Link href={`/register?plan=${plan.id}&freq=${billingFrequency}`}>
                                Start Free Trial
                            </Link>
                        )}
                      </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
             <div className="mt-12 text-center text-muted-foreground">
                <p className="font-bold">Flexible Add-ons:</p>
                <p>Extra Facility: +$25-49/mo | Extra 50 Members: +$10-20/mo</p>
             </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 sm:py-32">
            <div className="container">
                <div className="text-center">
                    <h2 className="text-3xl font-headline font-bold">Launch Your Facility's OS in Minutes.</h2>
                    <p className="mt-4 text-muted-foreground">Three simple steps to get your facility up and running.</p>
                </div>
                <div className="mt-12 grid gap-y-12 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-0">
                    {[
                        { title: 'Sign Up', desc: 'Create your account and pick a plan that works for you.' },
                        { title: 'Set Up Facility & Bays', desc: 'Enter your facility details, operating hours, and define your golf bays.' },
                        { title: 'Start Managing', desc: 'Invite members, manage bookings, and grow your business.' },
                    ].map((step, index) => (
                        <div key={step.title} className="relative text-center px-8">
                            {index < 2 && (
                                <div className="hidden lg:block absolute top-6 left-1/2 w-full h-px -translate-y-1/2">
                                    <div className="w-full h-full border-t-2 border-dashed border-border"></div>
                                </div>
                            )}
                            <div className="relative inline-block bg-background">
                                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{index + 1}</div>
                            </div>
                            <h3 className="text-xl font-semibold mt-4">{step.title}</h3>
                            <p className="mt-2 text-muted-foreground">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="container py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} TeeBoxed. All rights reserved.</p>
          <div className="flex items-center space-x-6 text-sm">
            <a href="#" className="text-muted-foreground hover:text-primary">About</a>
            <a href="#" className="text-muted-foreground hover:text-primary">Privacy Policy</a>
            <a href="#" className="text-muted-foreground hover:text-primary">Terms</a>
            <a href="#" className="text-muted-foreground hover:text-primary">Support</a>
          </div>
        </div>
      </footer>

      <Dialog open={isContactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact Sales</DialogTitle>
            <DialogDescription>
              Let's talk about how TeeBoxed can meet your enterprise needs. Fill out the form below and we'll be in touch.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input id="name" placeholder="Name" />
            <Input id="email" type="email" placeholder="Email" />
            <Input id="company" placeholder="Company Name" />
            <Input id="message" placeholder="Tell us about your needs" />
          </div>
          <DialogFooter>
            <Button onClick={() => setContactModalOpen(false)} type="submit">Send Message</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
