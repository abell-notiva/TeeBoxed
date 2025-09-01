
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function NotFound() {
    return (
         <div className="flex flex-col items-center justify-center min-h-screen bg-muted p-4 sm:p-6">
            <Card className="w-full max-w-2xl text-center">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight">404 - Page Not Found</CardTitle>
                    <CardDescription className="text-lg text-muted-foreground pt-2">
                        Sorry, we couldn't find the page you were looking for.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <p>
                        The URL may be incorrect, or the facility may no longer be active.
                    </p>
                    <div className="flex justify-center gap-4">
                        <Link href="/dashboard">
                            <Button variant="outline">
                                Go to Dashboard
                            </Button>
                        </Link>
                        <Link href="/find-facility">
                            <Button>Find a Facility</Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
