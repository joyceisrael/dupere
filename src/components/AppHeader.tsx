import { Search, Bell, Check, X, Menu } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { useSearch } from "@/hooks/use-search";
import { Logo } from "@/components/Logo";
import { getPersons, getEvents, getReminders, type Person, type AppEvent, type Reminder } from "@/lib/simple-auth-storage";
import { supabase } from "@/lib/supabase";

export function AppHeader({ onMenu }: { onMenu?: () => void } = {}) {
  const { user } = useAuth();
  const { query, setQuery } = useSearch();
  const navigate = useNavigate();
  const [persons, setPersons] = useState<Person[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [openSuggest, setOpenSuggest] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const [personsData, eventsData, remindersData] = await Promise.all([
        getPersons(),
        getEvents(),
        getReminders()
      ]);
      setPersons(personsData);
      setEvents(eventsData);
      setReminders(remindersData);
    };
    loadData();
  }, []);

  const suggestions = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return { persons: [], events: [] };
    return {
      persons: persons.filter(p => p.fullName.toLowerCase().includes(q) || (p.phone ?? "").includes(q)).slice(0, 4),
      events: events.filter(e => e.title.toLowerCase().includes(q)).slice(0, 4),
    };
  }, [query, persons, events]);

  const today = new Date().toDateString();
  const dueReminders = reminders.filter(r => !r.doneDates.includes(today) && !r.skippedDates.includes(today));

  const initials = user?.fullName.split(" ").map(s => s[0]).slice(0, 2).join("") ?? "";

  return (
    <header className="sticky top-0 z-20 backdrop-blur-2xl bg-background/60 border-b border-border/40 px-4 sm:px-6 py-3 flex items-center gap-3">
      <div className="lg:hidden flex items-center gap-2">
        <button
          onClick={onMenu}
          className="p-2 rounded-xl hover:bg-muted/50 transition-colors"
          aria-label="Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Logo size={32} />
      </div>

      <Popover open={openSuggest && !!query} onOpenChange={setOpenSuggest}>
        <PopoverTrigger asChild>
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une personne, un événement..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpenSuggest(true); }}
              onFocus={() => setOpenSuggest(true)}
              className="pl-10 pr-9 h-10 bg-input/40 border-border/40 focus-visible:ring-primary"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
                aria-label="Effacer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(36rem,90vw)] p-2 glass-strong border-border/40"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {suggestions.persons.length === 0 && suggestions.events.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">Aucun résultat.</p>
          ) : (
            <div className="space-y-3">
              {suggestions.persons.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 mb-1">Personnes</p>
                  {suggestions.persons.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { navigate("/persons"); setOpenSuggest(false); }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-divine text-primary-foreground flex items-center justify-center text-xs font-bold">
                        {p.fullName.split(" ").map(s => s[0]).slice(0, 2).join("")}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.fullName}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.phone}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {suggestions.events.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 mb-1">Événements</p>
                  {suggestions.events.map(e => (
                    <button
                      key={e.id}
                      onClick={() => { navigate("/events"); setOpenSuggest(false); }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50"
                    >
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Notifications */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="relative p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
            <Bell className="w-4 h-4" />
            {dueReminders.length > 0 && (
              <>
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                  {dueReminders.length}
                </span>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary animate-glow-pulse" />
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0 glass-strong border-border/40">
          <div className="p-4 border-b border-border/30">
            <p className="font-display font-bold">Notifications</p>
            <p className="text-xs text-muted-foreground">{dueReminders.length} rappel(s) en attente</p>
          </div>
          <div className="max-h-72 overflow-auto">
            {dueReminders.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">Tout est à jour 🙏</p>
            ) : (
              dueReminders.slice(0, 6).map(r => {
                const p = persons.find(x => x.id === r.personId);
                return (
                  <div key={r.id} className="px-4 py-3 border-b border-border/20 hover:bg-muted/30 flex items-start gap-3">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{p?.fullName ?? "—"}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <Link to="/reminders" className="block p-3 text-center text-xs text-primary hover:bg-primary/5 border-t border-border/30">
            Voir tous les rappels →
          </Link>
        </PopoverContent>
      </Popover>

      {/* Profile button → settings */}
      <Link
        to="/settings"
        className="hidden sm:flex items-center gap-3 pl-3 border-l border-border/40 hover:opacity-80 transition-opacity"
      >
        <div className="text-right">
          <p className="text-xs font-medium leading-tight">{user?.fullName}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {user?.role === "coordinator" ? "Coordonnateur" : "Admin"}
          </p>
        </div>
        <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-divine flex items-center justify-center font-bold text-primary-foreground text-sm shadow-glow ring-2 ring-primary/30">
          {user?.avatarDataUrl
            ? <img src={user.avatarDataUrl} alt="" className="w-full h-full object-cover" />
            : initials}
        </div>
      </Link>
    </header>
  );
}
