// Couche de stockage Supabase pour Les Rachetés du Père
// Remplace le localStorage par une base de données Supabase

import { supabase } from './supabase'
import type { User, Person, AppEvent, Reminder, Attendance, Role, PersonOrigin, EventType, ReminderKind } from './storage'

// Types pour les réponses Supabase
type SupabaseResponse<T> = {
  data: T | null
  error: any | null
}

// Fonctions utilitaires
export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

// Gestion de la session
export const getSession = async (): Promise<User | null> => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single()

  return user
}

export const setSession = async (user: User | null) => {
  if (user) {
    // La session est gérée par Supabase Auth
    console.log('Session définie pour:', user.fullName)
  } else {
    await supabase.auth.signOut()
  }
}

// Validation de création de compte avec numéro autorisé
export const validateAccountCreation = async (phone: string): Promise<{
  isValid: boolean
  assignedRole?: Role
  errorMessage?: string
}> => {
  const { data, error } = await supabase
    .rpc('validate_account_creation', { phone_number: phone })

  if (error) {
    return { isValid: false, errorMessage: 'Erreur de validation' }
  }

  if (data && data.length > 0) {
    const result = data[0]
    return {
      isValid: result.is_valid,
      assignedRole: result.assigned_role,
      errorMessage: result.error_message
    }
  }

  return { isValid: false, errorMessage: 'Numéro non autorisé' }
}

// Création de compte avec validation du numéro
export const createAccount = async (
  fullName: string,
  code: string,
  phone: string
): Promise<User | { error: string }> => {
  const name = fullName.trim()
  if (!name) return { error: "Nom complet requis." }
  if (!code || code.length < 4) return { error: "Code secret de 4 caractères minimum." }
  
  // Valider le numéro de téléphone
  const validation = await validateAccountCreation(phone)
  if (!validation.isValid) {
    return { error: validation.errorMessage || "Numéro non autorisé" }
  }

  try {
    // Créer l'utilisateur dans Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      phone: phone,
      password: code,
      options: {
        data: {
          full_name: name,
          role: validation.assignedRole
        }
      }
    })

    if (authError) {
      return { error: "Erreur lors de la création du compte: " + authError.message }
    }

    if (!authData.user) {
      return { error: "Erreur lors de la création de l'utilisateur" }
    }

    // Créer l'utilisateur dans notre table users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        full_name: name,
        phone: phone,
        code: code,
        role: validation.assignedRole
      })
      .select()
      .single()

    if (userError) {
      // Nettoyer l'utilisateur auth si l'insertion échoue
      await supabase.auth.admin.deleteUser(authData.user.id)
      return { error: "Erreur lors de l'enregistrement: " + userError.message }
    }

    // Marquer le numéro comme utilisé
    await supabase.rpc('mark_phone_as_used', {
      phone_number: phone,
      user_id: userData.id
    })

    return userData as User
  } catch (error) {
    return { error: "Erreur inattendue: " + error }
  }
}

// Connexion avec validation
export const loginWith = async (fullName: string, code: string, phone?: string): Promise<User | null> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      phone: phone,
      password: code
    })

    if (error || !data.user) {
      return null
    }

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single()

    return userData as User
  } catch (error) {
    console.error('Erreur de connexion:', error)
    return null
  }
}

export const logout = async () => {
  await supabase.auth.signOut()
}

export const hasAnyUser = async (): Promise<boolean> => {
  const { data } = await supabase
    .from('users')
    .select('id')
    .limit(1)

  return data && data.length > 0
}

// CRUD pour les utilisateurs
export const getUsers = async (): Promise<User[]> => {
  const { data } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })

  return data as User[] || []
}

export const updateUser = async (updated: User): Promise<void> => {
  const { error } = await supabase
    .from('users')
    .update({
      full_name: updated.fullName,
      phone: updated.phone,
      code: updated.code,
      role: updated.role,
      avatar_data_url: updated.avatarDataUrl
    })
    .eq('id', updated.id)

  if (error) throw error
}

