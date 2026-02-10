-- Story 1.10: Onboarding Path Selection

-- Create OnboardingPath enum
CREATE TYPE "OnboardingPath" AS ENUM ('FURNISH_NOW', 'JUST_BROWSING');

-- Add onboarding fields to User table
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "onboardingPath" "OnboardingPath",
  ADD COLUMN IF NOT EXISTS "onboardedAt" TIMESTAMPTZ;
