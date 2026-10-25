import { router } from "expo-router";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import type { BillSummary } from "@shop/shared";
import { BillSummaryRow } from "@/components/bill-summary-row";
import { Button, colors, EmptyState, ErrorState, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { useCurrentBill } from "@/lib/current-bill";
import { confirm, errorMessage, notify } from "@/lib/dialogs";
import { useBill, useBills, useStoreBill } from "@/lib/queries";

export default function HeldBillsScreen() {
  const held = useBills("held");
  const { billId, setBillId, ensureBill } = useCurrentBill();
  const current = useBill(billId);
  const storeBill = useStoreBill();
  const [busyId, setBusyId] = useState<number | null>(null);

  const withBusy = async (id: number, fn: () => Promise<void>) => {
    setBusyId(id);
    try {
      await fn();
    } catch (e) {
      notify("Something went wrong", errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const resume = (bill: BillSummary) =>
    withBusy(bill.id, async () => {
      // Don't lose the bill on the counter: hold it first if it has items.
      const currentItems = current.data?.items.length ?? 0;
      if (billId != null && currentItems > 0) {
        const ok = await confirm(
          "Resume bill",
          `The current bill #${billId} has ${currentItems} item(s). Hold it and resume bill #${bill.id}?`,
          "Hold & resume",
        );
        if (!ok) return;
        storeBill(await api.hold(billId));
      }
      storeBill(await api.resume(bill.id));
      setBillId(bill.id);
      router.navigate("/bill");
    });

  const mergeIntoCurrent = (bill: BillSummary) =>
    withBusy(bill.id, async () => {
      const target = await ensureBill();
      storeBill(await api.merge(target, bill.id));
      router.navigate("/bill");
    });

  if (held.isPending) return <Loading />;
  if (held.isError) return <ErrorState error={held.error} onRetry={() => held.refetch()} />;
  if (held.data.length === 0) {
    return <EmptyState title="No held bills" hint="Use Hold on the current bill to park it here." />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={held.data}
        keyExtractor={(b) => String(b.id)}
        contentContainerStyle={{ paddingBottom: 12 }}
        refreshControl={<RefreshControl refreshing={held.isRefetching} onRefresh={() => void held.refetch()} />}
        renderItem={({ item }) => (
          <BillSummaryRow bill={item} onPress={() => resume(item)}>
            <Button
              title="Resume"
              onPress={() => resume(item)}
              loading={busyId === item.id}
              disabled={busyId != null}
              style={{ flex: 1 }}
            />
            <Button
              title="Merge into current"
              variant="secondary"
              onPress={() => mergeIntoCurrent(item)}
              disabled={busyId != null}
              style={{ flex: 1.4 }}
            />
          </BillSummaryRow>
        )}
      />
    </View>
  );
}
