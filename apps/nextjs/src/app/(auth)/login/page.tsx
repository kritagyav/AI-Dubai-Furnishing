"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@dubai/auth/client";
import { signIn, signInWithOAuth } from "@dubai/auth/hooks";
import { Button } from "@dubai/ui/button";
import { Input } from "@dubai/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        setError("Invalid credentials");
        return;
      }

      // Check if MFA is required
      const supabase = getSupabaseBrowserClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors?.totp && factors.totp.length > 0) {
        router.push("/mfa-challenge");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: "google" | "apple") => {
    try {
      await signInWithOAuth(provider);
    } catch {
      setError("Social login failed");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-center text-2xl font-bold">Sign In</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="border-border w-full border-t" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="text-muted-foreground bg-white px-2 dark:bg-gray-900">
            Or continue with
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => handleOAuthLogin("google")}
        >
          Google
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleOAuthLogin("apple")}
        >
          Apple
        </Button>
      </div>

      <div className="text-muted-foreground space-y-2 text-center text-sm">
        <p>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary underline">
            Sign up
          </Link>
        </p>
        <p>
          <Link href="/reset-password" className="text-primary underline">
            Forgot password?
          </Link>
        </p>
      </div>
    </div>
  );
}
