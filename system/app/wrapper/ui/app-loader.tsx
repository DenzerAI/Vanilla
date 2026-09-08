import { createContext, useContext, type ReactNode } from "react";
import { Loader, type LoaderVariant } from "./components/ui/loader";
import { loaderVariants } from "./loader-options.mjs";
import "./loader.css";
export interface LoaderSettings {
  loaderVariant?: string;
  loaderSize?: string;
  loaderSpeed?: string;
  reduceMotion?: string;
}
const Context = createContext<LoaderSettings>({});
export function LoaderProvider({
  settings,
  children,
}: {
  settings: LoaderSettings;
  children: ReactNode;
}) {
  return <Context.Provider value={settings}>{children}</Context.Provider>;
}
export function AppLoader({
  size = 16,
  variant,
  preview = false,
  label = "In Bearbeitung",
}: {
  size?: number;
  variant?: LoaderVariant;
  preview?: boolean;
  label?: string;
}) {
  const settings = useContext(Context);
  const selected =
    variant ||
    (loaderVariants.some(([key]) => key === settings.loaderVariant)
      ? (settings.loaderVariant as LoaderVariant)
      : "ascii");
  const scale =
    settings.loaderSize === "small"
      ? 0.85
      : settings.loaderSize === "large"
        ? 1.15
        : 1;
  const speed =
    settings.loaderSpeed === "slow"
      ? 1.6
      : settings.loaderSpeed === "fast"
        ? 0.65
        : 1;
  // Fit wide glyphs and moving end balls inside the same stable square slot.
  const fit =
    selected === "scramble"
      ? 0.43
      : selected === "percent"
        ? 0.69
        : selected === "newton"
          ? 0.69
          : 1;
  return (
    <span
      className="app-loader"
      aria-hidden={preview || undefined}
      style={{ width: size * 1.2, height: size * 1.2 }}
    >
      <Loader
        variant={selected}
        size={size * scale * fit}
        speed={speed}
        label={label}
        reduceMotion={settings.reduceMotion === "on"}
      />
    </span>
  );
}
