"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@dubai/ui/button";
import { Input } from "@dubai/ui/input";

import { getSupabaseBrowserClient } from "@dubai/auth/client";

type MfaStatus = "loading" | "disabled" | "enrolling" | "enabled";

export default function SecurityPage() {
  const [qrCode, setQrCode] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [mfaStatus, setMfaStatus] = useState<MfaStatus>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const checkMfaStatus = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();

      const verifiedFactor = factors?.totp.find(
        (f) => f.status === "verified",
      );

      if (verifiedFactor) {
        setMfaStatus("enabled");
        setFactorId(verifiedFactor.id);
      } else {
        setMfaStatus("disabled");
        setFactorId(null);
      }
    } catch {
      setMfaStatus("disabled");
    }
  }, []);

  useEffect(() => {
    void checkMfaStatus();
  }, [checkMfaStatus]);

  const enrollMFA = async () => {
    setError("");
    setSuccess("");
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
      setFactorId(data.id);
      setMfaStatus("enrolling");
    } finally {
      setLoading(false);
    }
  };

  const verifyMFA = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const pendingFactorId = factors?.totp[0]?.id;

      if (!pendingFactorId) {
        setError("No TOTP factor found.");
        return;
      }

      const { error: verifyError } =
        await supabase.auth.mfa.challengeAndVerify({
          factorId: pendingFactorId,
          code: verifyCode,
        });

      if (verifyError) {
        setError("Invalid verification code.");
        return;
      }

      setMfaStatus("enabled");
      setFactorId(pendingFactorId);
      setQrCode("");
      setVerifyCode("");
      setSuccess("Two-factor authentication has been enabled successfully.");
    } finally {
      setLoading(false);
    }
  };

  const disableMFA = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      if (!factorId) {
        setError("No MFA factor found to disable.");
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId,
      });

      if (unenrollError) {
        setError("Failed to disable MFA. Please try again.");
        return;
      }

      setMfaStatus("disabled");
      setFactorId(null);
      setSuccess("Two-factor authentication has been disabled.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold">Security Settings</h1>

      <div className="bg-card space-y-4 rounded-lg p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Two-Factor Authentication
          </h2>
          {mfaStatus !== "loading" && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                mfaStatus === "enabled"
                  ? "bg-[var(--color-success-light)] text-[var(--color-success-dark)]"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {mfaStatus === "enabled" ? "Enabled" : "Disabled"}
            </span>
          )}
        </div>

        {mfaStatus === "loading" && (
          <p className="text-muted-foreground text-sm">
            Checking MFA status...
          </p>
        )}

        {mfaStatus === "disabled" && (
          <div>
            <p className="text-muted-foreground mb-4 text-sm">
              Add an extra layer of security to your account with TOTP-based
              two-factor authentication.
            </p>
            <Button onClick={enrollMFA} disabled={loading}>
              {loading ? "Setting up..." : "Enable Two-Factor Authentication"}
            </Button>
          </div>
        )}

        {mfaStatus === "enrolling" && qrCode && (
          <div className="space-y-4">
            <p className="text-sm">
              Scan this QR code with your authenticator app (Google
              Authenticator, Authy, 1Password):
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="MFA QR Code" className="h-64 w-64" />

            <div className="rounded-lg bg-[var(--color-warning-light)] p-4">
              <p className="text-sm font-medium text-[var(--color-warning-dark)]">
                Important: Save your recovery options
              </p>
              <p className="mt-1 text-xs text-[var(--color-warning-dark)]/80">
                If you lose access to your authenticator app, you will need to
                contact support to regain access to your account. Make sure your
                authenticator app is backed up or synced to the cloud.
              </p>
            </div>

            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter 6-digit verification code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                maxLength={6}
                className="max-w-xs text-center tracking-widest"
              />
              <div className="flex gap-2">
                <Button onClick={verifyMFA} disabled={loading}>
                  {loading ? "Verifying..." : "Verify & Enable"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setMfaStatus("disabled");
                    setQrCode("");
                    setVerifyCode("");
                    setError("");
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {mfaStatus === "enabled" && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-success-default)]">
              Two-factor authentication is enabled for your account.
            </p>
            <div className="rounded-lg bg-[var(--color-warning-light)] p-4">
              <p className="text-sm font-medium text-[var(--color-warning-dark)]">
                Recovery information
              </p>
              <p className="mt-1 text-xs text-[var(--color-warning-dark)]/80">
                If you lose access to your authenticator app, contact support to
                disable MFA on your account. Keep your authenticator app backed
                up and synced to avoid lockout.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={disableMFA}
              disabled={loading}
            >
              {loading ? "Disabling..." : "Disable MFA"}
            </Button>
          </div>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}
        {success && (
          <p className="text-sm text-[var(--color-success-default)]">
            {success}
          </p>
        )}
      </div>
    </div>
  );
}
