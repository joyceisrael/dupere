import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, CalendarDays, Heart, FileDown } from "lucide-react";
import {
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { exportToPdf } from "@/lib/exports";
import { supabase } from "@/lib/supabase";

export default function Stats() {
  const { data: persons = [] } = useQuery({
    queryKey: ['persons'],
    queryFn: async () => {
      const { data, error } = await supabase.from('persons').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: attendances = [] } = useQuery({
    queryKey: ['attendances'],
    queryFn: async () => {
      const { data, error } = await supabase.from('attendances').select('*');
      if (error) throw error;
      return data;
    }
  });

  // Fidèles = personnes cochées présentes à au moins 2 événements (culte ou activité)
  const fidelesDetailed = useMemo(() => {
    const counts: Record<string, number> = {};
    attendances.forEach(a => { counts[a.person_id] = (counts[a.person_id] ?? 0) + 1; });
    return persons
      .filter(p => (counts[p.id] ?? 0) >= 2)
      .map(p => ({ ...p, presences: counts[p.id] }));
  }, [attendances, persons]);
  const fidelesCount = fidelesDetailed.length;

  const culteData = useMemo(() => {
    return events
      .filter(e => e.type === "thursday")
      .map(e => ({
        date: new Date(e.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
        culte: attendances.filter(a => a.event_id === e.id).length,
      }))
      .sort((a, b) => {
        const [da, ma] = a.date.split("/").map(Number);
        const [db, mb] = b.date.split("/").map(Number);
        return ma - mb || da - db;
      });
  }, [events, attendances]);

  const activiteData = useMemo(() => {
    return events
      .filter(e => e.type === "activity")
      .map(e => ({
        date: new Date(e.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
        activite: attendances.filter(a => a.event_id === e.id).length,
      }))
      .sort((a, b) => {
        const [da, ma] = a.date.split("/").map(Number);
        const [db, mb] = b.date.split("/").map(Number);
        return ma - mb || da - db;
      });
  }, [events, attendances]);

  const stats = [
    { icon: Users, label: "Enregistrés", value: persons.length, color: "text-primary" },
    { icon: CalendarDays, label: "Événements", value: events.length, color: "text-accent" },
    { icon: Heart, label: "Fidèles", value: fidelesCount, color: "text-success" },
  ];

  const originLabel = (o?: string) => {
    if (o === "evangelism") return "Évangélisation";
    if (o === "activite") return "Activité";
    if (o === "autre") return "Autre";
    return "Culte";
  };

  const exportAll = (kind: "pdf" | "xlsx") => {
    const personRows = persons.map(p => ({
      Nom: p.full_name,
      Téléphone: p.phone ?? "",
      Quartier: p.address ?? "",
      Source: originLabel(p.origin),
      "Date d'enregistrement": p.registration_date ? new Date(p.registration_date).toLocaleDateString("fr-FR") : "",
    }));
    const fideleRows = fidelesDetailed.map(p => ({
      Nom: p.full_name,
      Téléphone: p.phone ?? "",
      Quartier: p.address ?? "",
      Source: originLabel(p.origin),
      Présences: p.presences,
    }));
    const eventRows = events.map(e => ({
      Titre: e.title, Type: e.type, Date: new Date(e.date).toLocaleDateString("fr-FR"),
      Participants: e.attendeeCount ?? 0,
    }));
    const culteRows = culteData.map(a => ({ Date: a.date, Participants: a.culte }));
    const activiteRows = activiteData.map(a => ({ Date: a.date, Participants: a.activite }));

    if (kind === "xlsx") {
      // Excel export disabled
      return;
    } else {
      exportToPdf("statistiques", "Statistiques globales", [
        { heading: "Résumé global", head: ["Statistique", "Valeur"], body: [
          ["Enregistrés", persons.length],
          ["Événements", events.length],
          ["Fidèles", fidelesCount],
        ]},
        { heading: "Personnes enregistrées", head: ["Nom", "Téléphone", "Quartier", "Source"],
          body: personRows.map(r => [r.Nom, r.Téléphone, r.Quartier, r.Source]) },
        { heading: `Fidèles (présents à 2+ événements) — ${fidelesCount}`,
          head: ["Nom", "Téléphone", "Quartier", "Source", "Présences"],
          body: fideleRows.map(r => [r.Nom, r.Téléphone, r.Quartier, r.Source, r.Présences]) },
        { heading: "Événements", head: ["Titre", "Type", "Date", "Participants"],
          body: eventRows.map(r => [r.Titre, r.Type, r.Date, r.Participants]) },
        { heading: "Participation Culte du jeudi", head: ["Date", "Participants"],
          body: culteRows.map(r => [r.Date, r.Participants]) },
        { heading: "Participation Activités", head: ["Date", "Participants"],
          body: activiteRows.map(r => [r.Date, r.Participants]) },
      ]);
    }
  };

  const tooltipStyle = { background: "hsl(232 50% 10%)", border: "1px solid hsl(232 35% 22%)", borderRadius: 12 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Statistiques</h1>
          <p className="text-muted-foreground text-sm mt-1">La croissance de votre communauté en un coup d'œil.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportAll("pdf")}>
            <FileDown className="w-4 h-4 mr-1.5" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s, i) => (
          <div key={s.label} className="glass rounded-2xl p-5 animate-fade-in-up" style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}>
            <s.icon className={`w-5 h-5 ${s.color}`} />
            <p className="text-3xl font-display font-bold mt-3">{s.value}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Culte du jeudi chart - full width */}
      <div className="glass rounded-2xl p-6">
        <h2 className="font-display text-xl font-bold mb-4">Participants — Culte du jeudi</h2>
        {culteData.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Aucune donnée. Marquez les présences dans la page Comparaison.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={culteData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(232 35% 22%)" />
              <XAxis dataKey="date" stroke="hsl(220 15% 65%)" fontSize={12} />
              <YAxis stroke="hsl(220 15% 65%)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="culte" name="Culte du jeudi" fill="hsl(22 95% 58%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Activité chart - full width */}
      <div className="glass rounded-2xl p-6">
        <h2 className="font-display text-xl font-bold mb-4">Participants — Activités</h2>
        {activiteData.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Aucune donnée. Marquez les présences dans la page Comparaison.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={activiteData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(232 35% 22%)" />
              <XAxis dataKey="date" stroke="hsl(220 15% 65%)" fontSize={12} />
              <YAxis stroke="hsl(220 15% 65%)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="activite" name="Activité" fill="hsl(258 75% 62%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
