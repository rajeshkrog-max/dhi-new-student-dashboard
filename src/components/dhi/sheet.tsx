import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Side = "left" | "right" | "bottom";

// The one place pop ups and side panels live. Radix gives the focus trap, Esc, scroll lock and
// screen reader support. Left is the menu drawer, right is a room side panel (full width below
// 640), bottom is a form (a bottom sheet below 640, a centred dialog from 640).
const PLACE: Record<Side, string> = {
  left: "inset-y-0 left-0 w-[min(86vw,320px)] rounded-r-[28px] motion-safe:animate-[sheet-from-left_220ms_ease-out]",
  right:
    "inset-y-0 right-0 w-full sm:w-[min(92vw,440px)] sm:rounded-l-[28px] motion-safe:animate-[sheet-from-right_220ms_ease-out]",
  bottom:
    "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-[28px] motion-safe:animate-[sheet-from-bottom_220ms_ease-out] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(92vw,34rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:animate-none",
};

export function Sheet({
  open,
  onOpenChange,
  side = "bottom",
  title,
  hideTitle,
  children,
  className,
  tone = "light",
  backdrop,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: Side;
  title: string;
  hideTitle?: boolean;
  children: ReactNode;
  className?: string;
  // photo: a full bleed picture behind light text (the mood day panel). Pass the picture as backdrop.
  // dark: the study hour chat. Both lay their children out as a column.
  tone?: "light" | "photo" | "dark";
  backdrop?: ReactNode;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const photo = tone === "photo";
  const onDark = photo || tone === "dark";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-home/40 backdrop-blur-[2px] motion-safe:animate-[sheet-fade_200ms_ease-out]" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(
            "fixed z-50 flex max-h-dvh flex-col overflow-hidden border shadow-2xl outline-none",
            photo && "border-white/20 bg-[#1a1208] text-paper",
            tone === "dark" && "border-white/10 bg-[#0b1c26] text-paper",
            tone === "light" && "border-white/80 bg-home-bg text-home",
            PLACE[side],
            className,
          )}
        >
          {backdrop}
          <div className="relative flex shrink-0 items-center justify-between gap-2 py-2 pl-5 pr-2">
            <Dialog.Title
              className={cn("font-display text-lg font-medium", (hideTitle || photo) && "sr-only")}
            >
              {title}
            </Dialog.Title>
            <Dialog.Close
              aria-label={`Close ${title.toLowerCase()}`}
              className={cn(
                "ml-auto grid size-11 shrink-0 place-items-center rounded-2xl",
                onDark
                  ? "border border-white/30 bg-white/15 backdrop-blur-md hover:bg-white/25"
                  : "hover:bg-white/60",
              )}
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <div
            className={cn(
              "relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5",
              onDark && "flex flex-col",
            )}
          >
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
