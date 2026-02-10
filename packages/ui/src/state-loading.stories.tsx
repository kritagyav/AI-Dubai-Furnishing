import type { Meta, StoryObj } from "@storybook/react";

import {
  EngagingWait,
  QueuedWait,
  Skeleton,
  SkeletonScreen,
  Spinner,
} from "./state-loading";

// ═══════════════════════════════════════════
// Spinner
// ═══════════════════════════════════════════

const spinnerMeta = {
  title: "States/Spinner",
  component: Spinner,
  tags: ["autodocs"],
} satisfies Meta<typeof Spinner>;

export default spinnerMeta;

type SpinnerStory = StoryObj<typeof Spinner>;

export const Small: SpinnerStory = { args: { size: "sm" } };
export const Medium: SpinnerStory = { args: { size: "md" } };
export const Large: SpinnerStory = { args: { size: "lg" } };

// ═══════════════════════════════════════════
// SkeletonScreen
// ═══════════════════════════════════════════

export const SkeletonScreenDefault: StoryObj<typeof SkeletonScreen> = {
  render: () => <SkeletonScreen message="Scanning your room..." rows={4} />,
  name: "Skeleton Screen",
};

export const SkeletonSingle: StoryObj<typeof Skeleton> = {
  render: () => <Skeleton className="h-10 w-full" />,
  name: "Single Skeleton",
};

// ═══════════════════════════════════════════
// EngagingWait
// ═══════════════════════════════════════════

export const EngagingWaitStory: StoryObj<typeof EngagingWait> = {
  render: () => (
    <EngagingWait
      currentStep={2}
      totalSteps={5}
      steps={[
        "Analyzing room dimensions",
        "Matching lifestyle preferences",
        "Curating furniture selections",
        "Optimizing budget allocation",
        "Generating 3D preview",
      ]}
      tips={[
        "Dubai Marina apartments average 15% higher rental yields with premium furnishing.",
        "Our AI considers natural light patterns when selecting color palettes.",
        "Over 90% of Airbnb guests rate well-furnished apartments 5 stars.",
      ]}
      currentTip={1}
    />
  ),
  name: "Engaging Wait (AI Generation)",
};

// ═══════════════════════════════════════════
// QueuedWait
// ═══════════════════════════════════════════

export const QueuedWaitStory: StoryObj<typeof QueuedWait> = {
  render: () => (
    <QueuedWait
      title="Package under review"
      description="Our design team is reviewing your AI-generated package to ensure quality and dimensional accuracy. You'll receive a notification when it's approved."
      estimatedTime="30-60 minutes"
    />
  ),
  name: "Queued Wait (Human Review)",
};
