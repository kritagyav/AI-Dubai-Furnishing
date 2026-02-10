import type { Preview } from "@storybook/react";
import * as React from "react";

import { ThemeProvider } from "../src/theme";
import { ZoneProvider } from "../src/zones";
import type { ZoneName } from "../src/zones";

const preview: Preview = {
  parameters: {
    a11y: {
      element: "#storybook-root",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  globalTypes: {
    zone: {
      description: "Design token zone",
      toolbar: {
        title: "Zone",
        icon: "paintbrush",
        items: [
          { value: "warmth", title: "Warmth" },
          { value: "delight", title: "Delight" },
          { value: "efficiency", title: "Efficiency" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    zone: "warmth",
  },
  decorators: [
    (Story, context) => {
      const zone = (context.globals.zone as ZoneName) ?? "warmth";
      return (
        <ThemeProvider>
          <ZoneProvider zone={zone}>
            <Story />
          </ZoneProvider>
        </ThemeProvider>
      );
    },
  ],
};

export default preview;
