import { useLayoutEffect, useRef, type SVGProps } from "react";
import { mountIcon } from "./icon-motion";

/** The public SVG remains stable across React renders; the motion driver owns its geometry. */
export function MotionGlyph({
  name,
  size = 18,
  className = "",
  ...props
}: SVGProps<SVGSVGElement> & { name: string; size?: number }) {
  const root = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    if (root.current) return mountIcon(root.current, name);
  }, [name]);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
      ref={root}
      className={`ui-icon ${className}`}
      data-icon-name={name}
    />
  );
}
