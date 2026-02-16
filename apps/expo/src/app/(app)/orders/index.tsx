import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";

import { trpc } from "~/utils/api";

export default function OrdersScreen() {
  const router = useRouter();

  const ordersQuery = useInfiniteQuery(
    trpc.commerce.listOrders.infiniteQueryOptions(
      { limit: 20 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    ),
  );

  const orders = ordersQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-AE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatPrice = (fils: number) => {
    return `AED ${(fils / 100).toFixed(2)}`;
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "PENDING_PAYMENT":
        return {
          bg: "bg-yellow-100",
          text: "text-yellow-800",
          label: "Pending Payment",
        };
      case "PAID":
        return { bg: "bg-green-100", text: "text-green-800", label: "Paid" };
      case "PROCESSING":
        return {
          bg: "bg-blue-100",
          text: "text-blue-800",
          label: "Processing",
        };
      case "SHIPPED":
        return {
          bg: "bg-indigo-100",
          text: "text-indigo-800",
          label: "Shipped",
        };
      case "DELIVERED":
        return {
          bg: "bg-green-100",
          text: "text-green-800",
          label: "Delivered",
        };
      case "CANCELLED":
        return { bg: "bg-red-100", text: "text-red-800", label: "Cancelled" };
      case "REFUNDED":
        return { bg: "bg-gray-100", text: "text-gray-800", label: "Refunded" };
      default:
        return { bg: "bg-gray-100", text: "text-gray-800", label: status };
    }
  };

  return (
    <SafeAreaView className="bg-background flex-1" edges={["bottom"]}>
      <Stack.Screen options={{ title: "My Orders" }} />

      <View className="flex-1">
        {ordersQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#c03484" />
          </View>
        ) : orders.length === 0 ? (
          <View className="flex-1 items-center justify-center p-4">
            <Text className="text-muted-foreground mb-2 text-lg">
              No orders yet
            </Text>
            <Text className="text-muted-foreground text-center text-sm">
              Your orders will appear here after checkout
            </Text>
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
            onEndReached={() => {
              if (ordersQuery.hasNextPage) {
                void ordersQuery.fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            renderItem={({ item }) => {
              const style = getStatusStyle(String(item.status));
              return (
                <Pressable
                  onPress={() =>
                    router.push(`/(app)/orders/${item.id}` as never)
                  }
                  className="mb-3 rounded-lg border border-gray-200 bg-white p-4"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-foreground font-semibold">
                      {item.orderRef}
                    </Text>
                    <View className={`rounded-full px-3 py-1 ${style.bg}`}>
                      <Text className={`text-xs font-medium ${style.text}`}>
                        {style.label}
                      </Text>
                    </View>
                  </View>

                  <View className="mt-2 flex-row items-center justify-between">
                    <Text className="text-muted-foreground text-sm">
                      {item._count.lineItems}{" "}
                      {item._count.lineItems === 1 ? "item" : "items"}
                    </Text>
                    <Text className="text-foreground font-bold">
                      {formatPrice(item.totalFils)}
                    </Text>
                  </View>

                  <Text className="text-muted-foreground mt-2 text-xs">
                    {formatDate(item.createdAt)}
                  </Text>
                </Pressable>
              );
            }}
            ListFooterComponent={
              ordersQuery.isFetchingNextPage ? (
                <ActivityIndicator
                  size="small"
                  color="#c03484"
                  className="py-4"
                />
              ) : null
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
