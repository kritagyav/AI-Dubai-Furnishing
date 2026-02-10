import type { Meta, StoryObj } from "@storybook/react";

import { ErrorState } from "./state-error";

const meta = {
  title: "States/ErrorState",
  component: ErrorState,
  tags: ["autodocs"],
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NetworkError: Story = {
  args: {
    title: "Connection failed",
    message:
      "We couldn't reach our servers. Check your internet connection and try again.",
    retryLabel: "Try again",
    onRetry: () => alert("Retry"),
  },
};

export const PackageGenerationFailed: Story = {
  args: {
    title: "Package generation failed",
    message:
      "We couldn't generate your furnishing package. This usually means we need more room data. Try updating your room dimensions.",
    retryLabel: "Retry generation",
    onRetry: () => alert("Retry"),
    secondaryLabel: "Edit room data",
    onSecondary: () => alert("Edit"),
    correlationId: "m3k2j9f-abc12345",
  },
};

export const NotFound: Story = {
  args: {
    title: "Page not found",
    message:
      "The page you're looking for doesn't exist or has been moved.",
    retryLabel: "Go to dashboard",
    onRetry: () => alert("Dashboard"),
  },
};
