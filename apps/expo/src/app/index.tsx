import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { trpc } from "~/utils/api";

export default function Index() {
  const router = useRouter();
  const sessionQuery = useQuery(trpc.user.getSession.queryOptions());

  const navItems = [
    { label: "My Projects", route: "/(app)/projects", desc: "Manage rooms and floor plans" },
    { label: "Browse Products", route: "/(app)/gallery", desc: "Explore furniture catalog" },
    { label: "Cart", route: "/(app)/cart", desc: "Review items and checkout" },
    { label: "My Orders", route: "/(app)/orders", desc: "Track your orders" },
    { label: "Support", route: "/(app)/support", desc: "Get help with your account" },
    { label: "Settings", route: "/(app)/settings", desc: "Profile and preferences" },
  ] as const;

  return (
    <SafeAreaView className="bg-background flex-1">
      <Stack.Screen options={{ title: "Home" }} />
      <View className="flex-1 p-4">
        <Text className="text-foreground pb-2 text-center text-4xl font-bold">
          Dubai <Text className="text-primary">Furnishing</Text>
        </Text>

        <View className="py-4">
          <Text className="text-foreground text-center text-lg">
            {sessionQuery.data ? "Welcome back!" : "Loading..."}
          </Text>
        </View>

        <View className="mt-4 gap-3">
          {navItems.map((item) => (
            <Pressable
              key={item.route}
              onPress={() => router.push(item.route as never)}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <Text className="text-foreground text-lg font-semibold">
                {item.label}
              </Text>
              <Text className="text-muted-foreground mt-1 text-sm">
                {item.desc}
              </Text>
            </Pressable>
          ))}
        </View>

        {!sessionQuery.data ? (
          <Pressable
            onPress={() => router.push("/(auth)/login" as never)}
            className="mt-6 rounded-lg bg-blue-600 p-4"
          >
            <Text className="text-center font-semibold text-white">
              Sign In
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
