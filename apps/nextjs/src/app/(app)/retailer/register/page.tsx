"use client";

/**
 * Retailer Registration — Story 5.1: Retailer Onboarding Portal.
 * Multi-step form for retailer application submission.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@dubai/ui/button";

import { useTRPCClient } from "~/trpc/react";

export default function RetailerRegisterPage() {
  const client = useTRPCClient();
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [tradeLicense, setTradeLicense] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [warehouseDetails, setWarehouseDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await client.retailer.register.mutate({
        companyName,
        tradeLicenseNumber: tradeLicense,
        contactEmail: email,
        contactPhone: phone || undefined,
        businessType: businessType || undefined,
        warehouseDetails: warehouseDetails || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
        <h1 className="text-3xl font-bold">Application Submitted</h1>
        <p className="text-muted-foreground">
          Thank you for applying to join the Dubai Furnishing Marketplace. Our
          team will review your application within 1-3 business days. You'll
          receive an email notification when a decision is made.
        </p>
        <Button onClick={() => router.push("/dashboard")}>
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Retailer Application</h1>
        <p className="text-muted-foreground mt-1">
          Join our marketplace and have your products included in AI-curated
          furnishing packages.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="company" className="text-sm font-medium">
            Company Name <span className="text-destructive">*</span>
          </label>
          <input
            id="company"
            type="text"
            required
            maxLength={200}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Dubai Furniture Co."
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="trade-license" className="text-sm font-medium">
            Trade License Number <span className="text-destructive">*</span>
          </label>
          <input
            id="trade-license"
            type="text"
            required
            maxLength={100}
            value={tradeLicense}
            onChange={(e) => setTradeLicense(e.target.value)}
            placeholder="UAE trade license number"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="contact-email" className="text-sm font-medium">
            Contact Email <span className="text-destructive">*</span>
          </label>
          <input
            id="contact-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="business@example.com"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="phone" className="text-sm font-medium">
            Phone Number
          </label>
          <input
            id="phone"
            type="tel"
            maxLength={20}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+971 XX XXX XXXX"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="business-type" className="text-sm font-medium">
            Business Type
          </label>
          <select
            id="business-type"
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Select type...</option>
            <option value="manufacturer">Manufacturer</option>
            <option value="distributor">Distributor</option>
            <option value="retailer">Retailer</option>
            <option value="importer">Importer</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="warehouse" className="text-sm font-medium">
            Warehouse / Showroom Details
          </label>
          <textarea
            id="warehouse"
            maxLength={2000}
            rows={3}
            value={warehouseDetails}
            onChange={(e) => setWarehouseDetails(e.target.value)}
            placeholder="Location, size, delivery capabilities..."
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button
            type="submit"
            disabled={
              submitting ||
              !companyName.trim() ||
              !tradeLicense.trim() ||
              !email.trim()
            }
          >
            {submitting ? "Submitting..." : "Submit Application"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
