"use client";

import { useState } from "react";

import { Button } from "@dubai/ui/button";
import { Input } from "@dubai/ui/input";

import { getSupabaseBrowserClient } from "@dubai/auth/client";

export default function SecurityPage() {
  const [qrCode, setQrCode] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const enrollMFA = async () => {
    setError("");
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });

      if (enrollError ?? !data) {
        setError("Failed to start MFA enrollment.");
        return;
      }

      // data.totp.qr_code is a base64 encoded SVG image
      setQrCode(data.totp.qr_code);
    } finally {
      setLoading(false);
    }
  };

  const verifyMFA = async () => {
    setError("");
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factorId = factors?.totp[0]?.id;

      if (!factorId) {
        setError("No TOTP factor found.");
        return;
      }

      const { error: verifyError } =
        await supabase.auth.mfa.challengeAndVerify({
          factorId,
          code: verifyCode,
        });

      if (verifyError) {
        setError("Invalid verification code.");
        return;
      }

      setMfaEnabled(true);
      setQrCode("");
      setVerifyCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold">Security Settings</h1>

      <div className="border-border space-y-4 rounded-lg border p-6">
        <h2 className="text-xl font-semibold">Two-Factor Authentication</h2>

        {!mfaEnabled && !qrCode && (
          <div>
            <p className="text-muted-foreground mb-4 text-sm">
              Add an extra layer of security to your account with TOTP-based
              two-factor authentication.
            </p>
            <Button onClick={enrollMFA} disabled={loading}>
              {loading ? "Setting up..." : "Enable MFA"}
            </Button>
          </div>
        )}

        {qrCode && (
          <div className="space-y-4">
            <p className="text-sm">
              Scan this QR code with your authenticator app (Google
              Authenticator, Authy, 1Password):
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="MFA QR Code" className="h-64 w-64" />

            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter verification code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                maxLength={6}
                className="max-w-xs"
              />
              <Button onClick={verifyMFA} disabled={loading}>
                {loading ? "Verifying..." : "Verify & Enable"}
              </Button>
            </div>
          </div>
        )}

        {mfaEnabled && (
          <p className="text-sm text-green-600">
            Two-factor authentication is enabled for your account.
          </p>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>
    </div>
  );
}
