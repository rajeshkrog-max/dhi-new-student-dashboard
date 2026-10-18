import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// A spot in the page header, beside the room title, below 1024. A room can put its own buttons
// there (the DHI desk puts Sittings and the coins chip) without the page knowing about them.
export const ROOM_ACTIONS_ID = "room-actions";

export function RoomActions({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setSlot(document.getElementById(ROOM_ACTIONS_ID)), []);
  return slot ? createPortal(children, slot) : null;
}
