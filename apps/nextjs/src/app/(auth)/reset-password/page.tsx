"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@dubai/ui/button";
import { Input } from "@dubai/ui/input";

import { resetPassword } from "@dubai/auth/hooks";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: resetError } = await resetPassword(email);

      if (resetError) {
        setError("Failed to send reset email. Please try again.");
        return;
      }

      setSent(true);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <h1 className="text-2xl font-bold">Check Your Email</h1>
        <p className="text-muted-foreground">
          If an account exists with that email, we&apos;ve sent a password reset
          link.
        </p>
        <Button variant="outline" asChild>
          <Link href="/login">Back to Sign In</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="text-center text-2xl font-bold">Reset Password</h1>
      <p className="text-muted-foreground text-center text-sm">
        Enter your email address and we&apos;ll send you a link to reset your
        password.
      </p>

      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sending..." : "Send Reset Link"}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        <Link href="/login" className="text-primary underline">
          Back to Sign In
        </Link>
      </p>
    </form>
  );
}
