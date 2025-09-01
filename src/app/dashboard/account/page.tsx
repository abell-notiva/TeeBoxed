
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { auth, db, storage } from '@/lib/firebase';
import { onAuthStateChanged, User, updateProfile, deleteUser, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import { Terminal, Trash2, KeyRound, CheckCircle } from 'lucide-react';

export default function AccountPage() {
    const router = useRouter();
    const [user, setUser] = React.useState<User | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [success, setSuccess] = React.useState<string | null>(null);

    const [fullName, setFullName] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [photoFile, setPhotoFile] = React.useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
    
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setPhotoPreview(currentUser.photoURL);
                
                // Fetch user data from Firestore
                const userDocRef = doc(db, 'users', currentUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    setFullName(userData.fullName || currentUser.displayName || '');
                    setPhone(userData.phone || '');
                } else {
                    setFullName(currentUser.displayName || '');
                }

            } else {
                router.push('/login');
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [router]);
    
    const handleSaveChanges = async () => {
        if (!user) return;
        setIsSaving(true);
        setError(null);
        setSuccess(null);
        try {
            let newPhotoURL = user.photoURL;

            // 1. Upload photoFile to Firebase Storage if a new one exists
            if (photoFile) {
                const storageRef = ref(storage, `profile-photos/${user.uid}`);
                const snapshot = await uploadBytes(storageRef, photoFile);
                newPhotoURL = await getDownloadURL(snapshot.ref);
            }

            // 2. Update Firebase Auth profile
            await updateProfile(user, {
              displayName: fullName,
              photoURL: newPhotoURL 
            });
            
            // 3. Update Firestore user document
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, { fullName: fullName, phone: phone }, { merge: true });
            
            // 4. Update state and clear file input
            if(newPhotoURL) setPhotoPreview(newPhotoURL);
            setPhotoFile(null); 
            setSuccess("Profile updated successfully!");
        } catch (err: any) {
            setError("Failed to update profile. Please try again.");
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    }
    
    const handleDeleteAccount = async () => {
        if(!user) return;
        try {
            // A production app should use a Firebase Function to delete all associated user data from Firestore.
            await deleteUser(user);
            router.push('/login');
        } catch (err: any) {
             setError("Failed to delete account. You may need to sign in again to complete this action.");
             console.error(err);
        }
    }

    const handlePasswordReset = async () => {
        if (!user || !user.email) {
            setError("Could not find user email. Please sign in again.");
            return;
        }
        setError(null);
        setSuccess(null);
        try {
            await sendPasswordResetEmail(auth, user.email);
            setSuccess("Password reset email sent. Please check your inbox.");
        } catch (err: any) {
            setError("Failed to send password reset email. Please try again.");
            console.error(err);
        }
    }
    
    const handlePhotoUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setPhotoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const getInitials = (name: string) => {
        if (!name) return '';
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    }

    if (loading) {
        return <div className="flex items-center justify-center h-screen"><p>Loading account details...</p></div>;
    }

    return (
        <div className="flex flex-col sm:gap-4 sm:py-4 flex-grow">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                <h1 className="text-xl font-semibold">Account Settings</h1>
            </header>
            <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                {error && <Alert variant="destructive"><Terminal className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                {success && <Alert variant="default" className="border-green-500 text-green-700"><CheckCircle className="h-4 w-4 text-green-600" /><AlertTitle>Success</AlertTitle><AlertDescription>{success}</AlertDescription></Alert>}

                 <Card>
                    <CardHeader>
                        <CardTitle>Your Profile</CardTitle>
                        <CardDescription>
                            Manage your personal information. This information is separate from any member profiles.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-20 w-20">
                                <AvatarImage src={photoPreview || ''} alt={fullName || ''} />
                                <AvatarFallback>{getInitials(fullName)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <Button onClick={handlePhotoUploadClick}>Upload Photo</Button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                    accept="image/png, image/jpeg, image/gif"
                                />
                                <p className="text-xs text-muted-foreground mt-2">PNG, JPG, GIF up to 5MB.</p>
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Full Name</Label>
                                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input id="email" value={user?.email || ''} readOnly disabled />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number (Optional)</Label>
                                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +1 555-555-5555" />
                            </div>
                        </div>
                        
                        <Button onClick={handleSaveChanges} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Security</CardTitle>
                        <CardDescription>
                            Manage your account password.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="outline" onClick={handlePasswordReset}>
                            <KeyRound className="mr-2 h-4 w-4" />
                            Send Password Reset Email
                        </Button>
                    </CardContent>
                </Card>

                 <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle>Delete Account</CardTitle>
                        <CardDescription>
                           Permanently delete your account and all associated data. This action cannot be undone.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete My Account
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete your account and remove all your data from our servers. This action is irreversible.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive hover:bg-destructive/90">Confirm Deletion</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
