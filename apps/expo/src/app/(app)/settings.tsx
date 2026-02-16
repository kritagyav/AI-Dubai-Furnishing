import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { Stack, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";
import { trpc } from "~/utils/api";

export default function SettingsScreen() {
  const router = useRouter();

  const profileQuery = useQuery(trpc.user.getProfile.queryOptions());

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          void supabase.auth.signOut().then(() => {
            router.replace("/(auth)/login" as never);
          });
        },
      },
    ]);
  };

  if (profileQuery.isLoading) {
    return (
      <SafeAreaView className="bg-background flex-1" edges={["bottom"]}>
        <Stack.Screen options={{ title: "Settings" }} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#c03484" />
        </View>
      </SafeAreaView>
    );
  }

  const profile = profileQuery.data;
  const appVersion = Constants.expoConfig?.version ?? "0.1.0";

  return (
    <SafeAreaView className="bg-background flex-1" edges={["bottom"]}>
      <Stack.Screen options={{ title: "Settings" }} />

      <ScrollView className="flex-1 p-4">
        {/* Profile Card */}
        <View className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
          <Text className="text-foreground text-xl font-bold">Profile</Text>

          <View className="mt-4">
            <Text className="text-muted-foreground text-xs uppercase">
              Name
            </Text>
            <Text className="text-foreground mt-1 text-base">
              {profile?.name ?? "Not set"}
            </Text>
          </View>

          <View className="mt-4">
            <Text className="text-muted-foreground text-xs uppercase">
              Email
            </Text>
            <Text className="text-foreground mt-1 text-base">
              {profile?.email ?? "Not set"}
            </Text>
          </View>

          <View className="mt-4">
            <Text className="text-muted-foreground text-xs uppercase">
              Role
            </Text>
            <Text className="text-foreground mt-1 text-base">
              {profile?.role ?? "User"}
            </Text>
          </View>

          <View className="mt-4">
            <Text className="text-muted-foreground text-xs uppercase">
              Member Since
            </Text>
            <Text className="text-foreground mt-1 text-base">
              {profile?.createdAt
                ? new Date(profile.createdAt).toLocaleDateString("en-AE", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "Unknown"}
            </Text>
          </View>
        </View>

        {/* Quick Links */}
        <View className="mb-4 rounded-lg border border-gray-200 bg-white">
          <Pressable
            onPress={() => router.push("/(app)/projects" as never)}
            className="border-b border-gray-100 p-4"
          >
            <Text className="text-foreground font-medium">My Projects</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(app)/orders" as never)}
            className="border-b border-gray-100 p-4"
          >
            <Text className="text-foreground font-medium">My Orders</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(app)/cart" as never)}
            className="border-b border-gray-100 p-4"
          >
            <Text className="text-foreground font-medium">Cart</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(app)/support" as never)}
            className="p-4"
          >
            <Text className="text-foreground font-medium">Support</Text>
          </Pressable>
        </View>

        {/* Sign Out */}
        <Pressable
          onPress={handleSignOut}
          className="mb-4 rounded-lg border border-red-200 bg-white p-4"
        >
          <Text className="text-center font-semibold text-red-600">
            Sign Out
          </Text>
        </Pressable>

        {/* App Version */}
        <View className="mb-8 items-center">
          <Text className="text-muted-foreground text-sm">
            Dubai Furnishing v{appVersion}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
