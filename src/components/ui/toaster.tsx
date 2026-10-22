"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

/**
 * 08-site (app-design §1.13): a surface card with a --rule-strong border, bottom right on desktop
 * and full width at the bottom on a phone. The mark says what happened: ✓ in gold, or ! in the
 * one red for an error (variant "destructive"). Success auto-dismisses after 6 s; errors stay
 * until dismissed and are announced assertively.
 */
export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider duration={6000}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const error = props.variant === "destructive"
        return (
          <Toast key={id} duration={error ? Infinity : undefined} type={error ? "foreground" : "background"} {...props}>
            <span aria-hidden="true" className={error ? "row-span-3 font-mono font-semibold leading-snug text-danger" : "row-span-3 font-mono leading-snug text-signal"}>
              {error ? "!" : "✓"}
            </span>
            <div className="col-start-2 grid gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
