import { useEffect } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { supabase } from "~/lib/supabase";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = params.code as string | undefined;

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
        router.replace("/" as never);
      }
    };

    void handleCallback();
  }, [params, router]);

  return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-lg">Completing sign in...</Text>
    </View>
  );
}
