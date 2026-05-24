import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Phone, MessageCircle, Trash2, MapPin, X, Sparkles, BookOpen, Calendar as CalendarIcon, Star, HelpCircle, FileDown } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPersons, savePersons, getEvents, uid, type Person, type PersonOrigin } from "@/lib/simple-auth-storage";
import { supabase } from "@/lib/supabase";
import { useSearch } from "@/hooks/use-search";
import { exportToPdf } from "@/lib/exports";
import { cn } from "@/lib/utils";

const ORIGIN_LABELS: Record<PersonOrigin, string> = {
  culte: "Culte",
  evangelism: "Évangélisation",
  activite: "Activité",
  autre: "Autre",
};
const ORIGIN_COLORS: Record<PersonOrigin, string> = {
  culte: "bg-primary/15 text-primary",
  evangelism: "bg-success/15 text-success",
  activite: "bg-accent/15 text-accent",
  autre: "bg-muted text-muted-foreground",
};

export default function Persons() {
  const queryClient = useQueryClient();
  const { query, setQuery } = useSearch();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ fullName: string; phone: string; address: string; origin: PersonOrigin; registrationDate: Date | undefined; linkedEventId: string }>({
    fullName: "", phone: "+243 ", address: "", origin: "culte", registrationDate: undefined, linkedEventId: "",
  });
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // React Query for persons
  const { data: persons = [] } = useQuery({
    queryKey: ['persons'],
    queryFn: async () => {
      const { data, error } = await supabase.from('persons').select('*');
      if (error) {
        console.error('Error fetching persons:', error);
        return []; // Return empty array instead of throwing error
      }
      console.log('Fetched persons from Supabase:', data);
      console.log('Number of persons:', data.length);
      const mapped = data.map((p: any) => ({
        id: p.id,
        fullName: p.full_name,
        phone: p.phone,
        address: p.address,
        origin: p.origin,
        registrationDate: p.registration_date,
        linkedEventId: p.linked_event_id,
        createdAt: p.created_at
      }));
      console.log('Mapped persons:', mapped);
      return mapped;
    }
  });

  // React Query for events
  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('*');
      if (error) throw error;
      return data.map((e: any) => ({
        id: e.id,
        title: e.title,
        type: e.type,
        date: e.date,
        location: e.location,
        description: e.description,
        posterDataUrl: e.poster,
        groupId: e.group_id,
        participantIds: e.participant_ids || [],
        attendeeCount: e.attendee_count
      }));
    }
  });

  // Realtime subscription
  useEffect(() => {
    const personsChannel = supabase
      .channel('persons-react-query')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'persons' }, () => {
        queryClient.invalidateQueries({ queryKey: ['persons'] });
      })
      .subscribe();

    const eventsChannel = supabase
      .channel('events-react-query')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        queryClient.invalidateQueries({ queryKey: ['events'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(personsChannel);
      supabase.removeChannel(eventsChannel);
    };
  }, [queryClient]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return persons;
    return persons.filter(p =>
      p.fullName.toLowerCase().includes(q) ||
      (p.phone ?? "").includes(q) ||
      (p.address ?? "").toLowerCase().includes(q)
    );
  }, [persons, query]);

  // Events matching selected origin
  const matchingEvents = useMemo(() => {
    const typeMap: Record<string, string> = { culte: "thursday", evangelism: "evangelism", activite: "activity" };
    const eventType = typeMap[form.origin];
    console.log('Selected origin:', form.origin, 'Event type:', eventType);
    console.log('All events:', events);
    if (!eventType) return [];
    const filtered = events.filter(e => e.type === eventType);
    console.log('Matching events:', filtered);
    return filtered;
  }, [events, form.origin]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = form.fullName.trim();
    if (!fullName) return toast.error("Le nom complet est obligatoire.");
    if (persons.some(p => p.fullName.toLowerCase() === fullName.toLowerCase())) {
      return toast.error("Cette personne existe déjà.");
    }
    const next: Person = {
      id: uid(),
      fullName,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      origin: form.origin,
      registrationDate: form.registrationDate?.toISOString(),
      linkedEventId: form.linkedEventId || undefined,
      createdAt: new Date().toISOString(),
    };

    // Save to Supabase
    const { error } = await supabase.from('persons').insert({
      id: next.id,
      full_name: next.fullName,
      phone: next.phone,
      address: next.address,
      origin: next.origin,
      registration_date: next.registrationDate,
      linked_event_id: next.linkedEventId,
      created_at: next.createdAt
    });

    if (error) {
      console.error('Error adding person to Supabase:', error);
      toast.error("Erreur lors de l'ajout.");
      return;
    }

    // Invalidate React Query cache
    queryClient.invalidateQueries({ queryKey: ['persons'] });
    setForm({ fullName: "", phone: "+243 ", address: "", origin: "culte", registrationDate: undefined, linkedEventId: "" });
    setOpen(false);
    toast.success(`${fullName} ajouté(e).`);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('persons').delete().eq('id', id);

    if (error) {
      console.error('Error deleting person from Supabase:', error);
      toast.error("Erreur lors de la suppression.");
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['persons'] });
    toast.success("Personne supprimée.");
  };

  const startEdit = (person: Person) => {
    setEditingPerson(person);
    setForm({
      fullName: person.fullName,
      phone: person.phone || "+243 ",
      address: person.address || "",
      origin: person.origin || "culte",
      registrationDate: person.registrationDate ? new Date(person.registrationDate) : undefined,
      linkedEventId: person.linkedEventId || "",
    });
    setEditOpen(true);
  };

  const update = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson) return;

    const fullName = form.fullName.trim();
    if (!fullName) return toast.error("Le nom complet est obligatoire.");

    if (persons.some(p => p.fullName.toLowerCase() === fullName.toLowerCase() && p.id !== editingPerson.id)) {
      return toast.error("Une autre personne existe déjà avec ce nom.");
    }

    const updated: Person = {
      ...editingPerson,
      fullName,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      origin: form.origin,
      registrationDate: form.registrationDate?.toISOString(),
      linkedEventId: form.linkedEventId || undefined,
    };

    // Update in Supabase
    const { error } = await supabase.from('persons').update({
      full_name: updated.fullName,
      phone: updated.phone,
      address: updated.address,
      origin: updated.origin,
      registration_date: updated.registrationDate,
      linked_event_id: updated.linkedEventId
    }).eq('id', editingPerson.id);

    if (error) {
      console.error('Error updating person in Supabase:', error);
      return toast.error("Erreur lors de la mise à jour.");
    }

    queryClient.invalidateQueries({ queryKey: ['persons'] });
    setEditOpen(false);
    setEditingPerson(null);
    setForm({ fullName: "", phone: "+243 ", address: "", origin: "culte", registrationDate: undefined, linkedEventId: "" });
    toast.success(`${fullName} modifié(e).`);
  };

  const waLink = (phone?: string) =>
    phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : "#";

  const exportPersons = (kind: "pdf" | "xlsx") => {
    const rows = persons.map(p => ({
      Nom: p.fullName,
      Téléphone: p.phone ?? "",
      Quartier: p.address ?? "",
      Source: p.origin ? ORIGIN_LABELS[p.origin] : "",
      "Date d'enregistrement": p.registrationDate ? new Date(p.registrationDate).toLocaleDateString("fr-FR") : "",
    }));
    if (kind === "xlsx") {
      // Excel export disabled
      return;
    } else {
      exportToPdf("personnes", "Liste des personnes", [{
        heading: `${persons.length} personne(s) enregistrée(s)`,
        head: ["Nom", "Téléphone", "Quartier", "Source", "Date d'enregistrement"],
        body: rows.map(r => [r.Nom, r.Téléphone, r.Quartier, r.Source, r["Date d'enregistrement"]]),
      }]);
    }
    toast.success("Export généré.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Personnes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {persons.length} personne{persons.length > 1 ? "s" : ""} enregistrée{persons.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportPersons("pdf")}>
            <FileDown className="w-4 h-4 mr-1.5" /> PDF
          </Button>
          <Dialog open={open || editOpen} onOpenChange={(isOpen) => {
    setOpen(isOpen);
    setEditOpen(isOpen);
    if (!isOpen) {
      setEditingPerson(null);
      setForm({ fullName: "", phone: "+243 ", address: "", origin: "culte", registrationDate: undefined, linkedEventId: "" });
    }
  }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-divine hover:shadow-divine">
                <Plus className="w-4 h-4 mr-2" /> Nouvelle personne
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-border/50 max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">
                  {editingPerson ? "Modifier une personne" : "Ajouter une personne"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={editingPerson ? update : add} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nom complet <span className="text-primary">*</span></Label>
                  <Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="Marie Mbuyi" required />
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+243 81..." />
              </div>
              <div className="space-y-2">
                <Label>Adresse</Label>
                <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Quartier (Gombe, Lemba...)" />
              </div>

              {/* Date d'enregistrement */}
              <div className="space-y-2">
                <Label>Date d'enregistrement</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.registrationDate && "text-muted-foreground")}>
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {form.registrationDate ? format(form.registrationDate, "PPP", { locale: fr }) : "Choisir une date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.registrationDate} onSelect={(d) => setForm({ ...form, registrationDate: d })}
                      className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Source d'enregistrement <span className="text-primary">*</span></Label>
                <RadioGroup
                  value={form.origin}
                  onValueChange={(v) => setForm({ ...form, origin: v as PersonOrigin, linkedEventId: "" })}
                  className="grid grid-cols-2 gap-3"
                >
                  <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${form.origin === "culte" ? "border-primary bg-primary/10" : "border-border/40 hover:border-primary/40"}`}>
                    <RadioGroupItem value="culte" id="r-culte" />
                    <BookOpen className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Culte</span>
                  </label>
                  <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${form.origin === "evangelism" ? "border-success bg-success/10" : "border-border/40 hover:border-success/40"}`}>
                    <RadioGroupItem value="evangelism" id="r-evang" />
                    <Sparkles className="w-4 h-4 text-success" />
                    <span className="text-sm font-medium">Évangélisation</span>
                  </label>
                  <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${form.origin === "activite" ? "border-accent bg-accent/10" : "border-border/40 hover:border-accent/40"}`}>
                    <RadioGroupItem value="activite" id="r-act" />
                    <Star className="w-4 h-4 text-accent" />
                    <span className="text-sm font-medium">Activité</span>
                  </label>
                  <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${form.origin === "autre" ? "border-muted-foreground bg-muted/30" : "border-border/40 hover:border-muted-foreground/40"}`}>
                    <RadioGroupItem value="autre" id="r-autre" />
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Autre</span>
                  </label>
                </RadioGroup>
              </div>

              {/* Lier à un événement */}
              {matchingEvents.length > 0 && (
                <div className="space-y-2 animate-fade-in">
                  <Label>Lier à un événement (optionnel)</Label>
                  <Select value={form.linkedEventId} onValueChange={(v) => setForm({ ...form, linkedEventId: v })}>
                    <SelectTrigger><SelectValue placeholder="Choisir un événement..." /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {matchingEvents.map(ev => (
                        <SelectItem key={ev.id} value={ev.id}>
                          {ev.title} · {new Date(ev.date).toLocaleDateString("fr-FR")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button type="submit" className="w-full bg-gradient-divine">Enregistrer</Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher par nom, téléphone, quartier..."
          className="pl-10 h-12 bg-input/40 border-border/40"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-muted-foreground">Aucune personne trouvée.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p, i) => (
            <div
              key={p.id}
              className="glass rounded-2xl p-5 hover:shadow-divine hover:-translate-y-1 transition-all animate-fade-in-up"
              style={{ animationDelay: `${i * 30}ms`, animationFillMode: "backwards" }}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-divine flex items-center justify-center font-bold text-primary-foreground shrink-0">
                  {p.fullName ? p.fullName.split(" ").map(s => s[0]).slice(0, 2).join("") : "??"}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base leading-tight">{p.fullName}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", ORIGIN_COLORS[p.origin || "autre"])}>
                      {ORIGIN_LABELS[p.origin || "autre"]}
                    </span>
                    {p.registrationDate && (
                      <span>{new Date(p.registrationDate).toLocaleDateString("fr-FR")}</span>
                    )}
                  </div>
                  {p.phone && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      <span className="font-mono">{p.phone}</span>
                    </div>
                  )}
                  {p.address && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{p.address}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border/20">
                <button onClick={() => startEdit(p)} className="p-1.5 rounded hover:bg-primary/15 hover:text-primary transition-colors" aria-label="Modifier">
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(p.id)} className="p-1.5 rounded hover:bg-destructive/15 hover:text-destructive transition-colors" aria-label="Supprimer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {p.phone && (
                <a
                  href={waLink(p.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-success/15 text-success hover:bg-success/25 transition-colors text-sm font-medium"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
