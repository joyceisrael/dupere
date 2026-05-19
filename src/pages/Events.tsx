import { useRef, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, CalendarDays, Users, Trash2, ImageIcon, Upload, Edit, FileDown } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveEvents, uid, type AppEvent, type EventType } from "@/lib/simple-auth-storage";
import { supabase } from "@/lib/supabase";
import { exportToPdf } from "@/lib/exports";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<EventType, string> = {
  activity: "Activité", thursday: "Culte du jeudi", evangelism: "Évangélisation",
};
const TYPE_COLOR: Record<EventType, string> = {
  activity: "bg-accent/20 text-accent",
  thursday: "bg-primary/20 text-primary",
  evangelism: "bg-success/20 text-success",
};

export default function Events() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [type, setType] = useState<EventType>("activity");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [thursdayDates, setThursdayDates] = useState<Date[]>([]);
  const [poster, setPoster] = useState<string | undefined>();
  const [attendeeCount, setAttendeeCount] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // React Query for events
  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      console.log('Fetching events from Supabase');
      const { data, error } = await supabase.from('events').select('*');
      if (error) {
        console.error('Error fetching events:', error);
        throw error;
      }
      console.log('Events fetched from Supabase:', data.length, 'events');
      const mapped = data.map((e: any) => ({
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
      console.log('Events mapped:', mapped.length, 'events');
      return mapped;
    }
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase.channel('events-react-query')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        console.log('Realtime event change detected, invalidating events query');
        queryClient.invalidateQueries({ queryKey: ['events'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const onPickPoster = (f: File) => {
    if (f.size > 3 * 1024 * 1024) return toast.error("Affiche trop lourde (max 3 Mo).");
    const r = new FileReader();
    r.onload = () => setPoster(r.result as string);
    r.readAsDataURL(f);
  };

  const reset = () => {
    setTitle(""); setDate(""); setThursdayDates([]); setPoster(undefined); setType("activity"); setAttendeeCount(""); setEditId(null); setLoading(false);
  };

  const openEdit = (e: AppEvent) => {
    setEditId(e.id);
    setType(e.type);
    setTitle(e.title);
    setDate(e.date ? new Date(e.date).toISOString().slice(0, 16) : "");
    setPoster(e.posterDataUrl);
    setAttendeeCount(e.attendeeCount ?? "");
    setOpen(true);
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    console.log('add function called');
    console.log('title:', title, 'type:', type, 'date:', date, 'editId:', editId, 'thursdayDates:', thursdayDates);
    if (!title.trim()) {
      console.log('No title provided');
      return toast.error("Titre requis.");
    }

    setLoading(true);

    const count = attendeeCount === "" ? undefined : Number(attendeeCount);

    if (editId) {
      console.log('Updating existing event:', editId);

      // Build update data with only changed fields
      const updateData: any = { type };
      if (title.trim()) updateData.title = title.trim();
      if (type !== "thursday" && date) updateData.date = new Date(date).toISOString();
      if (poster !== undefined) updateData.poster = poster;
      if (count !== undefined) updateData.attendee_count = count;

      console.log('Update data:', updateData);
      // Update existing event in Supabase
      const { error } = await supabase.from('events').update(updateData).eq('id', editId);

      setLoading(false);

      if (error) {
        console.error('Error updating event in Supabase:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        return toast.error("Erreur lors de la mise à jour.");
      }

      console.log('Event updated successfully in Supabase');
      console.log('Updated event data:', {
        title: title.trim(),
        date: type !== "thursday" && date ? new Date(date).toISOString() : undefined,
        poster: poster ? 'poster present' : 'no poster',
        attendee_count: count,
        type
      });
      const updated = events.map(ev => ev.id === editId ? {
        ...ev, title: title.trim(), date: type !== "thursday" && date ? new Date(date).toISOString() : ev.date,
        posterDataUrl: poster, attendeeCount: count, type,
      } : ev);
      console.log('Local updated events:', updated);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success("Événement modifié.");
      setOpen(false); reset();
      return;
    }

    if (type !== "thursday" && !date) {
      console.log('No date provided');
      setLoading(false);
      return toast.error("Date requise.");
    }

    let next: AppEvent[] = [];
    if (type === "thursday") {
      console.log('Thursday dates selected:', thursdayDates);
      if (thursdayDates.length === 0) {
        console.log('No thursday dates selected');
        setLoading(false);
        return toast.error("Sélectionnez au moins un jeudi dans le calendrier.");
      }
      const groupId = uid();
      next = thursdayDates.map((d, i) => ({
        id: uid(), type: "thursday" as const,
        title: `${title.trim()} #${i + 1}`,
        date: d.toISOString(), groupId, posterDataUrl: poster, participantIds: [], attendeeCount: count,
      }));
    } else {
      next = [{
        id: uid(), type, title: title.trim(), date: new Date(date).toISOString(),
        posterDataUrl: poster, participantIds: [], attendeeCount: count,
      }];
    }

    console.log('Creating events:', next);
    console.log('Event data to insert:', next.map(ev => ({
      id: ev.id,
      title: ev.title,
      type: ev.type,
      date: ev.date,
      poster: ev.posterDataUrl,
      attendee_count: ev.attendeeCount
    })));

    // Insert new events into Supabase
    const { error } = await supabase.from('events').insert(
      next.map(ev => ({
        id: ev.id,
        title: ev.title,
        type: ev.type,
        date: ev.date,
        poster: ev.posterDataUrl,
        attendee_count: ev.attendeeCount
      }))
    );

    setLoading(false);

    if (error) {
      console.error('Error saving events to Supabase:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return toast.error("Erreur lors de la sauvegarde.");
    }

    console.log('Events saved successfully');
    // Close dialog immediately for instant feedback
    setOpen(false); reset();
    // Update local state immediately for instant display
    queryClient.setQueryData(['events'], [...next, ...events]);
    // Invalidate query to reload from Supabase
    queryClient.invalidateQueries({ queryKey: ['events'] });
    toast.success(`${next.length} événement(s) créé(s).`);
  };

  const remove = async (id: string) => {
    console.log('Removing event:', id);
    const { error } = await supabase.from('events').delete().eq('id', id);

    if (error) {
      console.error('Error deleting event from Supabase:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return toast.error("Erreur lors de la suppression.");
    }

    console.log('Event deleted successfully');
    // Update local state immediately
    queryClient.setQueryData(['events'], events.filter(e => e.id !== id));
    queryClient.invalidateQueries({ queryKey: ['events'] });
    toast.success("Événement supprimé.");
  };

  const isThursday = (d: Date) => d.getDay() === 4;

  const filterBy = (t: EventType | "all") => {
    const filtered = t === "all" ? events : events.filter(e => e.type === t);
    console.log('Filtering events by type:', t, 'filtered:', filtered.length, 'total events:', events.length);
    return filtered;
  };
  const supportsPoster = type === "activity" || type === "thursday";

  const exportEvents = (kind: "pdf" | "xlsx") => {
    const rows = events.map(e => ({
      Titre: e.title,
      Type: TYPE_LABEL[e.type],
      Date: new Date(e.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      Participants: e.attendeeCount ?? 0,
    }));
    if (kind === "xlsx") {
      // Excel export disabled
      return;
    } else {
      exportToPdf("evenements", "Liste des événements", [{
        heading: `${events.length} événement(s)`,
        head: ["Titre", "Type", "Date", "Participants"],
        body: rows.map(r => [r.Titre, r.Type, r.Date, r.Participants]),
      }]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Événements</h1>
          <p className="text-muted-foreground text-sm mt-1">{events.length} événement(s) au total</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportEvents("pdf")}>
            <FileDown className="w-4 h-4 mr-1.5" /> PDF
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-divine hover:shadow-divine">
                <Plus className="w-4 h-4 mr-2" /> Nouvel événement
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-display text-2xl">{editId ? "Modifier" : "Créer"} un événement</DialogTitle></DialogHeader>
              <form onSubmit={add} className="space-y-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as EventType)} disabled={!!editId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activity">Activité</SelectItem>
                      <SelectItem value="thursday">Culte du jeudi (série)</SelectItem>
                      <SelectItem value="evangelism">Évangélisation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Titre</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Veillée de louange" required />
                </div>
                {type === "thursday" && !editId ? (
                  <div className="space-y-2">
                    <Label>Sélectionnez les jeudis dans le calendrier</Label>
                    <div className="glass rounded-xl p-2">
                      <Calendar
                        mode="multiple"
                        selected={thursdayDates}
                        onSelect={(dates) => {
                          console.log('Calendar dates selected:', dates);
                          const filtered = (dates || []).filter(d => isThursday(d));
                          console.log('Filtered thursday dates:', filtered);
                          setThursdayDates(filtered);
                        }}
                        disabled={(d) => !isThursday(d)}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {thursdayDates.length} jeudi(s) sélectionné(s). Seuls les jeudis sont cliquables.
                    </p>
                  </div>
                ) : type !== "thursday" || editId ? (
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} required={!editId} />
                  </div>
                ) : null}

                {(type === "evangelism" || editId) && (
                  <div className="space-y-2">
                    <Label>{type === "evangelism" ? "Nombre d'évangélisés" : "Nombre de participants"}</Label>
                    <Input
                      type="number" min={0}
                      value={attendeeCount}
                      onChange={(e) => setAttendeeCount(e.target.value === "" ? "" : Math.max(0, +e.target.value))}
                      placeholder="0"
                    />
                    {type !== "evangelism" && editId && (
                      <p className="text-[10px] text-muted-foreground">
                        Pensez à mettre à jour la liste des présents dans la page Comparaison.
                      </p>
                    )}
                  </div>
                )}

                {supportsPoster && (
                  <div className="space-y-2">
                    <Label>Affiche (optionnel)</Label>
                    <input
                      ref={fileRef} type="file" accept="image/*" hidden
                      onChange={(e) => e.target.files?.[0] && onPickPoster(e.target.files[0])}
                    />
                    {poster ? (
                      <div className="relative rounded-xl overflow-hidden border border-border/40 group">
                        <img src={poster} alt="affiche" className="w-full object-contain max-h-80" />
                        <button type="button" onClick={() => setPoster(undefined)}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/80 hover:bg-destructive/80">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileRef.current?.click()}
                        className="w-full h-32 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/60 hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Upload className="w-5 h-5" />
                        <span className="text-xs">Cliquer pour téléverser une affiche</span>
                      </button>
                    )}
                  </div>
                )}

                <Button type="submit" className="w-full bg-gradient-divine" disabled={loading}>
                  {loading ? "Chargement..." : (editId ? "Enregistrer" : "Créer")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-muted/40">
          <TabsTrigger value="all">Tous</TabsTrigger>
          <TabsTrigger value="activity">Activités</TabsTrigger>
          <TabsTrigger value="thursday">Cultes du jeudi</TabsTrigger>
          <TabsTrigger value="evangelism">Évangélisations</TabsTrigger>
        </TabsList>
        {(["all", "activity", "thursday", "evangelism"] as const).map(t => (
          <TabsContent key={t} value={t} className="mt-6">
            <EventGrid events={filterBy(t)} onRemove={remove} onEdit={openEdit} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function EventGrid({ events, onRemove, onEdit }: { events: AppEvent[]; onRemove: (id: string) => void; onEdit: (e: AppEvent) => void }) {
  const sorted = [...events].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  if (sorted.length === 0) return <div className="glass rounded-2xl p-12 text-center text-muted-foreground">Aucun événement.</div>;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {sorted.map((e, i) => (
        <div key={e.id}
          className="glass rounded-2xl overflow-hidden hover:shadow-divine hover:-translate-y-1 transition-all animate-fade-in-up group"
          style={{ animationDelay: `${i * 40}ms`, animationFillMode: "backwards" }}>
          {e.posterDataUrl ? (
            <div className="relative overflow-hidden">
              <img src={e.posterDataUrl} alt={e.title}
                className="w-full object-contain max-h-64 group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-card/95 via-card/30 to-transparent pointer-events-none" />
              <span className={`absolute top-3 left-3 text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full backdrop-blur ${TYPE_COLOR[e.type]}`}>
                {TYPE_LABEL[e.type]}
              </span>
            </div>
          ) : (
            <div className="relative h-32 bg-gradient-cosmic flex items-center justify-center">
              <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
              <span className={`absolute top-3 left-3 text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full ${TYPE_COLOR[e.type]}`}>
                {TYPE_LABEL[e.type]}
              </span>
            </div>
          )}
          <div className="p-5">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-display text-lg font-bold leading-tight flex-1">{e.title}</h3>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => onEdit(e)} className="p-1 rounded hover:bg-primary/15 hover:text-primary">
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onRemove(e.id)} className="p-1 rounded hover:bg-destructive/15 hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <CalendarDays className="w-4 h-4" />
              {new Date(e.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              {e.attendeeCount ?? 0} {e.type === "evangelism" ? "évangélisé(s)" : "participant(s)"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
