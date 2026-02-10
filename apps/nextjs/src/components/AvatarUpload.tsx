"use client";

import { useState } from "react";

import { Button } from "@dubai/ui/button";

import { getSupabaseBrowserClient } from "@dubai/auth/client";

export function AvatarUpload({
  userId,
  currentAvatar,
}: {
  userId: string;
  currentAvatar?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatar);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const supabase = getSupabaseBrowserClient();

      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return;
      }

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      setAvatarUrl(data.publicUrl);

      // Update user metadata with new avatar URL
      await supabase.auth.updateUser({
        data: { avatar_url: data.publicUrl },
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center space-x-4">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt="Avatar"
          className="h-20 w-20 rounded-full object-cover"
        />
      ) : (
        <div className="bg-muted flex h-20 w-20 items-center justify-center rounded-full">
          <span className="text-muted-foreground text-2xl">?</span>
        </div>
      )}
      <Button asChild disabled={uploading}>
        <label className="cursor-pointer">
          {uploading ? "Uploading..." : "Upload Avatar"}
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
        </label>
      </Button>
    </div>
  );
}
