import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { trpc } from "~/utils/api";

export default function CartScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const cartQuery = useQuery(trpc.commerce.getCart.queryOptions());

  const updateItemMutation = useMutation(
    trpc.commerce.updateCartItem.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.commerce.getCart.queryKey(),
        });
      },
      onError: (error) => {
        Alert.alert("Error", error.message);
      },
    }),
  );

  const removeItemMutation = useMutation(
    trpc.commerce.removeCartItem.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.commerce.getCart.queryKey(),
        });
      },
      onError: (error) => {
        Alert.alert("Error", error.message);
      },
    }),
  );

  const createOrderMutation = useMutation(
    trpc.commerce.createOrder.mutationOptions({
      onSuccess: (data) => {
        void queryClient.invalidateQueries({
          queryKey: trpc.commerce.getCart.queryKey(),
        });
        Alert.alert(
          "Order Created",
          `Order ${data.orderRef} has been placed.`,
          [
            {
              text: "View Order",
              onPress: () =>
                router.push(`/(app)/orders/${data.orderId}` as never),
            },
            { text: "OK" },
          ],
        );
      },
      onError: (error) => {
        Alert.alert("Error", error.message);
      },
    }),
  );

  const formatPrice = (fils: number) => {
    return `AED ${(fils / 100).toFixed(2)}`;
  };

  if (cartQuery.isLoading) {
    return (
      <SafeAreaView className="bg-background flex-1" edges={["bottom"]}>
        <Stack.Screen options={{ title: "Cart" }} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#c03484" />
        </View>
      </SafeAreaView>
    );
  }

  const cart = cartQuery.data;
  const items = cart?.items ?? [];

  return (
    <SafeAreaView className="bg-background flex-1" edges={["bottom"]}>
      <Stack.Screen options={{ title: "Cart" }} />

      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-muted-foreground mb-4 text-lg">
            Your cart is empty
          </Text>
          <Pressable
            onPress={() => router.push("/(app)/gallery" as never)}
            className="rounded-lg bg-blue-600 px-6 py-3"
          >
            <Text className="font-semibold text-white">Browse Products</Text>
          </Pressable>
        </View>
      ) : (
        <View className="flex-1">
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <View className="mb-3 rounded-lg border border-gray-200 bg-white p-4">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold">
                      Product
                    </Text>
                    <Text className="text-muted-foreground mt-1 text-sm">
                      {formatPrice(item.priceFils)} each
                    </Text>
                  </View>
                  <Text className="text-foreground font-bold">
                    {formatPrice(item.priceFils * item.quantity)}
                  </Text>
                </View>

                {/* Quantity Controls */}
                <View className="mt-3 flex-row items-center gap-3">
                  <Pressable
                    onPress={() =>
                      item.quantity <= 1
                        ? removeItemMutation.mutate({ itemId: item.id })
                        : updateItemMutation.mutate({
                            itemId: item.id,
                            quantity: item.quantity - 1,
                          })
                    }
                    className="h-8 w-8 items-center justify-center rounded-full bg-gray-200"
                  >
                    <Text className="text-lg font-bold">-</Text>
                  </Pressable>

                  <Text className="text-foreground min-w-[24px] text-center text-lg font-semibold">
                    {item.quantity}
                  </Text>

                  <Pressable
                    onPress={() =>
                      updateItemMutation.mutate({
                        itemId: item.id,
                        quantity: item.quantity + 1,
                      })
                    }
                    className="h-8 w-8 items-center justify-center rounded-full bg-gray-200"
                  >
                    <Text className="text-lg font-bold">+</Text>
                  </Pressable>

                  <View className="flex-1" />

                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        "Remove Item",
                        "Remove this item from your cart?",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Remove",
                            style: "destructive",
                            onPress: () =>
                              removeItemMutation.mutate({
                                itemId: item.id,
                              }),
                          },
                        ],
                      )
                    }
                    className="rounded-lg px-3 py-1"
                  >
                    <Text className="text-sm text-red-600">Remove</Text>
                  </Pressable>
                </View>
              </View>
            )}
          />

          {/* Bottom Checkout Bar */}
          <View className="border-t border-gray-200 bg-white p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-foreground text-lg font-semibold">
                Total
              </Text>
              <Text className="text-foreground text-xl font-bold">
                {formatPrice(cart?.totalFils ?? 0)}
              </Text>
            </View>

            <Pressable
              onPress={() => {
                createOrderMutation.mutate({
                  shippingAddress: {
                    line1: "Dubai Marina",
                    city: "Dubai",
                    emirate: "Dubai",
                    country: "AE",
                  },
                });
              }}
              disabled={createOrderMutation.isPending}
              className="rounded-lg bg-blue-600 p-4 disabled:opacity-50"
            >
              <Text className="text-center font-semibold text-white">
                {createOrderMutation.isPending
                  ? "Placing Order..."
                  : "Checkout"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
