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

export default function ProjectsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");

  const projectsQuery = useInfiniteQuery(
    trpc.room.listProjects.infiniteQueryOptions(
      { limit: 20 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    ),
  );

  const createMutation = useMutation(
    trpc.room.createProject.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.room.listProjects.queryKey(),
        });
        setShowCreate(false);
        setNewName("");
        setNewAddress("");
      },
      onError: (error) => {
        Alert.alert("Error", error.message);
      },
    }),
  );

  const projects = projectsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-AE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <SafeAreaView className="bg-background flex-1" edges={["bottom"]}>
      <Stack.Screen options={{ title: "My Projects" }} />

      <View className="flex-1 p-4">
        <Pressable
          onPress={() => setShowCreate(true)}
          className="mb-4 rounded-lg bg-blue-600 p-4"
        >
          <Text className="text-center font-semibold text-white">
            + New Project
          </Text>
        </Pressable>

        {projectsQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#c03484" />
          </View>
        ) : projects.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted-foreground text-lg">
              No projects yet. Create your first one!
            </Text>
          </View>
        ) : (
          <FlatList
            data={projects}
            keyExtractor={(item) => item.id}
            onEndReached={() => {
              if (projectsQuery.hasNextPage) {
                void projectsQuery.fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  router.push(`/(app)/projects/${item.id}` as never)
                }
                className="mb-3 rounded-lg border border-gray-200 bg-white p-4"
              >
                <Text className="text-foreground text-lg font-semibold">
                  {item.name}
                </Text>
                {item.address ? (
                  <Text className="text-muted-foreground mt-1 text-sm">
                    {item.address}
                  </Text>
                ) : null}
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-muted-foreground text-sm">
                    {item._count.rooms}{" "}
                    {item._count.rooms === 1 ? "room" : "rooms"}
                  </Text>
                  <Text className="text-muted-foreground text-sm">
                    {formatDate(item.updatedAt)}
                  </Text>
                </View>
              </Pressable>
            )}
            ListFooterComponent={
              projectsQuery.isFetchingNextPage ? (
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

      {/* Create Project Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/50">
          <View className="rounded-t-2xl bg-white p-6">
            <Text className="mb-4 text-xl font-bold">New Project</Text>

            <TextInput
              placeholder="Project Name"
              value={newName}
              onChangeText={setNewName}
              className="mb-4 rounded-lg border border-gray-300 p-4"
            />

            <TextInput
              placeholder="Address (optional)"
              value={newAddress}
              onChangeText={setNewAddress}
              className="mb-4 rounded-lg border border-gray-300 p-4"
            />

            <Pressable
              onPress={() => {
                if (!newName.trim()) {
                  Alert.alert("Error", "Project name is required");
                  return;
                }
                createMutation.mutate({
                  name: newName.trim(),
                  address: newAddress.trim() || undefined,
                });
              }}
              disabled={createMutation.isPending}
              className="rounded-lg bg-blue-600 p-4 disabled:opacity-50"
            >
              <Text className="text-center font-semibold text-white">
                {createMutation.isPending ? "Creating..." : "Create Project"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setShowCreate(false);
                setNewName("");
                setNewAddress("");
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
