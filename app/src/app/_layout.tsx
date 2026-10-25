import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { colors } from "@/components/ui";
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
            <Stack.Screen name="product/[id]" options={{ title: "Product" }} />
            <Stack.Screen name="bill/[id]" options={{ title: "Bill" }} />
          </Stack>
        </CurrentBillProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
