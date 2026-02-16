import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { trpc } from "~/utils/api";

export default function SupportScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("GENERAL_INQUIRY");

  const CATEGORIES = [
    { value: "GENERAL_INQUIRY", label: "General" },
    { value: "ORDER_ISSUE", label: "Order Issue" },
    { value: "DELIVERY_ISSUE", label: "Delivery" },
    { value: "PRODUCT_QUALITY", label: "Product" },
    { value: "PAYMENT_ISSUE", label: "Payment" },
    { value: "ACCOUNT_ISSUE", label: "Account" },
    { value: "RETURN_REQUEST", label: "Return" },
    { value: "OTHER", label: "Other" },
  ] as const;

  const ticketsQuery = useInfiniteQuery(
    trpc.support.listMine.infiniteQueryOptions(
      { limit: 20 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    ),
  );

  const createMutation = useMutation(
    trpc.support.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.support.listMine.queryKey(),
        });
        setShowCreate(false);
        setSubject("");
        setDescription("");
        setCategory("GENERAL_INQUIRY");
      },
      onError: (error) => {
        Alert.alert("Error", error.message);
      },
    }),
  );

  const tickets = ticketsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-AE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "OPEN":
        return { bg: "bg-blue-100", text: "text-blue-800" };
      case "IN_PROGRESS":
        return { bg: "bg-yellow-100", text: "text-yellow-800" };
      case "WAITING_ON_CUSTOMER":
        return { bg: "bg-orange-100", text: "text-orange-800" };
      case "RESOLVED":
        return { bg: "bg-green-100", text: "text-green-800" };
      case "CLOSED":
        return { bg: "bg-gray-100", text: "text-gray-800" };
      default:
        return { bg: "bg-gray-100", text: "text-gray-800" };
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "text-red-600";
      case "HIGH":
        return "text-orange-600";
      case "MEDIUM":
        return "text-yellow-600";
      case "LOW":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <SafeAreaView className="bg-background flex-1" edges={["bottom"]}>
      <Stack.Screen options={{ title: "Support" }} />

      <View className="flex-1 p-4">
        <Pressable
          onPress={() => setShowCreate(true)}
          className="mb-4 rounded-lg bg-blue-600 p-4"
        >
          <Text className="text-center font-semibold text-white">
            + New Ticket
          </Text>
        </Pressable>

        {ticketsQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#c03484" />
          </View>
        ) : tickets.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted-foreground text-lg">
              No support tickets
            </Text>
            <Text className="text-muted-foreground mt-1 text-center text-sm">
              Need help? Create a new ticket above.
            </Text>
          </View>
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={(item) => item.id}
            onEndReached={() => {
              if (ticketsQuery.hasNextPage) {
                void ticketsQuery.fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            renderItem={({ item }) => {
              const style = getStatusStyle(item.status);
              return (
                <Pressable
                  onPress={() =>
                    router.push(
                      `/(app)/support/${item.id}` as never,
                    )
                  }
                  className="mb-3 rounded-lg border border-gray-200 bg-white p-4"
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="text-foreground font-semibold">
                        {item.subject}
                      </Text>
                      <Text className="text-muted-foreground mt-1 text-xs">
                        {item.ticketRef}
                      </Text>
                    </View>
                    <View className={`rounded-full px-3 py-1 ${style.bg}`}>
                      <Text className={`text-xs font-medium ${style.text}`}>
                        {item.status.replace(/_/g, " ")}
                      </Text>
                    </View>
                  </View>

                  <View className="mt-2 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <View className="rounded-full bg-gray-100 px-2 py-0.5">
                        <Text className="text-xs text-gray-600">
                          {item.category}
                        </Text>
                      </View>
                      <Text
                        className={`text-xs font-medium ${getPriorityStyle(item.priority)}`}
                      >
                        {item.priority}
                      </Text>
                    </View>
                    <Text className="text-muted-foreground text-xs">
                      {formatDate(item.createdAt)}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
            ListFooterComponent={
              ticketsQuery.isFetchingNextPage ? (
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

      {/* Create Ticket Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/50">
          <View className="rounded-t-2xl bg-white p-6">
            <Text className="mb-4 text-xl font-bold">New Support Ticket</Text>

            {/* Category Selector */}
            <Text className="text-foreground mb-2 font-medium">Category</Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.value}
                  onPress={() => setCategory(cat.value)}
                  className={`rounded-full px-3 py-1.5 ${
                    category === cat.value
                      ? "bg-blue-600"
                      : "border border-gray-300"
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      category === cat.value ? "text-white" : "text-gray-700"
                    }`}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              placeholder="Subject"
              value={subject}
              onChangeText={setSubject}
              className="mb-4 rounded-lg border border-gray-300 p-4"
            />

            <TextInput
              placeholder="Describe your issue..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="mb-4 rounded-lg border border-gray-300 p-4"
              style={{ minHeight: 100 }}
            />

            <Pressable
              onPress={() => {
                if (!subject.trim()) {
                  Alert.alert("Error", "Subject is required");
                  return;
                }
                if (!description.trim()) {
                  Alert.alert("Error", "Description is required");
                  return;
                }
                createMutation.mutate({
                  category: category as "GENERAL_INQUIRY",
                  subject: subject.trim(),
                  description: description.trim(),
                  priority: "MEDIUM",
                });
              }}
              disabled={createMutation.isPending}
              className="rounded-lg bg-blue-600 p-4 disabled:opacity-50"
            >
              <Text className="text-center font-semibold text-white">
                {createMutation.isPending ? "Submitting..." : "Submit Ticket"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setShowCreate(false);
                setSubject("");
                setDescription("");
                setCategory("GENERAL_INQUIRY");
              }}
              className="mt-3 p-3"
            >
              <Text className="text-center text-gray-500">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
