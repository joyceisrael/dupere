import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GitCompare, Users, UserCheck, UserX, FileDown, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { exportToPdf } from "@/lib/exports";

export default function Comparison() {
  const queryClient = useQueryClient();
  const [eventId, setEventId] = useState<string>("");
  const [evangEventId, setEvangEventId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data: allEvents = [] } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('*');
      if (error) {
        console.error('Error fetching events:', error);
        return []; // Return empty array instead of throwing error
      }
      return data;
    },
    retry: 1,
    retryDelay: 1000
  });

  const { data: persons = [] } = useQuery({
    queryKey: ['persons'],
    queryFn: async () => {
      const { data, error } = await supabase.from('persons').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching persons:', error);
        return []; // Return empty array instead of throwing error
      }
      console.log('Fetched persons from Supabase:', data);
      return data.map((p: any) => ({
        ...p,
        fullName: p.full_name || p.fullName || '',
        address: p.address,
        phone: p.phone,
        origin: p.origin
      }));
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true,
    retry: 1, // Retry once on failure
    retryDelay: 1000
  });

  const { data: attendances = [] } = useQuery({
    queryKey: ['attendances'],
    queryFn: async () => {
      const { data, error } = await supabase.from('attendances').select('*');
      if (error) {
        console.error('Error fetching attendances:', error);
        return []; // Return empty array instead of throwing error
      }
      return data;
    },
    retry: 1,
    retryDelay: 1000
  });

  const culteActiviteEvents = allEvents.filter(e => e.type !== "evangelism");
  const evangEvents = allEvents.filter(e => e.type === "evangelism");

  const selectedEvent = allEvents.find(e => e.id === eventId);

  const presentIds = useMemo(
    () => new Set(attendances.filter(a => a.event_id === eventId).map(a => a.person_id)),
    [attendances, eventId]
  );

  const filteredPersons = useMemo(
    () => persons.filter(p => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return p.fullName?.toLowerCase().includes(query) || p.phone?.toLowerCase().includes(query);
    }),
    [persons, searchQuery]
  );

  const present = filteredPersons.filter(p => presentIds.has(p.id));
  const absent = filteredPersons.filter(p => !presentIds.has(p.id));

  // Evangelized persons linked to selected evangelism event
  const evangPersons = useMemo(() => {
    let basePersons = persons.filter(p => p.origin === "evangelism");
    if (evangEventId) {
      basePersons = basePersons.filter(p => p.linkedEventId === evangEventId);
    }
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      basePersons = basePersons.filter(p =>
        p.fullName?.toLowerCase().includes(query) || p.phone?.toLowerCase().includes(query)
      );
    }
    return basePersons;
  }, [persons, evangEventId, searchQuery]);

  const togglePresent = async (personId: string) => {
    if (!eventId) return toast.error("Choisir d'abord un événement.");
    const exists = attendances.find(a => a.event_id === eventId && a.person_id === personId);

    if (exists) {
      // Delete attendance
      const { error } = await supabase.from('attendances').delete().eq('id', exists.id);
      if (error) {
        console.error('Error deleting attendance:', error);
        return toast.error("Erreur lors de la suppression.");
      }
    } else {
      // Create attendance
      const { error } = await supabase.from('attendances').insert({
        id: crypto.randomUUID(),
        event_id: eventId,
        person_id: personId,
        created_at: new Date().toISOString()
      });
      if (error) {
        console.error('Error creating attendance:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        return toast.error("Erreur lors de la création.");
      }
    }

    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['attendances'] });

    // Auto-update attendeeCount on the event (for culte/activité only)
    if (selectedEvent && selectedEvent.type !== "evangelism") {
      // Recalculate attendee count from database after the change
      const { data: updatedAttendances, error: countError } = await supabase
        .from('attendances')
        .select('id')
        .eq('event_id', eventId);

      if (countError) {
        console.error('Error fetching updated attendances:', countError);
      } else {
        const newCount = updatedAttendances?.length || 0;
        console.log('Updating attendee count for event', eventId, 'to', newCount);
        const { error: updateError } = await supabase.from('events').update({
          attendee_count: newCount
        }).eq('id', eventId).select();

        if (updateError) {
          console.error('Error updating event attendee count:', updateError);
        } else {
          console.log('Event updated successfully');
        }
      }

      // Invalidate events query to sync across accounts
      queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  };

  const exportCombined = (kind: "pdf" | "xlsx") => {
    if (!selectedEvent) return toast.error("Sélectionner un événement.");

    const toRow = (p: any) => ({
      Nom: p.fullName,
      Téléphone: p.phone ?? "",
      Quartier: p.address ?? "",
      Source: p.origin === "evangelism" ? "Évangélisation" : p.origin === "activite" ? "Activité" : p.origin === "autre" ? "Autre" : "Culte",
    });

    const presentRows = present.map(toRow);
    const absentRows = absent.map(toRow);

    // Group evangelized persons by their evangelism event (or registration date if no linked event)
    const evangAll = persons.filter(p => p.origin === "evangelism");
    const groups = new Map<string, { label: string; rows: ReturnType<typeof toRow>[] }>();
    evangAll.forEach(p => {
      const linkedEv = p.linkedEventId ? allEvents.find(e => e.id === p.linkedEventId) : undefined;
      const key = linkedEv ? `ev-${linkedEv.id}`
        : p.registrationDate ? `date-${new Date(p.registrationDate).toISOString().slice(0, 10)}`
        : "sans-date";
      const label = linkedEv
        ? `${linkedEv.title} · ${new Date(linkedEv.date).toLocaleDateString("fr-FR")}`
        : p.registrationDate ? `Date d'évangélisation : ${new Date(p.registrationDate).toLocaleDateString("fr-FR")}`
        : "Évangélisés (date inconnue)";
      if (!groups.has(key)) groups.set(key, { label, rows: [] });
      groups.get(key)!.rows.push({ ...toRow(p), Présent: presentIds.has(p.id) ? "Oui" : "Non" } as any);
    });

    const baseName = `comparaison-${selectedEvent.title.replace(/\s+/g, "-").toLowerCase().slice(0, 24)}`;

    if (kind === "xlsx") {
      const sheets: { name: string; rows: any[] }[] = [
        { name: "Présents", rows: presentRows },
        { name: "Absents", rows: absentRows },
      ];
      groups.forEach((g, k) => sheets.push({ name: `Évang ${k.slice(-10)}`, rows: g.rows }));
      // Excel export disabled
      return;
    } else {
      const sections = [
        {
          heading: `Présents (${present.length}) — ${selectedEvent.title}`,
          head: ["Nom", "Téléphone", "Quartier", "Source"],
          body: presentRows.map(r => [r.Nom, r.Téléphone, r.Quartier, r.Source]),
        },
        {
          heading: `Absents (${absent.length})`,
          head: ["Nom", "Téléphone", "Quartier", "Source"],
          body: absentRows.map(r => [r.Nom, r.Téléphone, r.Quartier, r.Source]),
        },
        ...Array.from(groups.values()).map(g => ({
          heading: `Évangélisés — ${g.label} (${g.rows.length})`,
          head: ["Nom", "Téléphone", "Quartier", "Présent ?"],
          body: g.rows.map((r: any) => [r.Nom, r.Téléphone, r.Quartier, r.Présent]),
        })),
      ];
      exportToPdf(
        baseName,
        `Comparaison — ${selectedEvent.title} (${new Date(selectedEvent.date).toLocaleDateString("fr-FR")})`,
        sections,
      );
    }
    toast.success("Export généré.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-3">
          <GitCompare className="w-7 h-7 text-primary" /> Comparaison
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Marquez les présents, comparez avec les évangélisés.
        </p>
      </div>

      <section className="glass-strong rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
          <div className="space-y-2">
            <Label>Événement (culte du jeudi ou activité)</Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger><SelectValue placeholder="Choisir un événement..." /></SelectTrigger>
              <SelectContent className="max-h-72">
                {culteActiviteEvents.length === 0 && <div className="p-3 text-sm text-muted-foreground">Aucun événement.</div>}
                {culteActiviteEvents.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.title} · {new Date(e.date).toLocaleDateString("fr-FR")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedEvent && (
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="w-4 h-4" />
              <div className="text-xs">
                <p className="font-semibold">{present.length} présent(s)</p>
                <p className="opacity-80">/ {persons.length} enregistré(s)</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {selectedEvent && (
        <Tabs defaultValue="present" className="w-full">
          <TabsList className="bg-muted/40 flex-wrap h-auto">
            <TabsTrigger value="present"><UserCheck className="w-4 h-4 mr-2" />Présents</TabsTrigger>
            <TabsTrigger value="absent"><UserX className="w-4 h-4 mr-2" />Absents</TabsTrigger>
            <TabsTrigger value="evang"><Users className="w-4 h-4 mr-2" />Évangélisés</TabsTrigger>
          </TabsList>

          <TabsContent value="present" className="mt-6 space-y-4">
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou téléphone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => exportCombined("pdf")}>
                <FileDown className="w-4 h-4 mr-1.5" /> PDF combiné
              </Button>
            </div>
            <div className="glass rounded-2xl p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-2">Cocher les personnes venues à : <b>{selectedEvent.title}</b></p>
              {filteredPersons.map(p => {
                const checked = presentIds.has(p.id);
                return (
                  <label key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${checked ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/30 border border-transparent"}`}>
                    <Checkbox checked={checked} onCheckedChange={() => togglePresent(p.id)} />
                    <div className="w-9 h-9 rounded-lg bg-gradient-divine flex items-center justify-center text-xs font-bold text-primary-foreground">
                      {p.fullName ? p.fullName.split(" ").map(s => s[0]).slice(0, 2).join("") : "??"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.fullName}</p>
                      <p className="text-[10px] text-muted-foreground">{p.phone ?? "—"}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="absent" className="mt-6 space-y-4">
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou téléphone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => exportCombined("pdf")}>
                <FileDown className="w-4 h-4 mr-1.5" /> PDF combiné
              </Button>
            </div>
            <div className="glass rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-3">{absent.length} personne(s) non présentes :</p>
              {absent.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Toutes les personnes étaient présentes 🙏</p>
              ) : (
                <ul className="grid sm:grid-cols-2 gap-2">
                  {absent.map(p => (
                    <li key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20">
                      <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center text-xs font-bold">
                        {p.full_name ? p.full_name.split(" ").map(s => s[0]).slice(0, 2).join("") : "??"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{p.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.phone ?? "—"}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          <TabsContent value="evang" className="mt-6 space-y-4">
            <div className="glass-strong rounded-2xl p-4 space-y-3">
              <div className="space-y-2">
                <Label>Filtrer par événement d'évangélisation</Label>
                <Select value={evangEventId} onValueChange={setEvangEventId}>
                  <SelectTrigger><SelectValue placeholder="Tous les évangélisés" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les évangélisés</SelectItem>
                    {evangEvents.map(ev => (
                      <SelectItem key={ev.id} value={ev.id}>
                        {ev.title} · {new Date(ev.date).toLocaleDateString("fr-FR")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou téléphone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {evangPersons.length} personne(s) évangélisée(s). Celles présentes au culte/activité sont marquées :
              </p>
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {evangPersons.map(p => {
                  const came = presentIds.has(p.id);
                  return (
                    <li key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border ${came ? "border-success/40 bg-success/10" : "border-border/30 bg-muted/20"}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${came ? "bg-success/30 text-success" : "bg-muted/40"}`}>
                        {came ? "✓" : "—"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm truncate">{p.fullName}</p>
                        <p className="text-[10px] text-muted-foreground">{came ? "Présent(e)" : "Pas venu(e)"}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
