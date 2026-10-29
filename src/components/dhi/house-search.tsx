import { useId, useState } from "react";
import { Search } from "lucide-react";
import { searchRooms, type SearchRoom } from "@/lib/dhi/house-search";
import { cn } from "@/lib/utils";

// The search box of the house: it lists the rooms that match what is typed, and Enter or a tap opens one. Arrow keys move through the list and
// Escape clears it. It searches room names and everyday words only (`searchRooms`), never anyone's content.
export function HouseSearch({ rooms, onOpen, className }: { rooms: SearchRoom[]; onOpen: (id: string) => void; className?: string }) {
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const found = searchRooms(rooms, text);
  const open = (id: string) => {
    setText("");
    setActive(0);
    onOpen(id);
  };

  return (
    <div className={cn("relative", className)}>
      <label className="flex h-11 w-full items-center gap-2 rounded-full border border-white/80 bg-white/70 px-4 text-sm text-mute backdrop-blur-md has-[:focus-visible]:focus-ring">
        <Search className="size-4 shrink-0" aria-hidden />
        <input
          data-in-field
          data-testid="house-search"
          type="search"
          role="combobox"
          aria-expanded={found.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={found.length > 0 ? `${listId}-${active}` : undefined}
          placeholder="Search the house…"
          className="min-w-0 flex-1 bg-transparent text-home outline-none placeholder:text-mute"
          aria-label="Search the house"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && found.length) {
              e.preventDefault();
              setActive((a) => (a + 1) % found.length);
            } else if (e.key === "ArrowUp" && found.length) {
              e.preventDefault();
              setActive((a) => (a - 1 + found.length) % found.length);
            } else if (e.key === "Enter" && found[active]) {
              e.preventDefault();
              open(found[active].id);
            } else if (e.key === "Escape") {
              setText("");
            }
          }}
        />
      </label>
      {text.trim() !== "" && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 rounded-control border border-white/80 bg-paper p-1.5 shadow-lg">
          {found.length === 0 ? (
            <p className="px-3 py-2 text-sm text-mute" data-testid="house-search-none">
              No room matches. Try a word like sleep, exam or food.
            </p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Rooms" data-testid="house-search-results">
              {found.map((room, i) => (
                <li
                  key={room.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={cn("flex h-11 cursor-pointer items-center rounded-control px-3 text-sm", i === active ? "bg-sand" : "hover:bg-sand/60")}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => open(room.id)}
                >
                  {room.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
