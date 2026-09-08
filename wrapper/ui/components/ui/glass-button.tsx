import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import "./glass-button.css";

const glassButtonVariants = cva("glass-button", {
  variants: { size: {
    default: "glass-button-default", sm: "glass-button-sm",
    lg: "glass-button-lg", icon: "glass-button-icon",
  } },
  defaultVariants: { size: "default" },
});
const glassButtonTextVariants = cva("glass-button-text", {
  variants: { size: {
    default: "glass-button-content-default", sm: "glass-button-content-sm",
    lg: "glass-button-content-lg", icon: "glass-button-content-icon",
  } },
  defaultVariants: { size: "default" },
});
export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  contentClassName?: string;
}
const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, children, size, contentClassName, type = "button", disabled, ...props }, ref) => (
    <div className={cn("glass-button-wrap", className)} data-disabled={disabled || undefined}>
      <button className={glassButtonVariants({ size })} ref={ref} type={type} disabled={disabled} {...props}>
        <span className={cn(glassButtonTextVariants({ size }), contentClassName)}>{children}</span>
      </button>
      <div className="glass-button-shadow" aria-hidden="true" />
    </div>
  ),
);
GlassButton.displayName = "GlassButton";
export { GlassButton, glassButtonVariants };