export const deleteUser = async (userId: string): Promise<void> => {
  // Libérer le numéro de téléphone
  await supabase.rpc('release_phone_number', { user_id: userId })

  // Supprimer l'utilisateur
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId)

  if (error) throw error
}

// CRUD pour les personnes
export const getPersons = async (): Promise<Person[]> => {
  const { data } = await supabase
    .from('persons')
    .select('*')
    .order('created_at', { ascending: false })

  return data as Person[] || []
}

export const savePersons = async (persons: Person[]): Promise<void> => {
  // Implémentation à adapter selon les besoins
  // Pour l'instant, on suppose que les personnes sont gérées individuellement
  console.log('savePersons appelé avec', persons.length, 'personnes')
}

export const createPerson = async (person: Omit<Person, 'id' | 'createdAt'>): Promise<Person> => {
  const { data, error } = await supabase
    .from('persons')
    .insert({
      full_name: person.fullName,
      address: person.address,
      phone: person.phone,
      origin: person.origin,
      registration_date: person.registrationDate,
      linked_event_id: person.linkedEventId
    })
    .select()
    .single()

  if (error) throw error
  return data as Person
}

export const updatePerson = async (id: string, updates: Partial<Person>): Promise<void> => {
  const { error } = await supabase
    .from('persons')
    .update({
      full_name: updates.fullName,
      address: updates.address,
      phone: updates.phone,
      origin: updates.origin,
      registration_date: updates.registrationDate,
      linked_event_id: updates.linkedEventId
    })
    .eq('id', id)

  if (error) throw error
}

export const deletePerson = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('persons')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// CRUD pour les événements
export const getEvents = async (): Promise<AppEvent[]> => {
  const { data } = await supabase
    .from('events')
    .select(`
      *,
      event_participants(
        person_id
      )
    `)
    .order('date', { ascending: false })

  return (data || []).map((event: any) => ({
    ...event,
    participantIds: event.event_participants.map((p: any) => p.person_id)
  })) as AppEvent[]
}

export const createEvent = async (event: Omit<AppEvent, 'id' | 'createdAt'>): Promise<AppEvent> => {
  const { data, error } = await supabase
    .from('events')
    .insert({
      type: event.type,
      title: event.title,
      date: event.date,
      poster_data_url: event.posterDataUrl,
      group_id: event.groupId,
      attendee_count: event.attendeeCount || 0
    })
    .select()
    .single()

  if (error) throw error

  // Ajouter les participants
  if (event.participantIds.length > 0) {
    const participants = event.participantIds.map(personId => ({
      event_id: data.id,
      person_id: personId
    }))

    await supabase
      .from('event_participants')
      .insert(participants)
  }

  return {
    ...data,
    participantIds: event.participantIds,
    posterDataUrl: data.poster_data_url,
    groupId: data.group_id,
    attendeeCount: data.attendee_count,
    createdAt: data.created_at
  } as AppEvent
}

export const updateEvent = async (id: string, updates: Partial<AppEvent>): Promise<void> => {
  const { error } = await supabase
    .from('events')
    .update({
      type: updates.type,
      title: updates.title,
      date: updates.date,
      poster_data_url: updates.posterDataUrl,
      group_id: updates.groupId
    })
    .eq('id', id)

  if (error) throw error

  // Mettre à jour les participants si nécessaire
  if (updates.participantIds) {
    // Supprimer les participants existants
    await supabase
      .from('event_participants')
      .delete()
      .eq('event_id', id)

    // Ajouter les nouveaux participants
    if (updates.participantIds.length > 0) {
      const participants = updates.participantIds.map(personId => ({
        event_id: id,
        person_id: personId
      }))

      await supabase
        .from('event_participants')
        .insert(participants)
    }
  }
}

export const deleteEvent = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// CRUD pour les rappels
export const getReminders = async (): Promise<Reminder[]> => {
  const { data } = await supabase
    .from('reminders')
    .select('*')
    .order('created_at', { ascending: false })

  return (data || []).map((reminder: any) => ({
    ...reminder,
    startDate: reminder.start_date,
    endDate: reminder.end_date,
    byCall: reminder.by_call,
    byWhatsapp: reminder.by_whatsapp,
    skippedDates: reminder.skipped_dates || [],
    doneDates: reminder.done_dates || [],
    createdAt: reminder.created_at
  })) as Reminder[]
}

