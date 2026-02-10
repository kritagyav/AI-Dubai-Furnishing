import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { trpc } from "~/utils/api";

export default function Index() {
  const sessionQuery = useQuery(trpc.user.getSession.queryOptions());

  return (
    <SafeAreaView className="bg-background">
      <Stack.Screen options={{ title: "Home Page" }} />
      <View className="bg-background h-full w-full p-4">
        <Text className="text-foreground pb-2 text-center text-5xl font-bold">
          Dubai <Text className="text-primary">Furnishing</Text>
        </Text>

        <View className="py-4">
          <Text className="text-foreground text-center text-xl">
            {sessionQuery.data ? "Welcome back!" : "Loading..."}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
