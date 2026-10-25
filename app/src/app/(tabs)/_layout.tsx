import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/components/ui";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue | null; size: number }) => (
    <MaterialCommunityIcons name={name} color={(color ?? undefined) as string | undefined} size={size} />
  );

export default function TabsLayout() {
  // Android draws edge-to-edge, so leave room for the gesture/navigation bar.
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 13, fontWeight: "600" },
        tabBarStyle: { height: 64 + bottom, paddingTop: 6, paddingBottom: 6 + bottom },
        headerTitleStyle: { fontSize: 20, fontWeight: "700" },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Scan", tabBarIcon: icon("barcode-scan") }} />
      <Tabs.Screen name="bill" options={{ title: "Current bill", tabBarLabel: "Bill", tabBarIcon: icon("receipt") }} />
      <Tabs.Screen name="held" options={{ title: "Held bills", tabBarLabel: "Held", tabBarIcon: icon("pause-circle-outline") }} />
      <Tabs.Screen name="products" options={{ title: "Products", tabBarIcon: icon("package-variant-closed") }} />
      <Tabs.Screen name="history" options={{ title: "Bill history", tabBarLabel: "History", tabBarIcon: icon("history") }} />
    </Tabs>
  );
}
