"use client";

import { useState } from "react";

import { Button } from "@dubai/ui/button";
import { Input } from "@dubai/ui/input";
import { Label } from "@dubai/ui/label";

import { useAuth } from "@dubai/auth/hooks";
import { getSupabaseBrowserClient } from "@dubai/auth/client";

import { AvatarUpload } from "~/components/AvatarUpload";

export default function ProfilePage() {
  const { user } = useAuth();
  const [name, setName] = useState(
    String(user?.user_metadata.full_name ?? ""),
  );
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.updateUser({
        data: { full_name: name },
      });
      setSuccess(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold">Profile Settings</h1>

      <AvatarUpload
        userId={user?.id ?? ""}
        {...(user?.user_metadata.avatar_url ? { currentAvatar: String(user.user_metadata.avatar_url) } : {})}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={user?.email ?? ""}
            disabled
            className="opacity-60"
          />
          <p className="text-muted-foreground text-xs">
            Email changes require re-verification.
          </p>
        </div>

        {success && (
          <p className="text-sm text-green-600">Profile updated.</p>
        )}

        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </div>
  );
}
