import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "~/lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("Invalid credentials");
        return;
      }

      router.replace("/" as never);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    try {
      const { data, error: oauthError } =
        await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: "dubaifurnishing://auth/callback",
            skipBrowserRedirect: true,
          },
        });

      if (oauthError ?? !data.url) {
        setError("Social login failed");
        return;
      }

      await WebBrowser.openBrowserAsync(data.url);
    } catch {
      setError("Social login failed");
    }
  };

  return (
    <View className="flex-1 justify-center p-6">
      <Text className="mb-6 text-2xl font-bold">Sign In</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        className="mb-4 rounded-lg border border-gray-300 p-4"
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        className="mb-4 rounded-lg border border-gray-300 p-4"
      />

      {error ? <Text className="mb-4 text-red-600">{error}</Text> : null}

      <Pressable
        onPress={handleLogin}
        disabled={loading}
        className="rounded-lg bg-blue-600 p-4 disabled:opacity-50"
      >
        <Text className="text-center font-semibold text-white">
          {loading ? "Signing in..." : "Sign In"}
        </Text>
      </Pressable>

      <View className="my-6 flex-row items-center">
        <View className="flex-1 border-t border-gray-300" />
        <Text className="px-4 text-gray-500">Or continue with</Text>
        <View className="flex-1 border-t border-gray-300" />
      </View>

      <View className="flex-row gap-4">
        <Pressable
          onPress={() => handleOAuth("google")}
          className="flex-1 rounded-lg border border-gray-300 p-4"
        >
          <Text className="text-center font-semibold">Google</Text>
        </Pressable>
        <Pressable
          onPress={() => handleOAuth("apple")}
          className="flex-1 rounded-lg border border-gray-300 p-4"
        >
          <Text className="text-center font-semibold">Apple</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.push("/(auth)/register" as never)}
        className="mt-4"
      >
        <Text className="text-center text-blue-600">
          Don&apos;t have an account? Sign up
        </Text>
      </Pressable>
    </View>
  );
}
