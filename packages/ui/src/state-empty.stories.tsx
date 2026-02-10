import type { Meta, StoryObj } from "@storybook/react";

import { EmptyState } from "./state-empty";

const meta = {
  title: "States/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoProjects: Story = {
  args: {
    title: "No projects yet",
    description:
      "Create your first furnishing project to get AI-curated furniture packages for your apartment.",
    actionLabel: "Create project",
    onAction: () => alert("Create project"),
  },
};

export const NoOrders: Story = {
  args: {
    title: "No orders yet",
    description:
      "Once you checkout a furnishing package, your orders will appear here with delivery tracking.",
  },
};

export const NoSavedPackages: Story = {
  args: {
    title: "No saved packages",
    description:
      "Browse furnishing packages and save your favorites to compare later.",
    actionLabel: "Browse packages",
    onAction: () => alert("Browse"),
  },
};
