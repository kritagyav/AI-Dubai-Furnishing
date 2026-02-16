import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { trpc } from "~/utils/api";

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const projectQuery = useQuery(
    trpc.room.getProject.queryOptions({ projectId: id }),
  );

  const packagesQuery = useQuery(
    trpc.package.list.queryOptions({ projectId: id, limit: 10 }),
  );

  const generateMutation = useMutation(
    trpc.package.generate.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.package.list.queryKey(),
        });
      },
    }),
  );

  if (projectQuery.isLoading) {
    return (
      <SafeAreaView className="bg-background flex-1" edges={["bottom"]}>
        <Stack.Screen options={{ title: "Project" }} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#c03484" />
        </View>
      </SafeAreaView>
    );
  }

  if (projectQuery.error || !projectQuery.data) {
    return (
      <SafeAreaView className="bg-background flex-1" edges={["bottom"]}>
        <Stack.Screen options={{ title: "Project" }} />
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-red-600">
            {projectQuery.error?.message ?? "Project not found"}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const project = projectQuery.data;
  const packages = packagesQuery.data?.items ?? [];

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
      case "GENERATING":
        return { bg: "bg-yellow-100", text: "text-yellow-800" };
      case "READY":
        return { bg: "bg-green-100", text: "text-green-800" };
      case "ACCEPTED":
        return { bg: "bg-blue-100", text: "text-blue-800" };
      case "REJECTED":
        return { bg: "bg-red-100", text: "text-red-800" };
      default:
        return { bg: "bg-gray-100", text: "text-gray-800" };
    }
  };

  return (
    <SafeAreaView className="bg-background flex-1" edges={["bottom"]}>
      <Stack.Screen options={{ title: project.name }} />

      <ScrollView className="flex-1 p-4">
        {/* Project Info */}
        <View className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
          <Text className="text-foreground text-2xl font-bold">
            {project.name}
          </Text>
          {project.address ? (
            <Text className="text-muted-foreground mt-1">{project.address}</Text>
          ) : null}
          <Text className="text-muted-foreground mt-2 text-sm">
            Created {formatDate(project.createdAt)}
          </Text>
        </View>

        {/* Rooms Section */}
        <View className="mb-4">
          <Text className="text-foreground mb-3 text-lg font-semibold">
            Rooms ({project.rooms.length})
          </Text>

          {project.rooms.length === 0 ? (
            <View className="rounded-lg border border-dashed border-gray-300 p-6">
              <Text className="text-muted-foreground text-center">
                No rooms added yet
              </Text>
            </View>
          ) : (
            project.rooms.map((room) => (
              <View
                key={room.id}
                className="mb-2 rounded-lg border border-gray-200 bg-white p-4"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-foreground font-semibold">
                    {room.name}
                  </Text>
                  {room.type ? (
                    <View className="rounded-full bg-gray-100 px-3 py-1">
                      <Text className="text-xs text-gray-600">
                        {room.type.replace(/_/g, " ")}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {room.widthCm && room.lengthCm ? (
                  <Text className="text-muted-foreground mt-1 text-sm">
                    {room.widthCm} x {room.lengthCm} cm
                    {room.heightCm ? ` x ${room.heightCm} cm` : ""}
                  </Text>
                ) : null}
                <Text className="text-muted-foreground mt-1 text-xs">
                  {room._count.photos}{" "}
                  {room._count.photos === 1 ? "photo" : "photos"}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Generate AI Package */}
        <Pressable
          onPress={() =>
            generateMutation.mutate({
              projectId: id,
            })
          }
          disabled={generateMutation.isPending}
          className="mb-4 rounded-lg bg-purple-600 p-4 disabled:opacity-50"
        >
          <Text className="text-center font-semibold text-white">
            {generateMutation.isPending
              ? "Generating..."
              : "Generate AI Package"}
          </Text>
        </Pressable>

        {generateMutation.isSuccess ? (
          <View className="mb-4 rounded-lg bg-green-50 p-3">
            <Text className="text-center text-green-700">
              Package generation started! It will appear below when ready.
            </Text>
          </View>
        ) : null}

        {/* Packages Section */}
        <View className="mb-8">
          <Text className="text-foreground mb-3 text-lg font-semibold">
            Packages
          </Text>

          {packagesQuery.isLoading ? (
            <ActivityIndicator size="small" color="#c03484" />
          ) : packages.length === 0 ? (
            <View className="rounded-lg border border-dashed border-gray-300 p-6">
              <Text className="text-muted-foreground text-center">
                No packages generated yet
              </Text>
            </View>
          ) : (
            packages.map((pkg) => {
              const style = getStatusStyle(pkg.status);
              return (
                <View
                  key={pkg.id}
                  className="mb-2 rounded-lg border border-gray-200 bg-white p-4"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-foreground flex-1 font-semibold">
                      {pkg.name}
                    </Text>
                    <View className={`rounded-full px-3 py-1 ${style.bg}`}>
                      <Text className={`text-xs font-medium ${style.text}`}>
                        {pkg.status}
                      </Text>
                    </View>
                  </View>
                  {pkg.totalPriceFils ? (
                    <Text className="text-foreground mt-2 font-medium">
                      {formatPrice(pkg.totalPriceFils)}
                    </Text>
                  ) : null}
                  <Text className="text-muted-foreground mt-1 text-sm">
                    {pkg._count.items} items | {formatDate(pkg.createdAt)}
                  </Text>
                  {pkg.styleTag ? (
                    <Text className="text-muted-foreground mt-1 text-xs">
                      Style: {pkg.styleTag}
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
