// Stockage simplifié avec Supabase
// Utilise Supabase pour toutes les opérations de base de données

import { supabase } from "./supabase";

export type Role = "admin" | "coordinator";
export type PersonOrigin = "culte" | "evangelism" | "activite" | "autre";
export type EventType = "activity" | "thursday" | "evangelism";
export type ReminderKind = "engagement" | "call" | "visit" | "prayer" | "other";

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

// Numéros autorisés et leurs rôles (tous fonctionnent)
const AUTHORIZED_NUMBERS: Record<string, Role> = {
  '0894513330': 'admin',
  '0840373844': 'admin', 
  '0812714806': 'admin',
  '0859246865': 'coordinator',
  '0972830622': 'coordinator'
};

// Numéros déjà utilisés (stockés dans localStorage)
const USED_NUMBERS_KEY = 'rdp.used_numbers';

function getUsedNumbers(): Set<string> {
  try {
    const used = localStorage.getItem(USED_NUMBERS_KEY);
    // Temporairement désactiver la vérification des numéros utilisés pour la migration
    return new Set();
  } catch {
    return new Set();
  }
}

function markNumberAsUsed(phone: string): void {
  const used = getUsedNumbers();
  used.add(phone);
  localStorage.setItem(USED_NUMBERS_KEY, JSON.stringify([...used]));
}

export function releaseNumber(phone: string): void {
  const used = getUsedNumbers();
  used.delete(phone);
  localStorage.setItem(USED_NUMBERS_KEY, JSON.stringify([...used]));
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

export const uid = () => crypto.randomUUID();

// Validation des numéros autorisés
export const validateAccountCreation = (phone: string): {
  isValid: boolean;
  assignedRole?: Role;
  errorMessage?: string;
} => {
  const cleanPhone = phone.replace(/\s/g, ''); // Nettoyer le numéro
  
  if (!AUTHORIZED_NUMBERS[cleanPhone]) {
    return {
      isValid: false,
      errorMessage: "Numéro de téléphone non autorisé pour créer un compte"
    };
  }

  const usedNumbers = getUsedNumbers();
  if (usedNumbers.has(cleanPhone)) {
    return {
      isValid: false,
      errorMessage: "Ce numéro a déjà été utilisé pour créer un compte"
    };
  }

  return {
    isValid: true,
    assignedRole: AUTHORIZED_NUMBERS[cleanPhone]
  };
};

export const getSession = () => read<User | null>(KEYS.session, null);
export const setSession = (u: User | null) =>
  u ? write(KEYS.session, u) : localStorage.removeItem(KEYS.session);

export const getUsers = async () => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) {
    console.error('Error loading users from Supabase:', error);
    return read<User[]>(KEYS.users, []);
  }
  if (!data) return [];
  return data.map((u: any) => ({
    id: u.id,
    fullName: u.full_name,
    phone: u.phone,
    code: u.code,
    role: u.role,
    avatarDataUrl: u.avatar
  }));
};

export const saveUsers = async (u: User[]) => {
  // This function is no longer needed as we use Supabase directly
  // Kept for backward compatibility
  write(KEYS.users, u);
};

export const hasAnyUser = async () => {
  const users = await getUsers();
  return users.length > 0;
};

export async function createAccount(
  fullName: string,
  code: string,
  phone: string
): Promise<User | { error: string }> {
  const name = fullName.trim();
  if (!name) return { error: "Nom complet requis." };
  if (!code || code.length < 4) return { error: "Code secret de 4 caractères minimum." };

  // Valider le numéro
  const validation = validateAccountCreation(phone);
  if (!validation.isValid) {
    return { error: validation.errorMessage || "Numéro non autorisé" };
  }

  const users = await getUsers();
  // Check if a user with the same name exists and has a phone number (not deleted)
  if (users.some(u => u.fullName.toLowerCase() === name.toLowerCase() && u.phone)) {
    return { error: "Un compte existe déjà avec ce nom." };
  }

  const cleanPhone = phone.replace(/\s/g, '');
  const u: User = {
    id: uid(),
    fullName: name,
    phone: cleanPhone,
    code: code,
    role: validation.assignedRole!,
    avatarDataUrl: undefined
  };

  // Save to Supabase
  const { error } = await supabase.from('users').insert({
    id: u.id,
    full_name: u.fullName,
    phone: u.phone,
    code: u.code,
    role: u.role,
    avatar: u.avatarDataUrl
  });

  if (error) {
    console.error('Error creating user in Supabase:', error);
    return { error: "Erreur lors de la création du compte." };
  }

  markNumberAsUsed(cleanPhone);
  setSession(u);
  return u;
}

