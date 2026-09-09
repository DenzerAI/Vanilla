import { appearanceOptions } from "./appearance.mjs";
import { SettingRow } from "./settings-row.jsx";

export function IconMotionSetting({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <SettingRow
      title="Iconanimationen"
      description="Passende Gesten für Aktionen. Die Vorgabe für reduzierte Bewegung gilt weiterhin."
    >
      <select
        aria-label="Iconanimationen"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {appearanceOptions.iconAnimation.options.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </SettingRow>
  );
}
