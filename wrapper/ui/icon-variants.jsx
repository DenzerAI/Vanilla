import React from "react";
import { MotionGlyph } from "./motion-glyph";
// Existing secondary glyphs retain their shapes; they share the system's motion driver.
export const LucideRotateCcw = (props) => (
  <MotionGlyph {...props} name="LucideRotateCcw" />
);
export const LucideZap = (props) => <MotionGlyph {...props} name="LucideZap" />;
export const LucideSun = (props) => <MotionGlyph {...props} name="LucideSun" />;
export const LucideMoon = (props) => (
  <MotionGlyph {...props} name="LucideMoon" />
);
export function LayoutGlyph({ count = 2 }) {
  const columns = [1, 2, 3, 4].includes(count) ? count : 2;
  return (
    <MotionGlyph
      name={`Layout${columns}`}
      size={20}
      height={18}
      viewBox="0 4.666667 56 46.666667"
    />
  );
}
