import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { crashedLastTime, markSafe, markStarting } from "@/lib/crash-guard";
import type { BarcodeScannerProps } from "./barcode-scanner";
import type { PhotoCaptureProps } from "./photo-capture";
import { Button } from "./ui";

// The camera libraries are native code. Loading them lazily, inside an error
// boundary and a crash guard, means a problem in them can't stop the whole app
// from opening: billing, products and search keep working, and the screen says
// what went wrong.

const LazyBarcodeScanner = lazy(() => import("./barcode-scanner").then((m) => ({ default: m.BarcodeScanner })));
const LazyPhotoCapture = lazy(() => import("./photo-capture").then((m) => ({ default: m.PhotoCapture })));

/** How long the camera must run before we consider it safe. */
const SAFE_AFTER_MS = 4000;

export function SafeBarcodeScanner(props: BarcodeScannerProps) {
  return (
    <GuardedCamera>
      <LazyBarcodeScanner {...props} />
    </GuardedCamera>
  );
}

export function SafePhotoCapture(props: PhotoCaptureProps) {
  return (
    <GuardedCamera>
      <LazyPhotoCapture {...props} />
    </GuardedCamera>
  );
}

function GuardedCamera({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "crashed" | "run">("checking");

  useEffect(() => {
    let alive = true;
    crashedLastTime("camera").then(async (crashed) => {
      if (!alive) return;
      if (crashed) return setState("crashed");
      await markStarting("camera");
      if (alive) setState("run");
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (state !== "run") return;
    const t = setTimeout(() => markSafe("camera"), SAFE_AFTER_MS);
    return () => clearTimeout(t);
  }, [state]);

  if (state === "checking") return <View style={styles.box} />;
  if (state === "crashed") {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>The camera closed the app last time</Text>
        <Text style={styles.text}>
          It has been switched off so the app could open. Billing, products and search still work.
        </Text>
        <Button
          title="Try the camera again"
          variant="secondary"
          onPress={() => {
            markStarting("camera").then(() => setState("run"));
          }}
        />
      </View>
    );
  }
  return (
    <NativeErrorBoundary what="The camera">
      <Suspense fallback={<View style={styles.box} />}>{children}</Suspense>
    </NativeErrorBoundary>
  );
}

/** Catches JavaScript errors from native-backed components and shows them instead of crashing. */
export class NativeErrorBoundary extends Component<{ what: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch() {
    // It failed safely, so it isn't a native crash: don't block it next launch.
    markSafe("camera");
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.box}>
        <Text style={styles.title}>{this.props.what} couldn't start</Text>
        <Text style={styles.text} selectable>
          {this.state.error.message}
        </Text>
        <Button title="Try again" variant="secondary" onPress={() => this.setState({ error: null })} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  box: { flex: 1, backgroundColor: "#111", alignItems: "center", justifyContent: "center", padding: 20, gap: 12 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center" },
  text: { color: "#ddd", fontSize: 15, textAlign: "center" },
});
