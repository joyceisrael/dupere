import { Users, CalendarDays, Bell, ArrowUpRight, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { type Person, type AppEvent, type Reminder } from "@/lib/simple-auth-storage";
import { supabase } from "@/lib/supabase";
import heroImg from "@/assets/hero-liberation.png";
import { useAuth } from "@/hooks/use-auth";

interface Stat {
  label: string; value: string; trend: string; icon: React.ElementType; to: string;
}

export default function Dashboard() {
  const { user } = useAuth();

  // React Query for persons
  const { data: persons = [] } = useQuery({
    queryKey: ['persons'],
    queryFn: async () => {
      const { data, error } = await supabase.from('persons').select('*');
      if (error) throw error;
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

  // React Query for reminders
  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('reminders').select('*');
      if (error) throw error;
      return data.map((r: any) => ({
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
    }
  });

  const today = new Date().toDateString();
  const todayReminders = reminders.filter(r => !r.doneDates.includes(today) && !r.skippedDates.includes(today));
  const upcoming = events.filter(e => new Date(e.date) >= new Date()).sort((a, b) => +new Date(a.date) - +new Date(b.date));

  const stats: Stat[] = [
    { label: "Enregistrés", value: String(persons.length), trend: "+12%", icon: Users, to: "/persons" },
    { label: "Événements", value: String(events.length), trend: "+5", icon: CalendarDays, to: "/events" },
    { label: "Rappels du jour", value: String(todayReminders.length), trend: "Aujourd'hui", icon: Bell, to: "/reminders" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome hero */}
      <div className="relative overflow-hidden rounded-3xl glass-strong p-6 sm:p-8 grid md:grid-cols-2 gap-6 items-center">
        <div className="absolute inset-0 bg-gradient-glow opacity-60" />
        <div className="absolute -top-20 -right-20 w-80 h-80 ray-bg animate-ray-rotate opacity-30" />
        <div className="relative space-y-3 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs uppercase tracking-widest">
            <Sparkles className="w-3 h-3 animate-glow-pulse" />
            Bienvenue
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight">
            Que la grâce soit avec vous,<br />
            <span className="divine-text">{user?.fullName}</span>
          </h1>
          <p className="text-muted-foreground max-w-md">
            Voici un aperçu de votre ministère aujourd'hui. Les âmes que vous accompagnez méritent toute votre attention.
          </p>
        </div>
        <div className="relative aspect-square max-w-[260px] ml-auto rounded-2xl overflow-hidden animate-float shadow-divine ring-2 ring-primary/30 z-10">
          <img
            src={heroImg}
            alt="Libération spirituelle"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s, i) => (
          <Link
            to={s.to}
            key={s.label}
            className="group glass rounded-2xl p-5 hover:shadow-divine hover:-translate-y-1 transition-all duration-300 animate-fade-in-up"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-gradient-divine flex items-center justify-center shadow-glow">
                <s.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className="text-3xl font-display font-bold mt-4">{s.value}</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className="text-xs text-primary font-medium">{s.trend}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold">Événements à venir</h2>
            <Link to="/events" className="text-xs text-primary hover:underline">Tout voir</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucun événement à venir.</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.slice(0, 5).map(e => (
                <li key={e.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/30 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-gradient-cosmic flex flex-col items-center justify-center border border-border/50">
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {new Date(e.date).toLocaleDateString("fr-FR", { month: "short" })}
                    </span>
                    <span className="text-lg font-display font-bold text-primary leading-none">
                      {new Date(e.date).getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.type === "thursday" ? "Culte du jeudi" : e.type === "evangelism" ? "Évangélisation" : "Activité"}
                      {" · "}{e.participantIds?.length ?? 0} participants
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold">Rappels du jour</h2>
            <Link to="/reminders" className="text-xs text-primary hover:underline">Gérer</Link>
          </div>
          {todayReminders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Tout est à jour 🙏</p>
          ) : (
            <ul className="space-y-3">
              {todayReminders.slice(0, 5).map(r => {
                const p = persons.find(x => x.id === r.personId);
                return (
                  <li key={r.id} className="p-3 rounded-xl bg-muted/20 border border-border/40">
                    <p className="text-sm font-medium">{p?.fullName ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{r.title}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
