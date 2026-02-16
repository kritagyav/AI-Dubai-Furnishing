import { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";

import { trpc } from "~/utils/api";

const CATEGORIES = [
  "All",
  "SOFA",
  "BED",
  "TABLE",
  "CHAIR",
  "WARDROBE",
  "DESK",
  "SHELF",
  "LIGHTING",
  "RUG",
  "DECOR",
] as const;

const screenWidth = Dimensions.get("window").width;
const COLUMN_GAP = 12;
const PADDING = 16;
const NUM_COLUMNS = 2;
const CARD_WIDTH =
  (screenWidth - PADDING * 2 - COLUMN_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export default function GalleryScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchText, setSearchText] = useState("");

  const productsQuery = useInfiniteQuery(
    trpc.catalog.browseProducts.infiniteQueryOptions(
      {
        limit: 20,
        category: selectedCategory === "All" ? undefined : selectedCategory,
        search: searchText.trim() || undefined,
      },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    ),
  );

  const products =
    productsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const formatPrice = (fils: number) => {
    return `AED ${(fils / 100).toFixed(2)}`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "SOFA":
        return "Sofa";
      case "BED":
        return "Bed";
      case "TABLE":
        return "Table";
      case "CHAIR":
        return "Chair";
      case "WARDROBE":
        return "Wardrobe";
      case "DESK":
        return "Desk";
      case "SHELF":
        return "Shelf";
      case "LIGHTING":
        return "Light";
      case "RUG":
        return "Rug";
      case "DECOR":
        return "Decor";
      default:
        return "Item";
    }
  };

  return (
    <SafeAreaView className="bg-background flex-1" edges={["bottom"]}>
      <Stack.Screen options={{ title: "Browse Products" }} />

      <View className="flex-1">
        {/* Search Bar */}
        <View className="px-4 pt-4">
          <TextInput
            placeholder="Search products..."
            value={searchText}
            onChangeText={setSearchText}
            className="rounded-lg border border-gray-300 bg-white p-3"
            returnKeyType="search"
          />
        </View>

        {/* Category Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-4 py-3"
          contentContainerStyle={{ gap: 8 }}
        >
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              className={`rounded-full px-4 py-2 ${
                selectedCategory === cat
                  ? "bg-blue-600"
                  : "border border-gray-300 bg-white"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  selectedCategory === cat ? "text-white" : "text-gray-700"
                }`}
              >
                {cat === "All"
                  ? "All"
                  : cat.charAt(0) + cat.slice(1).toLowerCase()}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Product Grid */}
        {productsQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#c03484" />
          </View>
        ) : products.length === 0 ? (
          <View className="flex-1 items-center justify-center p-4">
            <Text className="text-muted-foreground text-lg">
              No products found
            </Text>
          </View>
        ) : (
          <FlatList
            data={products}
            keyExtractor={(item) => item.id}
            numColumns={NUM_COLUMNS}
            contentContainerStyle={{ padding: PADDING }}
            columnWrapperStyle={{ gap: COLUMN_GAP }}
            ItemSeparatorComponent={() => (
              <View style={{ height: COLUMN_GAP }} />
            )}
            onEndReached={() => {
              if (productsQuery.hasNextPage) {
                void productsQuery.fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            renderItem={({ item }) => (
              <View
                style={{ width: CARD_WIDTH }}
                className="overflow-hidden rounded-lg border border-gray-200 bg-white"
              >
                {/* Product Image Placeholder */}
                <View className="items-center justify-center bg-gray-100 p-6">
                  <Text className="text-foreground text-sm font-medium">
                    {getCategoryIcon(String(item.category))}
                  </Text>
                </View>

                <View className="p-3">
                  <Text
                    className="text-foreground text-sm font-medium"
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>
                  <Text className="mt-1 text-xs text-gray-500">
                    {item.retailer.companyName}
                  </Text>
                  <Text className="text-primary mt-2 text-sm font-bold">
                    {formatPrice(item.priceFils)}
                  </Text>
                  <View className="mt-1 self-start rounded-full bg-gray-100 px-2 py-0.5">
                    <Text className="text-xs text-gray-600">
                      {String(item.category).charAt(0) +
                        String(item.category).slice(1).toLowerCase()}
                    </Text>
                  </View>
                </View>
              </View>
            )}
            ListFooterComponent={
              productsQuery.isFetchingNextPage ? (
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
