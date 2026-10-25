import { router, Tabs } from "expo-router";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { ProductRow } from "@/components/product-row";
import { SearchBox } from "@/components/search-box";
import { Button, colors, EmptyState, ErrorState, Loading } from "@/components/ui";
import { useProducts } from "@/lib/queries";
import { useDebounced } from "@/lib/use-debounced";

const openProduct = (id: number | "new") =>
  router.push({ pathname: "/product/[id]", params: { id: String(id) } });

export default function ProductsScreen() {
  const [search, setSearch] = useState("");
  const products = useProducts(useDebounced(search));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Tabs.Screen
        options={{
          headerRight: () => (
            <Button title="+ New" variant="ghost" onPress={() => openProduct("new")} style={{ minHeight: 44 }} />
          ),
        }}
      />
      <SearchBox value={search} onChangeText={setSearch} placeholder="Search by name or barcode" />
      {products.isPending ? (
        <Loading />
      ) : products.isError ? (
        <ErrorState error={products.error} onRetry={() => products.refetch()} />
      ) : products.data.length === 0 ? (
        <EmptyState title={search ? "No matches" : "No products yet"}>
          <Button title="+ Add a product" onPress={() => openProduct("new")} />
        </EmptyState>
      ) : (
        <FlatList
          data={products.data}
          keyExtractor={(p) => String(p.id)}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={() => void products.refetch()} />}
          renderItem={({ item }) => <ProductRow product={item} onPress={() => openProduct(item.id)} />}
        />
      )}
    </View>
  );
}
