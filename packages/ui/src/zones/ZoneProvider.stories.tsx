import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../button";
import { Input } from "../input";
import { ZoneProvider } from "./ZoneProvider";

const meta = {
  title: "Foundations/ZoneProvider",
  component: ZoneProvider,
  parameters: {
    a11y: {},
  },
  tags: ["autodocs"],
  argTypes: {
    zone: {
      control: "select",
      options: ["warmth", "delight", "efficiency"],
    },
  },
} satisfies Meta<typeof ZoneProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Warmth: Story = {
  args: {
    zone: "warmth",
    children: (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h3>Warmth Zone</h3>
        <Button>Primary Action</Button>
        <Button variant="outline">Secondary Action</Button>
        <Input placeholder="Enter text..." />
      </div>
    ),
  },
};

export const Delight: Story = {
  args: {
    zone: "delight",
    children: (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h3>Delight Zone</h3>
        <Button>Primary Action</Button>
        <Button variant="outline">Secondary Action</Button>
        <Input placeholder="Enter text..." />
      </div>
    ),
  },
};

export const Efficiency: Story = {
  args: {
    zone: "efficiency",
    children: (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h3>Efficiency Zone</h3>
        <Button>Primary Action</Button>
        <Button variant="outline">Secondary Action</Button>
        <Input placeholder="Enter text..." />
      </div>
    ),
  },
};
