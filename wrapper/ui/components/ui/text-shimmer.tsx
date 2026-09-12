import type { HTMLAttributes, ReactNode } from "react"
import "./text-shimmer.css"

type TextShimmerProps = HTMLAttributes<HTMLSpanElement> & {
  /** Runs the highlight. Pass the real working state; a finished step never shimmers. */
  active?: boolean
  children: ReactNode
}

export function TextShimmer({ active = true, className, children, ...rest }: TextShimmerProps) {
  return (
    <span
      {...rest}
      className={className ? `text-shimmer ${className}` : "text-shimmer"}
      data-shimmer={active ? "on" : "off"}
    >
      {children}
    </span>
  )
}
