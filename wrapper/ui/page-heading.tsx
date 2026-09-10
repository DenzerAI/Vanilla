import type {ReactNode} from 'react';
import {IconButton} from './icon-button';
import {PanelLeft} from './icons.jsx';
export function PageHeading({title,onShowSidebar,children}:{title:ReactNode;onShowSidebar?:()=>void;children?:ReactNode}) {
  return <header className="page-heading">
    <div className="page-heading-title">
      {onShowSidebar&&<IconButton label="Seitenleiste anzeigen" onClick={onShowSidebar}><PanelLeft size={18} strokeWidth={1.55}/></IconButton>}
      <h1>{title}</h1>
    </div>
    {children&&<div className="page-heading-actions">{children}</div>}
  </header>;
}
