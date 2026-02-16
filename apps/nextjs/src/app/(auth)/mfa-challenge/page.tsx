"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@dubai/auth/client";
import { Button } from "@dubai/ui/button";
import { Input } from "@dubai/ui/input";

export default function MFAChallengePage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factorId = factors?.totp[0]?.id;

      if (!factorId) {
        setError("MFA not properly configured");
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify(
        {
          factorId,
          code,
        },
      );

      if (verifyError) {
        setError("Invalid code. Please try again.");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="text-center text-2xl font-bold">
        Enter Authentication Code
      </h1>
      <p className="text-muted-foreground text-center text-sm">
        Enter the 6-digit code from your authenticator app.
      </p>

      <Input
        type="text"
        placeholder="6-digit code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={6}
        required
        className="text-center text-lg tracking-widest"
      />

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Verifying..." : "Verify"}
      </Button>
    </form>
  );
}
