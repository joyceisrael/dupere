import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, CalendarDays, Bell, BarChart3, Settings, LogOut, GitCompare,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/persons", label: "Personnes", icon: Users },
  { to: "/events", label: "Événements", icon: CalendarDays },
  { to: "/reminders", label: "Rappels", icon: Bell },
  { to: "/comparison", label: "Comparaison", icon: GitCompare },
  { to: "/stats", label: "Statistiques", icon: BarChart3 },
  { to: "/settings", label: "Paramètres", icon: Settings },
];

interface Props {
  mobile?: boolean;
  onNavigate?: () => void;
}

export function AppSidebar({ mobile = false, onNavigate }: Props) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  return (
    <aside className={cn(
      "flex-col bg-sidebar/60 backdrop-blur-2xl border-r border-sidebar-border/50 p-4",
      mobile ? "flex w-full h-full" : "hidden lg:flex w-64"
    )}>
      <div className="flex items-center gap-3 px-2 py-3">
        <Logo size={40} />
        <div>
          <p className="font-display font-bold text-sm divine-text leading-tight">Les Rachetés</p>
          <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">du Père</p>
        </div>
      </div>

      <nav className="mt-8 flex-1 space-y-1 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
          Navigation
        </p>
        {items.map((it) => {
          const active = it.end ? loc.pathname === it.to : loc.pathname.startsWith(it.to);
          return (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group relative",
                active
                  ? "bg-primary/15 text-primary shadow-glow"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-gradient-divine" />
              )}
              <it.icon className={cn("w-4 h-4 transition-transform group-hover:scale-110", active && "text-primary")} />
              <span className="font-medium">{it.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border/50 pt-4 mt-4">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-divine flex items-center justify-center font-bold text-primary-foreground text-sm shrink-0">
            {user?.avatarDataUrl
              ? <img src={user.avatarDataUrl} alt="" className="w-full h-full object-cover" />
              : user?.fullName.split(" ").map(s => s[0]).slice(0, 2).join("")}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.fullName}</p>
            <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">
              {user?.role === "coordinator" ? "Coordonnateur" : "Administrateur"}
            </p>
          </div>
          <button
            onClick={() => { signOut(); navigate("/auth"); }}
            className="p-2 rounded-lg hover:bg-destructive/15 hover:text-destructive transition-colors"
            aria-label="Déconnexion"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
