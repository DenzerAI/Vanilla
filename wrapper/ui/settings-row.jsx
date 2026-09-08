import React from 'react';
import { SettingIcon } from './controls.jsx';
// Shared settings row; see surfaces/settings.md and docs/DESIGN.md.
// `icon` accepts an icon component (rendered on the round SettingIcon well) or a ready node such as <BrandIcon/>.
/** @param {{title: import('react').ReactNode, description?: import('react').ReactNode, action?: import('react').ReactNode, children?: import('react').ReactNode, icon?: any}} props */
export function SettingRow({title,description,action,children,icon}) {
  const glyph = typeof icon === 'function' ? <SettingIcon icon={icon} /> : icon;
  return <div className="setting-row"><div className={glyph ? "setting-row-identity" : undefined}>{glyph}<div><strong>{title}</strong>{description && <p>{description}</p>}</div></div>{action || children}</div>;
}
