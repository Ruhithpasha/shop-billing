import { router } from "expo-router";
import { FlatList, RefreshControl, View } from "react-native";
import { BillSummaryRow } from "@/components/bill-summary-row";
import { colors, EmptyState, ErrorState, Loading } from "@/components/ui";
import { useBills } from "@/lib/queries";

export default function HistoryScreen() {
  const paid = useBills("paid");

  if (paid.isPending) return <Loading />;
  if (paid.isError) return <ErrorState error={paid.error} onRetry={() => paid.refetch()} />;
  if (paid.data.length === 0) return <EmptyState title="No paid bills yet" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={paid.data}
        keyExtractor={(b) => String(b.id)}
        contentContainerStyle={{ paddingBottom: 12 }}
        refreshControl={<RefreshControl refreshing={paid.isRefetching} onRefresh={() => void paid.refetch()} />}
        renderItem={({ item }) => (
          <BillSummaryRow
            bill={item}
            onPress={() => router.push({ pathname: "/bill/[id]", params: { id: String(item.id) } })}
          />
        )}
      />
    </View>
  );
}
