/**
 * study_hours
 *   id, subject, teacher, title
 *   opens_at, closes_at          — admin writes these. Students cannot.
 *   voice boolean, video boolean — admin allows the channels
 *
 * A seat may enter only while now is inside [opens_at, closes_at].
 * At closes_at the client drops the room. No lingering.
 *
 * study_seats     hour_id, name, role, tile, camera, speaking
 * study_messages  hour_id, author, body, at, forwarded_from
 *
 * Demo clock is computed once per page load so the hour stays open in preview.
 */

export type Presence = "live" | "away" | "offline" | "dnd";

export type StudySeat = {
  id: string;
  name: string;
  role: string;
  image: string | null;
  you?: boolean;
  camera?: boolean;
  presence: Presence;
};

export type StudyLine = {
  id: string;
  author: string;
  body: string;
  at: string;
  forwarded?: string;
};

export type StudyHour = {
  id: string;
  subject: string;
  title: string;
  teacher: string;
  opensAt: number;
  closesAt: number;
  voice: boolean;
  video: boolean;
  seats: StudySeat[];
  lines: StudyLine[];
  transcript: string[];
};
