import { useColorScheme } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Sentry from "@sentry/react-native";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "~/utils/api";

import "../styles.css";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
});

// This is the main layout of the app
// It wraps your pages with the providers they need
function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      {/*
          The Stack component displays the current page.
          It also allows you to configure your screens
        */}
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: "#c03484",
          },
          contentStyle: {
            backgroundColor: colorScheme == "dark" ? "#09090B" : "#FFFFFF",
          },
        }}
      />
      <StatusBar />
    </QueryClientProvider>
  );
}

export default Sentry.wrap(RootLayout);
