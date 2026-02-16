import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { trpc } from "~/utils/api";

export default function SupportTicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  const ticketQuery = useQuery(
    trpc.support.get.queryOptions({ ticketId: id }),
  );

  const addMessageMutation = useMutation(
    trpc.support.addMessage.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.support.get.queryKey(),
        });
        setMessage("");
      },
      onError: (error) => {
        Alert.alert("Error", error.message);
      },
    }),
  );

  if (ticketQuery.isLoading) {
    return (
      <SafeAreaView className="bg-background flex-1" edges={["bottom"]}>
        <Stack.Screen options={{ title: "Ticket" }} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#c03484" />
        </View>
      </SafeAreaView>
    );
  }

  if (ticketQuery.error || !ticketQuery.data) {
    return (
      <SafeAreaView className="bg-background flex-1" edges={["bottom"]}>
        <Stack.Screen options={{ title: "Ticket" }} />
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-red-600">
            {ticketQuery.error?.message ?? "Ticket not found"}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const ticket = ticketQuery.data;
  const isClosed = ticket.status === "CLOSED";

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-AE", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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

  const statusStyle = getStatusStyle(ticket.status);

  return (
    <SafeAreaView className="bg-background flex-1" edges={["bottom"]}>
      <Stack.Screen options={{ title: ticket.ticketRef }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Ticket Header */}
        <View className="border-b border-gray-200 bg-white p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-foreground flex-1 text-lg font-bold">
              {ticket.subject}
            </Text>
            <View className={`ml-2 rounded-full px-3 py-1 ${statusStyle.bg}`}>
              <Text className={`text-xs font-medium ${statusStyle.text}`}>
                {ticket.status.replace(/_/g, " ")}
              </Text>
            </View>
          </View>
          <Text className="text-muted-foreground mt-1 text-sm">
            {ticket.category} | {ticket.priority}
          </Text>
        </View>

        {/* Messages */}
        <FlatList
          data={[
            // Initial description as first "message"
            {
              id: "description",
              body: ticket.description,
              senderRole: "customer" as const,
              createdAt: ticket.createdAt,
            },
            ...ticket.messages,
          ]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const isCustomer = item.senderRole === "customer";
            return (
              <View
                className={`mb-3 max-w-[85%] rounded-lg p-3 ${
                  isCustomer
                    ? "self-end bg-blue-600"
                    : "self-start bg-gray-200"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    isCustomer ? "text-blue-100" : "text-gray-500"
                  }`}
                >
                  {isCustomer ? "You" : "Support"}
                </Text>
                <Text
                  className={`mt-1 ${
                    isCustomer ? "text-white" : "text-foreground"
                  }`}
                >
                  {item.body}
                </Text>
                <Text
                  className={`mt-1 text-right text-xs ${
                    isCustomer ? "text-blue-200" : "text-gray-400"
                  }`}
                >
                  {formatDate(item.createdAt)}
                </Text>
              </View>
            );
          }}
        />

        {/* Message Input */}
        {isClosed ? (
          <View className="border-t border-gray-200 bg-gray-50 p-4">
            <Text className="text-center text-gray-500">
              This ticket is closed
            </Text>
          </View>
        ) : (
          <View className="flex-row items-end gap-2 border-t border-gray-200 bg-white p-4">
            <TextInput
              placeholder="Type a message..."
              value={message}
              onChangeText={setMessage}
              multiline
              className="max-h-24 flex-1 rounded-lg border border-gray-300 p-3"
            />
            <Pressable
              onPress={() => {
                if (!message.trim()) return;
                addMessageMutation.mutate({
                  ticketId: id,
                  body: message.trim(),
                });
              }}
              disabled={addMessageMutation.isPending || !message.trim()}
              className="rounded-lg bg-blue-600 px-4 py-3 disabled:opacity-50"
            >
              <Text className="font-semibold text-white">
                {addMessageMutation.isPending ? "..." : "Send"}
              </Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