export const createReminder = async (reminder: Omit<Reminder, 'id' | 'createdAt'>): Promise<Reminder> => {
  const { data, error } = await supabase
    .from('reminders')
    .insert({
      person_id: reminder.personId,
      title: reminder.title,
      kind: reminder.kind,
      note: reminder.note,
      start_date: reminder.startDate,
      end_date: reminder.endDate,
      by_call: reminder.byCall,
      by_whatsapp: reminder.byWhatsapp,
      skipped_dates: reminder.skippedDates,
      done_dates: reminder.doneDates
    })
    .select()
    .single()

  if (error) throw error

  return {
    ...data,
    personId: data.person_id,
    startDate: data.start_date,
    endDate: data.end_date,
    byCall: data.by_call,
    byWhatsapp: data.by_whatsapp,
    skippedDates: data.skipped_dates || [],
    doneDates: data.done_dates || [],
    createdAt: data.created_at
  } as Reminder
}

export const updateReminder = async (id: string, updates: Partial<Reminder>): Promise<void> => {
  const { error } = await supabase
    .from('reminders')
    .update({
      title: updates.title,
      kind: updates.kind,
      note: updates.note,
      start_date: updates.startDate,
      end_date: updates.endDate,
      by_call: updates.byCall,
      by_whatsapp: updates.byWhatsapp,
      skipped_dates: updates.skippedDates,
      done_dates: updates.doneDates
    })
    .eq('id', id)

  if (error) throw error
}

export const deleteReminder = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// CRUD pour les présences
export const getAttendances = async (): Promise<Attendance[]> => {
  const { data } = await supabase
    .from('attendances')
    .select('*')
    .order('created_at', { ascending: false })

  return (data || []).map((attendance: any) => ({
    ...attendance,
    eventId: attendance.event_id,
    personId: attendance.person_id,
    createdAt: attendance.created_at
  })) as Attendance[]
}

export const createAttendance = async (attendance: Omit<Attendance, 'id' | 'createdAt'>): Promise<Attendance> => {
  const { data, error } = await supabase
    .from('attendances')
    .insert({
      event_id: attendance.eventId,
      person_id: attendance.personId
    })
    .select()
    .single()

  if (error) throw error

  return {
    ...data,
    eventId: data.event_id,
    personId: data.person_id,
    createdAt: data.created_at
  } as Attendance
}

export const deleteAttendance = async (eventId: string, personId: string): Promise<void> => {
  const { error } = await supabase
    .from('attendances')
    .delete()
    .eq('event_id', eventId)
    .eq('person_id', personId)

  if (error) throw error
}

// Paramètres généraux
export const getGeneralActive = async (): Promise<boolean> => {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'general_active')
    .single()

  return data?.value === 'true'
}

export const saveGeneralActive = async (value: boolean): Promise<void> => {
  await supabase
    .from('settings')
    .upsert({
      key: 'general_active',
      value: value.toString()
    })
}

export const getGeneralHidden = async (): Promise<boolean> => {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'general_hidden')
    .single()

  return data?.value === 'true'
}

export const saveGeneralHidden = async (value: boolean): Promise<void> => {
  await supabase
    .from('settings')
    .upsert({
      key: 'general_hidden',
      value: value.toString()
    })
}

export const getGeneralDismissed = async (): Promise<string[]> => {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'general_dismissed')
    .single()

  try {
    return data?.value ? JSON.parse(data.value) : []
  } catch {
    return []
  }
}

export const saveGeneralDismissed = async (ids: string[]): Promise<void> => {
  await supabase
    .from('settings')
    .upsert({
      key: 'general_dismissed',
      value: JSON.stringify(ids)
    })
}

export const resetGeneralDismissed = async (): Promise<void> => {
  await supabase
    .from('settings')
    .delete()
    .eq('key', 'general_dismissed')
}