export async function loginWith(fullName: string, code: string, phone?: string): Promise<User | null> {
  console.log('Login attempt - fullName:', fullName, 'code:', code, 'phone:', phone);

  // Search directly in Supabase first
  const { data, error } = await supabase.from('users').select('*').ilike('full_name', fullName).eq('code', code).single();

  if (error || !data) {
    console.error('User not found in Supabase:', error);
    return null;
  }

  console.log('Found user in Supabase:', data);

  // Check if the user has been deleted (name changed to Deleted Admin/User)
  if (data.full_name.startsWith("Deleted Admin") || data.full_name.startsWith("Deleted User")) {
    console.log('User has been deleted in Supabase, rejecting login');
    return null;
  }

  // Convert Supabase user to local User format
  const u: User = {
    id: data.id,
    fullName: data.full_name,
    phone: data.phone,
    code: data.code,
    role: data.role,
    avatarDataUrl: data.avatar
  };

  setSession(u);
  return u;
}

export async function updateUser(updated: User) {
  const { error } = await supabase.from('users').update({
    full_name: updated.fullName,
    phone: updated.phone,
    code: updated.code,
    role: updated.role,
    avatar: updated.avatarDataUrl
  }).eq('id', updated.id);

  if (error) {
    console.error('Error updating user in Supabase:', error);
  }

  const session = getSession();
  if (session?.id === updated.id) setSession(updated);
}

export async function deleteUser(userId: string, skipSupabase: boolean = false) {
  const users = await getUsers();
  const userToDelete = users.find(u => u.id === userId);

  if (userToDelete?.phone) {
    releaseNumber(userToDelete.phone);
  }

  if (!skipSupabase) {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) {
      console.error('Error deleting user from Supabase:', error);
    }
  }
}

export const logout = () => { setSession(null); };

// Fonctions pour les autres données (maintenant avec Supabase)
export const getPersons = async () => {
  const { data, error } = await supabase.from('persons').select('*');
  if (error) {
    console.error('Error loading persons from Supabase:', error);
    return read<Person[]>(KEYS.persons, []);
  }
  if (!data) return [];
  return data.map((p: any) => ({
    id: p.id,
    fullName: p.full_name,
    phone: p.phone,
    address: p.address,
    origin: p.origin,
    registrationDate: p.registration_date,
    linkedEventId: p.linked_event_id,
    createdAt: p.created_at
  }));
};

export const savePersons = async (p: Person[]) => {
  // This function is no longer needed as we use Supabase directly
  // Kept for backward compatibility
  write(KEYS.persons, p);
};

export const getEvents = async () => {
  const { data, error } = await supabase.from('events').select('*');
  if (error) {
    console.error('Error loading events from Supabase:', error);
    return read<AppEvent[]>(KEYS.events, []);
  }
  if (!data) return [];
  return data.map((e: any) => ({
    id: e.id,
    type: e.type,
    title: e.title,
    date: e.date,
    posterDataUrl: e.poster,
    groupId: e.group_id,
    participantIds: e.participant_ids || [],
    attendeeCount: e.attendee_count
  }));
};

export const saveEvents = async (e: AppEvent[]) => {
  // This function is no longer needed as we use Supabase directly
  // Kept for backward compatibility
  write(KEYS.events, e);
};

export const getReminders = async () => {
  const { data, error } = await supabase.from('reminders').select('*');
  if (error) {
    console.error('Error loading reminders from Supabase:', error);
    return read<Reminder[]>(KEYS.reminders, []);
  }
  if (!data) return [];
  return data.map((r: any) => ({
    id: r.id,
    personId: r.person_id,
    title: r.title,
    kind: r.kind,
    note: r.note,
    startDate: r.start_date,
    endDate: r.end_date,
    byCall: r.by_call,
    byWhatsapp: r.by_whatsapp,
    skippedDates: r.skipped_dates || [],
    doneDates: r.done_dates || [],
    createdAt: r.created_at
  }));
};

export const saveReminders = async (r: Reminder[]) => {
  // This function is no longer needed as we use Supabase directly
  // Kept for backward compatibility
  write(KEYS.reminders, r);
};

export const getAttendances = () => read<Attendance[]>(KEYS.attendances, []);
export const saveAttendances = (a: Attendance[]) => write(KEYS.attendances, a);

export const getGeneralActive = () => read<boolean>(KEYS.generalActive, false);
export const saveGeneralActive = (v: boolean) => write(KEYS.generalActive, v);

export const getGeneralHidden = () => read<boolean>(KEYS.generalHidden, false);
export const saveGeneralHidden = (v: boolean) => write(KEYS.generalHidden, v);

export const getGeneralDismissed = () => read<string[]>(KEYS.generalDismissed, []);
export const saveGeneralDismissed = (ids: string[]) => write(KEYS.generalDismissed, ids);
export const resetGeneralDismissed = () => localStorage.removeItem(KEYS.generalDismissed);
