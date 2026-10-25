import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";
import { useStoreBill } from "./queries";

const STORAGE_KEY = "currentBillId";

interface CurrentBill {
  /** The bill being rung up at the counter, or null when there isn't one yet. */
  billId: number | null;
  ready: boolean;
  setBillId: (id: number | null) => void;
  /** Returns the current bill id, creating a new open bill first if needed. */
  ensureBill: () => Promise<number>;
}

const Ctx = createContext<CurrentBill | null>(null);

export function CurrentBillProvider({ children }: { children: ReactNode }) {
  const [billId, setBillIdState] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const storeBill = useStoreBill();
  const creating = useRef<Promise<number> | null>(null);

  const setBillId = useCallback((id: number | null) => {
    setBillIdState(id);
    const write = id == null ? AsyncStorage.removeItem(STORAGE_KEY) : AsyncStorage.setItem(STORAGE_KEY, String(id));
    write.catch(() => {});
  }, []);

  // Restore the last current bill, dropping it if it was paid/held/merged meanwhile.
  useEffect(() => {
    (async () => {
      try {
        const stored = Number(await AsyncStorage.getItem(STORAGE_KEY));
        if (stored > 0) {
          try {
            const bill = await api.getBill(stored);
            if (bill.status === "open") {
              storeBill(bill);
              setBillIdState(stored);
            } else setBillId(null);
          } catch (e) {
            if (e instanceof ApiError && e.status === 404) setBillId(null);
            else setBillIdState(stored); // offline: keep it, the bill screen shows the error
          }
        }
      } finally {
        setReady(true);
      }
    })();
    // Runs once on startup.
  }, []);

  const ensureBill = useCallback(async () => {
    if (billId != null) return billId;
    // Two quick taps must not create two bills.
    creating.current ??= api
      .createBill()
      .then((bill) => {
        storeBill(bill);
        setBillId(bill.id);
        return bill.id;
      })
      .finally(() => {
        creating.current = null;
      });
    return creating.current;
  }, [billId, setBillId, storeBill]);

  return <Ctx.Provider value={{ billId, ready, setBillId, ensureBill }}>{children}</Ctx.Provider>;
}

export function useCurrentBill() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCurrentBill must be used inside CurrentBillProvider");
  return ctx;
}
