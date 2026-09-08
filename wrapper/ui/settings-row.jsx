import React from 'react';
// Shared settings layout; see surfaces/settings.md.
/** @param {{title: import('react').ReactNode, description?: import('react').ReactNode, action?: import('react').ReactNode, children?: import('react').ReactNode, icon?: import('react').ReactNode}} props */
export function SettingRow({title,description,action,children,icon}) {
  return <div className="setting-row"><div className={icon ? "setting-row-identity" : undefined}>{icon}<div><strong>{title}</strong>{description && <p>{description}</p>}</div></div>{action || children}</div>;
}
