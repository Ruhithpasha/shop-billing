import type {
  AddImage,
  AddItem,
  BarcodeLookup,
  BillStatus,
  BillSummary,
  BillWithItems,
  MatchRequest,
  MatchResult,
  Product,
  ProductCreate,
  ProductImage,
  ProductUpdate,
} from "@shop/shared";
import { API_BASE_URL } from "@/config";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, `Can't reach the server at ${API_BASE_URL}`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

/** Full URL for an API path such as a photo's "/images/12". */
export const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

function nullOn404(e: unknown): null {
  if (e instanceof ApiError && e.status === 404) return null;
  throw e;
}

export const api = {
  // Products
  listProducts: (search?: string) =>
    request<Product[]>("GET", `/products${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  getProduct: (id: number) => request<Product>("GET", `/products/${id}`),
  /** Our product with this barcode, or null if we don't sell it yet. */
  findByBarcode: (code: string) =>
    request<Product>("GET", `/products/barcode/${encodeURIComponent(code)}`).catch(nullOn404),
  /** Name/image suggestion from public barcode databases, or null if unknown. */
  lookupBarcodeOnline: (code: string) =>
    request<BarcodeLookup>("GET", `/lookup/barcode/${encodeURIComponent(code)}`).catch(nullOn404),
  createProduct: (p: ProductCreate) => request<Product>("POST", "/products", p),
  updateProduct: (id: number, p: ProductUpdate) => request<Product>("PATCH", `/products/${id}`, p),
  deleteProduct: (id: number) => request<{ ok: true }>("DELETE", `/products/${id}`),

  // Product photos (feed the image matcher)
  listImages: (productId: number) => request<ProductImage[]>("GET", `/products/${productId}/images`),
  addImage: (productId: number, body: AddImage) =>
    request<ProductImage>("POST", `/products/${productId}/images`, body),
  deleteImage: (productId: number, imageId: number) =>
    request<{ ok: true }>("DELETE", `/products/${productId}/images/${imageId}`),

  /** Products whose photos look most like this embedding, best first. */
  match: (body: MatchRequest) => request<MatchResult[]>("POST", "/match", body),

  // Bills
  createBill: () => request<BillWithItems>("POST", "/bills"),
  listBills: (status?: BillStatus) => request<BillSummary[]>("GET", `/bills${status ? `?status=${status}` : ""}`),
  getBill: (id: number) => request<BillWithItems>("GET", `/bills/${id}`),
  addItem: (billId: number, item: AddItem) => request<BillWithItems>("POST", `/bills/${billId}/items`, item),
  setItemQty: (billId: number, itemId: number, qty: number) =>
    request<BillWithItems>("PATCH", `/bills/${billId}/items/${itemId}`, { qty }),
  deleteItem: (billId: number, itemId: number) =>
    request<BillWithItems>("DELETE", `/bills/${billId}/items/${itemId}`),
  hold: (id: number) => request<BillWithItems>("POST", `/bills/${id}/hold`),
  resume: (id: number) => request<BillWithItems>("POST", `/bills/${id}/resume`),
  pay: (id: number) => request<BillWithItems>("POST", `/bills/${id}/pay`),
  merge: (targetId: number, sourceId: number) =>
    request<BillWithItems>("POST", `/bills/${targetId}/merge/${sourceId}`),
};
