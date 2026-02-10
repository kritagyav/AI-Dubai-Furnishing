import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

export default function VerifyEmailScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center p-6">
      <Text className="mb-4 text-2xl font-bold">Check Your Email</Text>
      <Text className="text-muted-foreground mb-6 text-center">
        We&apos;ve sent a verification link to your email address. Please click
        the link to verify your account.
      </Text>
      <Pressable
        onPress={() => router.push("/(auth)/login" as never)}
        className="rounded-lg border border-gray-300 px-6 py-3"
      >
        <Text className="font-semibold">Back to Sign In</Text>
      </Pressable>
    </View>
  );
}
