import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Button, colors } from "@/components/ui";
import { CurrentBillProvider } from "@/lib/current-bill";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10_000 },
  },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <CurrentBillProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.card },
              headerTitleStyle: { fontSize: 20, fontWeight: "700" },
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="add-item" options={{ title: "Add item", presentation: "modal" }} />
            <Stack.Screen name="merge" options={{ title: "Merge a bill in", presentation: "modal" }} />
            <Stack.Screen name="scan-barcode" options={{ title: "Scan barcode" }} />
            <Stack.Screen name="product-photos/[id]" options={{ title: "Photos" }} />
            <Stack.Screen name="product/[id]" options={{ title: "Product" }} />
            <Stack.Screen name="bills/[id]" options={{ title: "Bill" }} />
          </Stack>
        </CurrentBillProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/** Shown instead of closing the app if a screen throws while rendering. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 64, gap: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>Something went wrong</Text>
      <ScrollView style={{ maxHeight: 240 }}>
        <Text selectable style={{ fontSize: 15, color: colors.danger }}>
          {error.message}
        </Text>
      </ScrollView>
      <Button title="Try again" onPress={retry} />
    </View>
  );
}
