import React from 'react';

/** A compact receipt: the rear check only shows its exposed arm. */
export function DeliveryChecks({double = false}: {double?: boolean}) {
  return <svg className="delivery-checks" width={double ? 18 : 12} height="12"
    viewBox={double ? '0 0 24 16' : '0 0 16 16'} fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M1 8 L5 12 L15 2"/>
    {double && <path d="M11 10 L13 12 L23 2"/>}
  </svg>;
}
