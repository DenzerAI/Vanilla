import React from "react";
import { SettingRow } from "./settings-row.jsx";
import { Avatar } from "./avatar.jsx";
import { appearanceOptions, normalizeAvatarMotion } from "./appearance.mjs";

export function AvatarMotionSetting({ value, onChange, avatar = "lumi", color }) {
  value = normalizeAvatarMotion(value);
  return <SettingRow title="Figur-Animation" description="Die Figur atmet und blinzelt; auf der Schreibzeile zeigt sie, was gerade passiert. Ruhig lässt Hüpfer und Drehungen weg, Ausgeblendet nimmt sie von der Schreibzeile.">
    <div className="avatar-motion-control">
      <Avatar avatar={avatar} color={color} motion={value} />
      <select aria-label="Agent-Animation" value={value} onChange={event => onChange(event.target.value)}>
        {appearanceOptions.avatarMotion.options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
    </div>
  </SettingRow>;
}
