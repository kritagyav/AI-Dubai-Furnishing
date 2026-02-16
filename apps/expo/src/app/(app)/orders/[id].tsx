import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { trpc } from "~/utils/api";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const orderQuery = useQuery(
    trpc.commerce.getOrder.queryOptions({ orderId: id }),
  );

  const deliveryQuery = useQuery(
    trpc.delivery.getByOrder.queryOptions({ orderId: id }),
  );

  if (orderQuery.isLoading) {
    return (
      <SafeAreaView className="bg-background flex-1" edges={["bottom"]}>
        <Stack.Screen options={{ title: "Order" }} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#c03484" />
        </View>
      </SafeAreaView>
    );
  }

  if (orderQuery.error || !orderQuery.data) {
    return (
      <SafeAreaView className="bg-background flex-1" edges={["bottom"]}>
        <Stack.Screen options={{ title: "Order" }} />
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-red-600">
            {orderQuery.error?.message ?? "Order not found"}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const order = orderQuery.data;
  const deliveries = deliveryQuery.data ?? [];

  const formatPrice = (fils: number) => {
    return `AED ${(fils / 100).toFixed(2)}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-AE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

  const statusStyle = getStatusStyle(String(order.status));
  const shippingAddress = order.shippingAddress as Record<
    string,
    string
  > | null;

  return (
    <SafeAreaView className="bg-background flex-1" edges={["bottom"]}>
      <Stack.Screen options={{ title: order.orderRef }} />

      <ScrollView className="flex-1 p-4">
        {/* Order Header */}
        <View className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-foreground text-xl font-bold">
              {order.orderRef}
            </Text>
            <View className={`rounded-full px-3 py-1 ${statusStyle.bg}`}>
              <Text className={`text-sm font-medium ${statusStyle.text}`}>
                {statusStyle.label}
              </Text>
            </View>
          </View>
          <Text className="text-muted-foreground mt-2 text-sm">
            Placed {formatDate(order.createdAt)}
          </Text>
          {order.paidAt ? (
            <Text className="text-muted-foreground mt-1 text-sm">
              Paid {formatDate(order.paidAt)}
            </Text>
          ) : null}
        </View>

        {/* Line Items */}
        <View className="mb-4">
          <Text className="text-foreground mb-3 text-lg font-semibold">
            Items
          </Text>
          {order.lineItems.map((item) => (
            <View
              key={item.id}
              className="mb-2 rounded-lg border border-gray-200 bg-white p-4"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="text-foreground font-semibold">
                    {item.productName}
                  </Text>
                  <Text className="text-muted-foreground mt-1 text-sm">
                    SKU: {item.sku}
                  </Text>
                  <Text className="text-muted-foreground text-sm">
                    {item.quantity} x {formatPrice(item.unitPriceFils)}
                  </Text>
                </View>
                <Text className="text-foreground font-bold">
                  {formatPrice(item.totalFils)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Price Summary */}
        <View className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
          <View className="flex-row justify-between">
            <Text className="text-muted-foreground">Subtotal</Text>
            <Text className="text-foreground">
              {formatPrice(order.subtotalFils)}
            </Text>
          </View>
          <View className="mt-2 flex-row justify-between">
            <Text className="text-muted-foreground">Delivery Fee</Text>
            <Text className="text-foreground">
              {formatPrice(order.deliveryFeeFils)}
            </Text>
          </View>
          <View className="mt-3 border-t border-gray-200 pt-3">
            <View className="flex-row justify-between">
              <Text className="text-foreground text-lg font-bold">Total</Text>
              <Text className="text-foreground text-lg font-bold">
                {formatPrice(order.totalFils)}
              </Text>
            </View>
          </View>
        </View>

        {/* Shipping Address */}
        {shippingAddress ? (
          <View className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
            <Text className="text-foreground mb-2 font-semibold">
              Shipping Address
            </Text>
            <Text className="text-muted-foreground">
              {shippingAddress.street}
            </Text>
            <Text className="text-muted-foreground">
              {shippingAddress.city}
              {shippingAddress.emirate ? `, ${shippingAddress.emirate}` : ""}
            </Text>
            <Text className="text-muted-foreground">
              {shippingAddress.country}
            </Text>
          </View>
        ) : null}

        {/* Delivery Info */}
        {deliveries.length > 0 ? (
          <View className="mb-4">
            <Text className="text-foreground mb-3 text-lg font-semibold">
              Delivery
            </Text>
            {deliveries.map((delivery) => (
              <View
                key={delivery.id}
                className="mb-2 rounded-lg border border-gray-200 bg-white p-4"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-foreground font-semibold">
                    {delivery.scheduledSlot}
                  </Text>
                  <View className="rounded-full bg-blue-100 px-3 py-1">
                    <Text className="text-xs font-medium text-blue-800">
                      {delivery.status}
                    </Text>
                  </View>
                </View>
                <Text className="text-muted-foreground mt-1 text-sm">
                  Scheduled: {formatDate(delivery.scheduledDate)}
                </Text>
                {delivery.driverName ? (
                  <Text className="text-muted-foreground mt-1 text-sm">
                    Driver: {delivery.driverName}
                    {delivery.driverPhone ? ` (${delivery.driverPhone})` : ""}
                  </Text>
                ) : null}
                {delivery.trackingUrl ? (
                  <Pressable
                    onPress={() =>
                      void Linking.openURL(delivery.trackingUrl ?? "")
                    }
                    className="mt-3 rounded-lg bg-blue-600 p-3"
                  >
                    <Text className="text-center font-semibold text-white">
                      Track Delivery
                    </Text>
                  </Pressable>
                ) : null}
                {delivery.deliveredAt ? (
                  <Text className="mt-2 text-sm text-green-700">
                    Delivered: {formatDate(delivery.deliveredAt)}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Payment Info */}
        {order.payments.length > 0 ? (
          <View className="mb-8">
            <Text className="text-foreground mb-3 text-lg font-semibold">
              Payments
            </Text>
            {order.payments.map((payment) => (
              <View
                key={payment.id}
                className="mb-2 rounded-lg border border-gray-200 bg-white p-4"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-foreground font-semibold">
                    {payment.method}
                  </Text>
                  <Text className="text-foreground font-bold">
                    {formatPrice(payment.amountFils)}
                  </Text>
                </View>
                <Text className="text-muted-foreground mt-1 text-sm">
                  Status: {payment.status}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {order.notes ? (
          <View className="mb-8 rounded-lg border border-gray-200 bg-white p-4">
            <Text className="text-foreground mb-1 font-semibold">Notes</Text>
            <Text className="text-muted-foreground">{order.notes}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
