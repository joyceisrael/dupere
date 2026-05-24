import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Bell, Phone, MessageCircle, Trash2, Check, X, HandHeart, Users, RotateCcw, EyeOff, Eye, StopCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getReminders, saveReminders, getPersons, uid,
  getGeneralDismissed, saveGeneralDismissed, resetGeneralDismissed,
  getGeneralActive, saveGeneralActive, getGeneralHidden, saveGeneralHidden,
  type Reminder, type Person, type ReminderKind,
} from "@/lib/simple-auth-storage";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

const KIND_LABEL: Record<ReminderKind, string> = {
  engagement: "Engagement", call: "Appel", visit: "Visite", prayer: "Prière", other: "Autre",
};
const KIND_COLOR: Record<ReminderKind, string> = {
  engagement: "bg-primary/20 text-primary",
  call: "bg-accent/20 text-accent",
  visit: "bg-success/20 text-success",
  prayer: "bg-primary-glow/20 text-primary-glow",
  other: "bg-muted text-muted-foreground",
};
const NEEDS_TITLE: ReminderKind[] = ["engagement", "other"];

export default function Reminders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [open, setOpen] = useState(false);
  const [generalActive, setGeneralActive] = useState(false);
  const [generalHidden, setGeneralHidden] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    const saved = localStorage.getItem('generalDismissed');
    return saved ? JSON.parse(saved) : [];
  });
  const dismissedRef = useRef(dismissed);

  // Update ref when dismissed changes
  useEffect(() => {
    dismissedRef.current = dismissed;
  }, [dismissed]);

  const [form, setForm] = useState({
    personId: "", kind: "engagement" as ReminderKind, title: "", note: "",
    startDate: new Date().toISOString().slice(0, 10),
    byCall: false, byWhatsapp: false,
  });

  // Sync session state
  const [syncSessionId, setSyncSessionId] = useState<string | null>(null);
  const [syncActive, setSyncActive] = useState(false);
  const [syncMode, setSyncMode] = useState<"all" | "single">("all");
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // React Query for persons
  const { data: persons = [] } = useQuery({
    queryKey: ['persons'],
    queryFn: async () => {
      const { data, error } = await supabase.from('persons').select('*');
      if (error) {
        console.error('Error fetching persons:', error);
        return []; // Return empty array instead of throwing error
      }
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
    },
    retry: 1,
    retryDelay: 1000
  });

  useEffect(() => {
    setGeneralActive(getGeneralActive());
    setGeneralHidden(getGeneralHidden());
    setDismissed(getGeneralDismissed());

    // Load available users for sync
    const loadUsers = async () => {
      const { data, error } = await supabase.from('users').select('id, full_name');
      if (!error && data) {
        setAvailableUsers(data);
      }
    };
    loadUsers();

    // Load active sync session for current user
    const loadActiveSyncSession = async () => {
      const { data, error } = await supabase
        .from('reminder_sync_sessions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0 && data[0].is_active) {
        setSyncSessionId(data[0].id);
        setSyncActive(true);
        
        // Add current user as participant if not already
        const { data: existingParticipant } = await supabase
          .from('reminder_sync_participants')
          .select('*')
          .eq('session_id', data[0].id)
          .eq('user_id', user?.id);
        
        if (!existingParticipant || existingParticipant.length === 0) {
          if (user?.id) {
            await supabase.from('reminder_sync_participants').insert({
              session_id: data[0].id,
              user_id: user.id
            });
          }
        }
      }
    };
    loadActiveSyncSession();

    // Load reminders from Supabase only
    const loadReminders = async () => {
      const { data, error } = await supabase.from('reminders').select('*');
      if (error) {
        console.error('Error loading reminders from Supabase:', error);
        setReminders([]);
      } else if (data) {
        // Convert Supabase format to local format
        const converted = data.map((r: any) => ({
          id: r.id,
          personId: r.person_id,
          kind: r.kind,
          title: r.title,
          note: r.note,
          startDate: r.start_date,
          byCall: r.by_call,
          byWhatsapp: r.by_whatsapp,
          skippedDates: r.skipped_dates || [],
          doneDates: r.done_dates || [],
          createdAt: r.created_at
        }));
        setReminders(converted);
      }
    };

    loadReminders();

    // Setup Supabase Realtime subscription for reminders
    const remindersChannel = supabase
      .channel('reminders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminders'
        },
        async (payload) => {
          console.log('Reminder change received:', payload);
          // Reload reminders from Supabase when changes occur
          const { data } = await supabase.from('reminders').select('*');
          if (data) {
            const converted = data.map((r: any) => ({
              id: r.id,
              personId: r.person_id,
              kind: r.kind,
              title: r.title,
              note: r.note,
              startDate: r.start_date,
              byCall: r.by_call,
              byWhatsapp: r.by_whatsapp,
              skippedDates: r.skipped_dates || [],
              doneDates: r.done_dates || [],
              createdAt: r.created_at
            }));
            setReminders(converted);
          }
        }
      )
      .subscribe();

    // Setup Supabase Realtime subscription for persons
    const personsChannel = supabase
      .channel('persons-reminders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'persons' }, () => {
        queryClient.invalidateQueries({ queryKey: ['persons'] });
      })
      .subscribe();

    // Setup Supabase Realtime subscription for sync sessions
    const syncSessionsChannel = supabase
      .channel('sync_sessions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminder_sync_sessions' }, async (payload) => {
        console.log('Sync session change received:', payload);
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const session = payload.new;
          if (session.is_active) {
            setSyncSessionId(session.id);
            setSyncActive(true);
          } else {
            setSyncSessionId(null);
            setSyncActive(false);
          }
        } else if (payload.eventType === 'DELETE') {
          setSyncSessionId(null);
          setSyncActive(false);
        }
      })
      .subscribe();

    // Setup Supabase Realtime subscription for sync actions
    const syncActionsChannel = supabase
      .channel('sync_actions_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reminder_sync_actions' }, async (payload) => {
        console.log('Sync action received:', payload);
        console.log('Current syncSessionId:', syncSessionId);
        const action = payload.new;

        // Process actions from current sync session
        if (action.session_id === syncSessionId) {
          console.log('Processing action from current session:', action.action_type);
          if (action.action_type === 'mark_done' && action.person_id) {
            console.log('Marking person as done:', action.person_id);
            console.log('Current dismissed array:', dismissedRef.current);
            // For general reminder, dismiss the person (avoid duplicates)
            if (!dismissedRef.current.includes(action.person_id)) {
              const next = [...dismissedRef.current, action.person_id];
              console.log('Adding to dismissed:', next);
              setDismissed(next);
              saveGeneralDismissed(next);
              toast.success("Personne marquée comme faite (synchronisé).");
            } else {
              console.log('Person already dismissed, skipping');
            }
          } else if (action.action_type === 'stop_session') {
            console.log('Stopping session from sync');
            // Stop general reminder
            setGeneralActive(false);
            saveGeneralActive(false);
            setGeneralHidden(false);
            saveGeneralHidden(false);
            toast.info("Session synchronisée arrêtée par un autre appareil.");
          } else if (action.action_type === 'restart') {
            console.log('Restarting general from sync');
            // Restart general reminder
            setGeneralActive(true);
            saveGeneralActive(true);
            setGeneralHidden(false);
            saveGeneralHidden(false);
            toast.info("Session synchronisée redémarrée par un autre appareil.");
          }
        } else {
          console.log('Ignoring action from different session:', action.session_id, 'current:', syncSessionId);
        }
      })
      .subscribe((status) => {
        console.log('Sync actions subscription status:', status);
      });

    return () => {
      supabase.removeChannel(remindersChannel);
      supabase.removeChannel(personsChannel);
      supabase.removeChannel(syncSessionsChannel);
      supabase.removeChannel(syncActionsChannel);
    };
  }, [queryClient, syncSessionId]);

  const today = new Date().toDateString();
  const sorted = useMemo(
    () => [...reminders].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [reminders]
  );

  const visibleGeneral = useMemo(
    () => persons.filter(p => !dismissed.includes(p.id)),
    [persons, dismissed]
  );

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('add function called');
    console.log('form:', form);
    if (!form.personId) {
      console.log('No personId selected');
      return toast.error("Choisir un fidèle.");
    }
    const needsTitle = NEEDS_TITLE.includes(form.kind);
    const finalTitle = needsTitle ? form.title.trim() : KIND_LABEL[form.kind];
    if (needsTitle && !finalTitle) {
      console.log('No title provided');
      return toast.error("Titre / engagement précis requis.");
    }
    const r: Reminder = {
      id: uid(), personId: form.personId, kind: form.kind, title: finalTitle,
      note: form.note.trim() || undefined, startDate: new Date(form.startDate).toISOString(),
      byCall: form.byCall, byWhatsapp: form.byWhatsapp,
      skippedDates: [], doneDates: [], createdAt: new Date().toISOString(),
    };

    console.log('Creating reminder:', r);

    // Save to Supabase
    const { error } = await supabase.from('reminders').insert({
      id: r.id,
      person_id: r.personId,
      kind: r.kind,
      title: r.title,
      note: r.note,
      start_date: r.startDate,
      by_call: r.byCall,
      by_whatsapp: r.byWhatsapp,
      skipped_dates: r.skippedDates,
      done_dates: r.doneDates,
      created_at: r.createdAt,
      updated_at: new Date().toISOString()
    });

    if (error) {
      console.error('Error saving to Supabase:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return toast.error("Erreur lors de la sauvegarde.");
    }

    console.log('Reminder saved successfully');
    const next = [r, ...reminders];
    setReminders(next);
    setOpen(false);
    setForm({ personId: "", kind: "engagement", title: "", note: "", startDate: new Date().toISOString().slice(0, 10), byCall: false, byWhatsapp: false });
    toast.success("Rappel créé.");
  };

  const markDone = async (id: string) => {
    console.log('markDone called with id:', id, 'syncActive:', syncActive, 'syncSessionId:', syncSessionId);
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;

    const today = new Date().toDateString();
    const { error } = await supabase.from('reminders').update({
      done_dates: [...reminder.doneDates, today],
      updated_at: new Date().toISOString()
    }).eq('id', id);

    if (error) {
      console.error('Error updating reminder:', error);
      return toast.error("Erreur lors de la mise à jour.");
    }

    const next = reminders.map(r => r.id === id ? { ...r, doneDates: [...r.doneDates, today] } : r);
    setReminders(next);
    
    // Broadcast mark done action if sync is active
    if (syncActive && syncSessionId) {
      console.log('Broadcasting mark_done action for person:', reminder.personId, 'session:', syncSessionId);
      const { error: syncError } = await supabase.from('reminder_sync_actions').insert({
        session_id: syncSessionId,
        person_id: reminder.personId,
        action_type: 'mark_done',
        performed_by: user?.id
      });
      if (syncError) {
        console.error('Error broadcasting sync action:', syncError);
      } else {
        console.log('Sync action broadcasted successfully');
      }
    } else {
      console.log('Sync not active or no session ID, skipping broadcast');
    }
    
    toast.success("Rappel marqué comme fait.");
  };
  const skip = async (id: string) => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;

    const { error } = await supabase.from('reminders').update({
      skipped_dates: [...reminder.skippedDates, today],
      updated_at: new Date().toISOString()
    }).eq('id', id);

    if (error) {
      console.error('Error updating reminder:', error);
      return toast.error("Erreur lors de la mise à jour.");
    }

    const next = reminders.map(r => r.id === id ? { ...r, skippedDates: [...r.skippedDates, today] } : r);
    setReminders(next);
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from('reminders').delete().eq('id', id);

    if (error) {
      console.error('Error deleting reminder:', error);
      return toast.error("Erreur lors de la suppression.");
    }

    const next = reminders.filter(r => r.id !== id);
    setReminders(next);
    toast.success("Rappel supprimé.");
  };

  const callPerson = (phone?: string) => {
    if (!phone) return toast.error("Aucun numéro.");
    window.location.href = `tel:${phone}`;
  };
  const openWhatsApp = (phone?: string) => {
    if (!phone) return toast.error("Aucun numéro.");
    window.open(`https://wa.me/${phone.replace(/\D/g, "")}`, "_blank");
  };

  const startGeneral = async () => {
    resetGeneralDismissed();
    setDismissed([]);
    setGeneralActive(true); saveGeneralActive(true);
    
    // Broadcast restart action if sync is active
    if (syncActive && syncSessionId) {
      console.log('Broadcasting restart action, session:', syncSessionId);
      await supabase.from('reminder_sync_actions').insert({
        session_id: syncSessionId,
        action_type: 'restart',
        performed_by: user?.id
      });
    }
    setGeneralHidden(false); saveGeneralHidden(false);
    toast.success(`Rappel général lancé · ${persons.length} contact(s).`);
  };

  const hideGeneral = () => {
    setGeneralHidden(true); saveGeneralHidden(true);
    toast.info("Rappel général masqué (les contacts marqués 'Fait' sont conservés).");
  };
  const revealGeneral = () => {
    setGeneralHidden(false); saveGeneralHidden(false);
  };
  const stopGeneral = async () => {
    setGeneralActive(false); saveGeneralActive(false);
    setGeneralHidden(false); saveGeneralHidden(false);
    resetGeneralDismissed();
    setDismissed([]);
    
    // Broadcast stop action if sync is active
    if (syncActive && syncSessionId) {
      await supabase.from('reminder_sync_actions').insert({
        session_id: syncSessionId,
        action_type: 'stop_session',
        performed_by: user?.id
      });
    }
    
    toast.success("Rappel général arrêté.");
  };

  const dismissGeneral = async (personId: string) => {
    console.log('dismissGeneral called with personId:', personId, 'syncActive:', syncActive, 'syncSessionId:', syncSessionId);
    
    // Don't process if already dismissed
    if (dismissed.includes(personId)) {
      console.log('Person already dismissed, skipping');
      return;
    }
    
    const next = [...dismissed, personId];
    setDismissed(next);
    saveGeneralDismissed(next);
    
    // Broadcast dismiss action if sync is active
    if (syncActive && syncSessionId) {
      console.log('Broadcasting dismiss action for person:', personId, 'session:', syncSessionId);
      const { error: syncError } = await supabase.from('reminder_sync_actions').insert({
        session_id: syncSessionId,
        person_id: personId,
        action_type: 'mark_done',
        performed_by: user?.id
      });
      if (syncError) {
        console.error('Error broadcasting sync action:', syncError);
      } else {
        console.log('Sync action broadcasted successfully');
      }
    } else {
      console.log('Sync not active or no session ID, skipping broadcast');
    }
  };

  // Sync functions
  const startSyncSession = async () => {
    if (!user?.id) return toast.error("Vous devez être connecté.");
    
    // Check if there's already an active session
    const { data: existingSession } = await supabase
      .from('reminder_sync_sessions')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingSession) {
      // Join existing session
      setSyncSessionId(existingSession.id);
      setSyncActive(true);
      
      // Add current user as participant if not already
      const { data: existingParticipant } = await supabase
        .from('reminder_sync_participants')
        .select('*')
        .eq('session_id', existingSession.id)
        .eq('user_id', user.id);
      
      if (!existingParticipant || existingParticipant.length === 0) {
        await supabase.from('reminder_sync_participants').insert({
          session_id: existingSession.id,
          user_id: user.id
        });
      }

      setSyncDialogOpen(false);
      toast.success(`Rejoint la session existante: ${existingSession.session_name}`);
      return;
    }
    
    // Create new session
    const sessionName = syncMode === "all" 
      ? "Session globale" 
      : `Session avec ${availableUsers.find(u => u.id === selectedUserId)?.full_name || 'utilisateur'}`;
    
    const { data, error } = await supabase.from('reminder_sync_sessions').insert({
      session_name: sessionName,
      created_by: user.id,
      is_active: true
    }).select().single();

    if (error) {
      console.error('Error creating sync session:', error);
      return toast.error("Erreur lors de la création de la session.");
    }

    setSyncSessionId(data.id);
    setSyncActive(true);
    
    // Add current user as participant
    await supabase.from('reminder_sync_participants').insert({
      session_id: data.id,
      user_id: user.id
    });

    // If single mode, add selected user as participant
    if (syncMode === "single" && selectedUserId) {
      await supabase.from('reminder_sync_participants').insert({
        session_id: data.id,
        user_id: selectedUserId
      });
    }

    setSyncDialogOpen(false);
    toast.success(`Session de synchronisation démarrée: ${sessionName}`);
  };

  const stopSyncSession = async () => {
    if (!syncSessionId) return;

    const { error } = await supabase.from('reminder_sync_sessions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', syncSessionId);

    if (error) {
      console.error('Error stopping sync session:', error);
      return toast.error("Erreur lors de l'arrêt de la session.");
    }

    setSyncSessionId(null);
    setSyncActive(false);
    toast.success("Session de synchronisation arrêtée.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Rappels</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Engagements, appels, visites — gardez vos brebis dans la prière.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!syncActive && (
            <Button onClick={() => setSyncDialogOpen(true)} variant="outline" className="border-success/40 text-success">
              <RefreshCw className="w-4 h-4 mr-2" /> Synchroniser
            </Button>
          )}
          {syncActive && (
            <Button onClick={stopSyncSession} variant="outline" className="border-destructive/40 text-destructive">
              <StopCircle className="w-4 h-4 mr-2" /> Arrêter sync
            </Button>
          )}
          {!generalActive && (
            <Button onClick={startGeneral} className="bg-gradient-to-r from-accent to-primary">
              <Users className="w-4 h-4 mr-2" /> Rappel général
            </Button>
          )}
          {generalActive && generalHidden && (
            <Button onClick={revealGeneral} variant="outline" className="border-accent/40">
              <Eye className="w-4 h-4 mr-2" /> Dévoiler le rappel général
            </Button>
          )}
          {generalActive && (
            <Button onClick={stopGeneral} variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10">
              <StopCircle className="w-4 h-4 mr-2" /> Arrêter
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-divine hover:shadow-divine">
                <Plus className="w-4 h-4 mr-2" /> Rappel précis
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-border/50 max-w-lg">
              <DialogHeader><DialogTitle className="font-display text-2xl">Créer un rappel précis</DialogTitle></DialogHeader>
              <form onSubmit={add} className="space-y-4">
                <div className="space-y-2">
                  <Label>Fidèle</Label>
                  <Select value={form.personId} onValueChange={(v) => setForm({ ...form, personId: v })}>
                    <SelectTrigger><SelectValue placeholder="Choisir un fidèle" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {persons.map(p => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as ReminderKind })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(KIND_LABEL) as ReminderKind[]).map(k => (
                          <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                  </div>
                </div>
                {NEEDS_TITLE.includes(form.kind) && (
                  <div className="space-y-2 animate-fade-in">
                    <Label>Titre / engagement précis</Label>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Ex: Engagement de la dîme du mois" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Note</Label>
                  <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="Détails complémentaires..." />
                </div>
                <div className="flex gap-4 p-3 rounded-xl bg-muted/30 border border-border/40">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox checked={form.byCall} onCheckedChange={(v) => setForm({ ...form, byCall: !!v })} />
                    <Phone className="w-3.5 h-3.5" /> Appel
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox checked={form.byWhatsapp} onCheckedChange={(v) => setForm({ ...form, byWhatsapp: !!v })} />
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </label>
                </div>
                <Button type="submit" className="w-full bg-gradient-divine">Créer</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {generalActive && !generalHidden && (
        <section className="glass-strong rounded-3xl p-6 animate-fade-in-up space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-accent" /> Rappel général
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {visibleGeneral.length} sur {persons.length} restant(s)
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={hideGeneral}>
                <EyeOff className="w-4 h-4 mr-1" /> Masquer
              </Button>
              <Button variant="ghost" size="sm" onClick={stopGeneral} className="text-destructive">
                <StopCircle className="w-4 h-4 mr-1" /> Arrêter
              </Button>
            </div>
          </div>
          {visibleGeneral.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <HandHeart className="w-10 h-10 mx-auto text-success" />
              <p className="text-sm text-muted-foreground">Tous les contacts ont été traités 🙏</p>
              <Button onClick={startGeneral} variant="outline" size="sm">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Recommencer
              </Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleGeneral.map((p, i) => (
                <div key={p.id} className="glass rounded-xl p-4 animate-fade-in-up"
                  style={{ animationDelay: `${i * 20}ms`, animationFillMode: "backwards" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-divine flex items-center justify-center font-bold text-primary-foreground text-xs shrink-0">
                      {p.fullName ? p.fullName.split(" ").map(s => s[0]).slice(0, 2).join("") : "??"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{p.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.phone ?? "—"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={() => callPerson(p.phone)} className="border-accent/40 hover:bg-accent/10">
                      <Phone className="w-3 h-3 mr-1" /> Appel
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openWhatsApp(p.phone)} className="border-success/40 text-success hover:bg-success/10">
                      <MessageCircle className="w-3 h-3 mr-1" /> WA
                    </Button>
                  </div>
                  <Button size="sm" onClick={() => dismissGeneral(p.id)} className="w-full mt-2 bg-gradient-divine">
                    <Check className="w-3 h-3 mr-1" /> Fait
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div>
        <h2 className="font-display text-xl font-bold mb-3">Rappels précis</h2>
        {sorted.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center space-y-3">
            <HandHeart className="w-12 h-12 mx-auto text-primary opacity-60" />
            <p className="text-muted-foreground">Aucun rappel précis pour l'instant.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {sorted.map((r, i) => {
              const p = persons.find(x => x.id === r.personId);
              const done = r.doneDates.includes(today);
              return (
                <div key={r.id}
                  className={`glass rounded-2xl p-5 hover:shadow-divine transition-all animate-fade-in-up ${done ? "opacity-60" : ""}`}
                  style={{ animationDelay: `${i * 40}ms`, animationFillMode: "backwards" }}>
                  <div className="flex items-start justify-between mb-3">
                    <span className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full ${KIND_COLOR[r.kind]}`}>
                      {KIND_LABEL[r.kind]}
                    </span>
                    <button onClick={() => remove(r.id)} className="p-1 rounded hover:bg-destructive/15 hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h3 className="font-display text-lg font-bold leading-tight">{r.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{p?.fullName ?? "—"}</p>
                  {r.note && <p className="text-xs text-muted-foreground mt-2 italic">"{r.note}"</p>}
                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                    <Bell className="w-3.5 h-3.5" />
                    {new Date(r.startDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {r.byCall && (
                      <Button size="sm" variant="outline" onClick={() => callPerson(p?.phone)} className="border-accent/40 hover:bg-accent/10">
                        <Phone className="w-3.5 h-3.5 mr-1.5" /> Appeler
                      </Button>
                    )}
                    {(r.byWhatsapp || p?.phone) && (
                      <Button size="sm" variant="outline" onClick={() => openWhatsApp(p?.phone)} className="border-success/40 hover:bg-success/10 text-success">
                        <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> WhatsApp
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/30">
                    {!done ? (
                      <Button size="sm" onClick={() => markDone(r.id)} className="flex-1 bg-gradient-divine">
                        <Check className="w-3.5 h-3.5 mr-1.5" /> Fait
                      </Button>
                    ) : (
                      <p className="flex-1 text-xs text-success flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Complété aujourd'hui</p>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => skip(r.id)}>
                      <X className="w-3.5 h-3.5 mr-1.5" /> Passer
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sync Dialog */}
      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent className="glass-strong border-border/50">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Synchroniser la session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mode de synchronisation</Label>
              <Select value={syncMode} onValueChange={(v: "all" | "single") => setSyncMode(v)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les appareils connectés</SelectItem>
                  <SelectItem value="single">Un appareil spécifique</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {syncMode === "single" && (
              <div>
                <Label>Choisir l'appareil</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Sélectionner un utilisateur" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.filter(u => u.id !== user?.id).map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2 pt-4">
              <Button onClick={startSyncSession} className="flex-1 bg-gradient-divine">
                <RefreshCw className="w-4 h-4 mr-2" /> Démarrer sync
              </Button>
              <Button onClick={() => setSyncDialogOpen(false)} variant="outline">
                Annuler
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
