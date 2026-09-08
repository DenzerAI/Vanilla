import { useState } from "react";
import { AppLoader, type LoaderSettings as Settings } from "./app-loader";
import { loaderOptions, loaderVariants } from "./loader-options.mjs";
import type { LoaderVariant } from "./components/ui/loader";
import { SettingRow } from "./settings-row.jsx";
export function LoaderSettings({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (change: Partial<Settings>) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  async function save(change: Partial<Settings>) {
    setSaving(true);
    setError("");
    try {
      await onChange(change);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Auswahl konnte nicht gespeichert werden.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <h3 className="section-heading">Ladeanzeige</h3>
      <div className="settings-group">
        <SettingRow
          title="Stil"
          description="Für Seitenleiste und Chat. Änderungen werden automatisch gespeichert."
        >
          <AppLoader size={28} preview />
        </SettingRow>
        <fieldset
          className="loader-choices"
          disabled={saving}
          aria-label="Ladeanzeige auswählen"
        >
          {loaderVariants.map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="loader-variant"
                value={value}
                checked={(settings.loaderVariant || "ascii") === value}
                onChange={() => void save({ loaderVariant: value })}
              />
              <span>
                <span className="loader-preview">
                  <AppLoader
                    variant={value as LoaderVariant}
                    size={32}
                    preview
                  />
                </span>
                <span>{label}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {(["loaderSize", "loaderSpeed"] as const).map((key) => (
          <SettingRow
            key={key}
            title={key === "loaderSize" ? "Größe" : "Tempo"}
          >
            <select
              aria-label={
                key === "loaderSize"
                  ? "Größe der Ladeanzeige"
                  : "Tempo der Ladeanzeige"
              }
              disabled={saving}
              value={settings[key] || loaderOptions[key].default}
              onChange={(e) => void save({ [key]: e.target.value })}
            >
              {loaderOptions[key].options.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </SettingRow>
        ))}
      </div>
      {settings.loaderVariant === "percent" && (
        <p className="muted">
          Die Prozentanzeige ist eine Animation und zeigt keinen tatsächlichen
          Arbeitsfortschritt.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
