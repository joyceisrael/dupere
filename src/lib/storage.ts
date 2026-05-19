// Storage layer (localStorage)
export type Role = "admin" | "coordinator";

export type PersonOrigin = "culte" | "evangelism" | "activite" | "autre";

export interface User {
  id: string;
  fullName: string;
  phone?: string;
  code: string;
  role: Role;
  avatarDataUrl?: string;
}

export interface Person {
  id: string;
  fullName: string;
  address?: string;
  phone?: string;
  origin?: PersonOrigin;
  registrationDate?: string;
  linkedEventId?: string;
  createdAt: string;
}

export type EventType = "activity" | "thursday" | "evangelism";

export interface AppEvent {
  id: string;
  type: EventType;
  title: string;
  date: string;
  posterDataUrl?: string;
  groupId?: string;
  participantIds: string[];
  attendeeCount?: number;
}

export type ReminderKind = "engagement" | "call" | "visit" | "prayer" | "other";

export interface Reminder {
  id: string;
  personId: string;
  title: string;
  kind: ReminderKind;
  note?: string;
  startDate: string;
  endDate?: string;
  byCall: boolean;
  byWhatsapp: boolean;
  skippedDates: string[];
  doneDates: string[];
  createdAt: string;
}

export interface Attendance {
  id: string;
  eventId: string;
  personId: string;
  createdAt: string;
}

const KEYS = {
  session: "rdp.session",
  users: "rdp.users",
  persons: "rdp.persons",
  events: "rdp.events",
  reminders: "rdp.reminders",
  attendances: "rdp.attendances",
  generalActive: "rdp.generalActive",
  generalHidden: "rdp.generalHidden",
  generalDismissed: "rdp.generalDismissed",
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, val: T) {
  localStorage.setItem(key, JSON.stringify(val));
}

export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const getSession = () => read<User | null>(KEYS.session, null);
export const setSession = (u: User | null) =>
  u ? write(KEYS.session, u) : localStorage.removeItem(KEYS.session);

export const getUsers = () => read<User[]>(KEYS.users, []);
export const saveUsers = (u: User[]) => write(KEYS.users, u);

export const getPersons = () => read<Person[]>(KEYS.persons, []);
export const savePersons = (p: Person[]) => write(KEYS.persons, p);

export const getEvents = () => read<AppEvent[]>(KEYS.events, []);
export const saveEvents = (e: AppEvent[]) => write(KEYS.events, e);

export const getReminders = () => read<Reminder[]>(KEYS.reminders, []);
export const saveReminders = (r: Reminder[]) => write(KEYS.reminders, r);

export const getAttendances = () => read<Attendance[]>(KEYS.attendances, []);
export const saveAttendances = (a: Attendance[]) => write(KEYS.attendances, a);

export const getGeneralActive = () => read<boolean>(KEYS.generalActive, false);
export const saveGeneralActive = (v: boolean) => write(KEYS.generalActive, v);
export const getGeneralHidden = () => read<boolean>(KEYS.generalHidden, false);
export const saveGeneralHidden = (v: boolean) => write(KEYS.generalHidden, v);

export const getGeneralDismissed = () => read<string[]>(KEYS.generalDismissed, []);
export const saveGeneralDismissed = (ids: string[]) => write(KEYS.generalDismissed, ids);
export const resetGeneralDismissed = () => localStorage.removeItem(KEYS.generalDismissed);

export function updateUser(updated: User) {
  const users = getUsers().map(u => u.id === updated.id ? updated : u);
  saveUsers(users);
  const session = getSession();
  if (session?.id === updated.id) setSession(updated);
}

export function deleteUser(userId: string) {
  const users = getUsers().filter(u => u.id !== userId);
  saveUsers(users);
}

export function createAccount(
  fullName: string, code: string, role: Role, phone?: string
): User | { error: string } {
  const name = fullName.trim();
  if (!name) return { error: "Nom complet requis." };
  if (!code || code.length < 4) return { error: "Code secret de 4 caractères minimum." };
  const users = getUsers();
  if (users.some(u => u.fullName.toLowerCase() === name.toLowerCase())) {
    return { error: "Un compte existe déjà avec ce nom." };
  }
  const u: User = { id: uid(), fullName: name, code, role, phone: phone?.trim() || undefined };
  saveUsers([...users, u]);
  setSession(u);
  return u;
}

export function loginWith(fullName: string, code: string, phone?: string): User | null {
  const users = getUsers();
  const target = fullName.toLowerCase().trim();
  const u = users.find(x => {
    if (x.fullName.toLowerCase().trim() !== target) return false;
    if (x.code !== code) return false;
    if (phone && x.phone && phone.trim() !== x.phone.trim()) return false;
    return true;
  });
  if (u) setSession(u);
  return u ?? null;
}

export const hasAnyUser = () => getUsers().length > 0;
export function logout() { setSession(null); }
