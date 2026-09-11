import React from "react";
import artwork from "../public/vanilla-wordmark.svg?raw";
import "./vanilla-wordmark.css";

/** Trusted bundled artwork. The surrounding control supplies its accessible name. */
export function VanillaWordmark() {
  return <span className="vanilla-wordmark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: artwork }} />;
}
