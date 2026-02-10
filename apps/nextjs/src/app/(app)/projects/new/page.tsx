"use client";

/**
 * New Project — Story 2.1: Create & Manage Furnishing Projects.
 * Simple form to create a new furnishing project.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@dubai/ui/button";

import { useTRPCClient } from "~/trpc/react";

export default function NewProjectPage() {
  const client = useTRPCClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const project = await client.room.createProject.mutate({
        name,
        address: address || undefined,
      });
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-3xl font-bold">New Project</h1>
        <p className="text-muted-foreground mt-1">
          Create a furnishing project for your apartment
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            Project Name <span className="text-destructive">*</span>
          </label>
          <input
            id="name"
            type="text"
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Marina Heights Apartment"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="address" className="text-sm font-medium">
            Address
          </label>
          <input
            id="address"
            type="text"
            maxLength={500}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Dubai Marina, Tower 4, Apt 2301"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? "Creating..." : "Create Project"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
