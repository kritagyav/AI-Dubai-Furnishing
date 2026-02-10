import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { supabase } from "~/lib/supabase";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async () => {
    setError("");
    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });

      if (signUpError) {
        setError("Registration failed. Please try again.");
        return;
      }

      router.push("/(auth)/verify-email" as never);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center p-6">
      <Text className="mb-6 text-2xl font-bold">Create Account</Text>

      <TextInput
        placeholder="Full Name"
        value={name}
        onChangeText={setName}
        className="mb-4 rounded-lg border border-gray-300 p-4"
      />

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
        onPress={handleRegister}
        disabled={loading}
        className="rounded-lg bg-blue-600 p-4 disabled:opacity-50"
      >
        <Text className="text-center font-semibold text-white">
          {loading ? "Creating account..." : "Sign Up"}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/(auth)/login" as never)}
        className="mt-4"
      >
        <Text className="text-center text-blue-600">
          Already have an account? Sign in
        </Text>
      </Pressable>
    </View>
  );
}
