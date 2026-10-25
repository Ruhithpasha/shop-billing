import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BillStatus, BillWithItems } from "@shop/shared";
import { api } from "./api";

export const keys = {
  products: (search = "") => ["products", search] as const,
  product: (id: number) => ["product", id] as const,
  images: (productId: number) => ["product", productId, "images"] as const,
  bill: (id: number) => ["bill", id] as const,
  bills: (status?: BillStatus) => ["bills", status ?? "all"] as const,
};

export const useProducts = (search = "") =>
  useQuery({ queryKey: keys.products(search.trim()), queryFn: () => api.listProducts(search.trim()) });

export const useProduct = (id: number | null) =>
  useQuery({ queryKey: keys.product(id ?? 0), queryFn: () => api.getProduct(id!), enabled: id != null });

export const useProductImages = (productId: number | null) =>
  useQuery({
    queryKey: keys.images(productId ?? 0),
    queryFn: () => api.listImages(productId!),
    enabled: productId != null,
  });

export const useBill = (id: number | null) =>
  useQuery({ queryKey: keys.bill(id ?? 0), queryFn: () => api.getBill(id!), enabled: id != null });

export const useBills = (status?: BillStatus) =>
  useQuery({ queryKey: keys.bills(status), queryFn: () => api.listBills(status) });

/** Store a bill returned by the API and refresh every bill list. */
export function useStoreBill() {
  const qc = useQueryClient();
  return (bill: BillWithItems) => {
    qc.setQueryData(keys.bill(bill.id), bill);
    qc.invalidateQueries({ queryKey: ["bills"] });
  };
}

/** Mutation for any endpoint that returns a full bill. */
export function useBillMutation<V>(fn: (vars: V) => Promise<BillWithItems>) {
  const storeBill = useStoreBill();
  return useMutation({ mutationFn: fn, onSuccess: storeBill });
}

export function useInvalidateProducts() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["product"] });
  };
}
