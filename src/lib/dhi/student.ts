import { createContext, useContext } from "react";
import { HOME } from "./home-demo";

// Who "you" are on the house screens. The demo student unless the dashboard route wraps the house in a real one (spec 0008): the name and
// class come from the signed in student's own record (`students.me`), nothing else about them is carried here.
// `signOut` is set only for a real student: the Leave button then ends their session instead of closing the demo gate.
export type HouseStudent = { name: string; initials: string; house: string; signOut?: () => void };

const StudentContext = createContext<HouseStudent>(HOME.student);

export const StudentProvider = StudentContext.Provider;

export function useStudent(): HouseStudent {
  return useContext(StudentContext);
}
