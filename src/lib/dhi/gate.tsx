import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { clearSession, setSession } from "@/lib/session";

type Gate = {
  inHouse: boolean;
  enter: (email?: string) => void;
  leave: () => void;
};

const GateContext = createContext<Gate>({
  inHouse: false,
  enter: () => {},
  leave: () => {},
});

export function GateProvider({ children }: { children: ReactNode }) {
  const [inHouse, setInHouse] = useState(true);

  const value = useMemo<Gate>(
    () => ({
      inHouse,
      enter: (email?: string) => {
        setSession(email || "suzzy@dhi.house");
        setInHouse(true);
      },
      leave: () => {
        clearSession();
        setInHouse(false);
      },
    }),
    [inHouse],
  );

  return <GateContext.Provider value={value}>{children}</GateContext.Provider>;
}

export function useGate() {
  return useContext(GateContext);
}
