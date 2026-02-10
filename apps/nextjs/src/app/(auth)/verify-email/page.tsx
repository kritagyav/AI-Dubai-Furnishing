import Link from "next/link";

import { Button } from "@dubai/ui/button";

export default function VerifyEmailPage() {
  return (
    <div className="space-y-6 text-center">
      <h1 className="text-2xl font-bold">Check Your Email</h1>
      <p className="text-muted-foreground">
        We&apos;ve sent a verification link to your email address. Please click
        the link to verify your account.
      </p>
      <p className="text-muted-foreground text-sm">
        Didn&apos;t receive the email? Check your spam folder or try signing up
        again.
      </p>
      <Button variant="outline" asChild>
        <Link href="/login">Back to Sign In</Link>
      </Button>
    </div>
  );
}
