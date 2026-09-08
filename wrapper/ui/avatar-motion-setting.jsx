import React from "react";
import { SettingRow } from "./settings-row.jsx";
import { Avatar } from "./avatar.jsx";
import { appearanceOptions } from "./appearance.mjs";

export function AvatarMotionSetting({ value, onChange, avatar = "nori", color }) {
  return <SettingRow title="Agent-Animation" description="Kleine Bewegungen mit langen Ruhepausen. Gesichtsausdrücke sind spielerisch und zeigen keinen Arbeitsstatus.">
    <div className="avatar-motion-control">
      <Avatar avatar={avatar} color={color} motion={value} />
      <select aria-label="Agent-Animation" value={value} onChange={event => onChange(event.target.value)}>
        {appearanceOptions.avatarMotion.options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
    </div>
  </SettingRow>;
}
