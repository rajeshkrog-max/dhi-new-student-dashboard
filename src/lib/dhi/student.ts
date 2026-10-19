import { createContext, useContext } from "react";

// Who "you" are on the house screens: the signed in member, from their own `members` row (spec house/0002). There is no demo seat any more:
// a screen that needs this sits inside a provider made by a route that has checked the member (`/dashboard` or `/staff`), and outside one it
// refuses to render. `house` is the line under the name (a student's class, or a staff member's institute or role). `signOut` ends the session.
export type HouseStudent = { name: string; initials: string; house: string; signOut: () => void };

const StudentContext = createContext<HouseStudent | null>(null);

export const StudentProvider = StudentContext.Provider;

export function useStudent(): HouseStudent {
  const student = useContext(StudentContext);
  if (!student) throw new Error("useStudent was used outside a signed in member. Every house screen sits inside /dashboard or /staff.");
  return student;
}
