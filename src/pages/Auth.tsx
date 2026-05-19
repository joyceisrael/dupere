import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Lock, User, ArrowRight, Shield, Crown, UserPlus, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { EmberField } from "@/components/EmberField";
import { loginWith, createAccount, hasAnyUser, validateAccountCreation, type Role } from "@/lib/simple-auth-storage";
import { useAuth } from "@/hooks/use-auth";
import sacredCross from "@/assets/sacred-cross.jpg";
import medievalBg from "@/assets/medieval-bg.jpg";

type Phase = "intro" | "login";

export default function Auth() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [tab, setTab] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [detectedRole, setDetectedRole] = useState<Role | null>(null);

  // Valider le numéro de téléphone et détecter le rôle
  const validatePhoneAndDetectRole = (phone: string) => {
    if (phone.length >= 10) {
      const validation = validateAccountCreation(phone);
      if (validation.isValid && validation.assignedRole) {
        setDetectedRole(validation.assignedRole);
      } else {
        setDetectedRole(null);
      }
    } else {
      setDetectedRole(null);
    }
  };

  const handlePhoneChange = (value: string) => {
    setSignupPhone(value);
    validatePhoneAndDetectRole(value);
  };
  const [loading, setLoading] = useState(false);
  const [hasUsers, setHasUsers] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    const t = setTimeout(() => setPhase("login"), 2200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // Vérifier s'il y a déjà des utilisateurs
    const checkUsers = async () => {
      setHasUsers(await hasAnyUser());
    };
    checkUsers();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const u = await loginWith(name, code, phone);
    setLoading(false);
    if (u) {
      setUser(u);
      toast.success(`Bienvenue, ${u.fullName}`, { description: "Que la grâce vous accompagne." });
      navigate("/");
    } else {
      toast.error("Identifiants invalides", { description: "Vérifiez votre nom, votre téléphone et votre code." });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const r = await createAccount(signupName, signupCode, signupPhone);
    setLoading(false);
    if ("error" in r) return toast.error(r.error);
    setUser(r);
    toast.success(`Compte ${r.role === "coordinator" ? "Coordonnateur" : "Administrateur"} créé`, {
      description: `Bienvenue, ${r.fullName}.`,
    });
    navigate("/");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-cosmic">
      <div aria-hidden className="absolute inset-0 opacity-25"
        style={{ backgroundImage: `url(${medievalBg})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div className="absolute inset-0 ray-bg animate-ray-rotate opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/40 to-background/90" />
      <EmberField density={50} />

      {phase === "intro" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div className="text-center animate-fade-in">
            <div className="relative mx-auto inline-block">
              <div className="absolute inset-0 -m-24 ray-bg animate-ray-rotate" />
              <Logo size={180} />
            </div>
            <h1 className="mt-8 font-display text-3xl md:text-5xl font-bold divine-text animate-fade-in-up">
              Les Rachetés du Père
            </h1>
            <p className="mt-3 text-muted-foreground tracking-widest text-sm uppercase animate-fade-in-up"
              style={{ animationDelay: "0.3s", animationFillMode: "backwards" }}>
              Autrefois enchaîné · Aujourd'hui libéré
            </p>
          </div>
        </div>
      )}

      {phase === "login" && (
        <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
          <aside className="relative flex flex-col justify-between p-6 lg:p-12 overflow-hidden animate-slide-in-left min-h-[40vh] lg:min-h-screen">
            <div className="absolute inset-0 -z-10">
              <img src={sacredCross} alt="Croix sacrée" className="w-full h-full object-cover object-center opacity-70" loading="eager" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/40 via-background/30 to-background/80" />
              <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background/70" />
            </div>

            <div className="flex items-center gap-4 animate-fade-in">
              <Logo size={48} />
              <div>
                <p className="font-display text-lg lg:text-xl font-bold divine-text leading-tight">Les Rachetés</p>
                <p className="text-[10px] lg:text-xs uppercase tracking-[0.3em] text-muted-foreground">du Père</p>
              </div>
            </div>

            <div className="space-y-4 lg:space-y-6 animate-fade-in-up py-4 lg:py-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-[10px] lg:text-xs uppercase tracking-widest">
                <Sparkles className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-primary" />
                Plateforme spirituelle
              </div>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-5xl xl:text-6xl font-bold leading-tight drop-shadow-2xl">
                Autrefois <span className="divine-text">enchaîné</span>,<br />
                aujourd'hui <span className="divine-text">libéré</span>.
              </h2>
              <p className="hidden lg:block text-foreground/80 max-w-md text-lg backdrop-blur-sm">
                Gérez vos fidèles, vos cultes et vos rappels avec une précision divine.
              </p>
            </div>

            <div className="hidden lg:flex gap-6 text-xs text-muted-foreground">
              <span>● Coordonnateur · Administrateur</span>
            </div>
          </aside>

          <main className="flex items-center justify-center p-4 sm:p-6 lg:p-12 animate-slide-in-right">
            <div className="w-full max-w-md">
              <div className="glass-strong rounded-3xl p-7 sm:p-9 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent animate-shimmer bg-[length:200%_100%]" />

                <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
                  <TabsList className="grid grid-cols-2 w-full bg-muted/40 mb-6">
                    <TabsTrigger value="signin">Se connecter</TabsTrigger>
                    <TabsTrigger value="signup">Créer un compte</TabsTrigger>
                  </TabsList>

                  <TabsContent value="signin" className="space-y-5 animate-fade-in">
                    <div className="space-y-1">
                      <h3 className="font-display text-2xl font-bold">Connexion</h3>
                      <p className="text-sm text-muted-foreground">Accédez à votre tableau de bord.</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                      <Field icon={User} id="name" label="Nom complet" value={name} onChange={setName} placeholder="Votre nom complet" />
                      <Field icon={Phone} id="phone" label="Téléphone" value={phone} onChange={setPhone} placeholder="+243 ..." required={false} />
                      <Field icon={Lock} id="code" label="Code secret" type="password" value={code} onChange={setCode} placeholder="••••" track />
                      <Button type="submit" disabled={loading}
                        className="w-full h-12 bg-gradient-divine hover:shadow-divine transition-all text-primary-foreground font-semibold group">
                        {loading ? "Connexion..." : (<>Se connecter <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" /></>)}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup" className="space-y-5 animate-fade-in">
                    <div className="space-y-1">
                      <h3 className="font-display text-2xl font-bold">Créer un compte</h3>
                      <p className="text-sm text-muted-foreground">Numéro autorisé requis.</p>
                    </div>
                    
                    {detectedRole && (
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                        <div className="flex items-center gap-2">
                          {detectedRole === "admin" ? (
                            <Shield className="w-5 h-5 text-primary" />
                          ) : (
                            <Crown className="w-5 h-5 text-primary" />
                          )}
                          <div>
                            <p className="text-sm font-semibold text-primary">
                              Rôle détecté: {detectedRole === "admin" ? "Administrateur" : "Coordonnateur"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Ce numéro autorise ce rôle
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {!detectedRole && signupPhone.length >= 10 && (
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                        <p className="text-sm text-destructive">
                          Numéro non autorisé pour créer un compte
                        </p>
                      </div>
                    )}

                    <form onSubmit={handleSignup} className="space-y-4">
                      <Field icon={User} id="signup-name" label="Nom complet" value={signupName} onChange={setSignupName} placeholder="Votre nom complet" />
                      <Field icon={Phone} id="signup-phone" label="Téléphone" value={signupPhone} onChange={handlePhoneChange} placeholder="Votre numéro de téléphone" />
                      <Field icon={Lock} id="signup-code" label="Code secret (4+ caractères)" type="password" value={signupCode} onChange={setSignupCode} placeholder="••••" track />
                      <Button type="submit" disabled={loading || !detectedRole}
                        className="w-full h-12 bg-gradient-divine hover:shadow-divine transition-all text-primary-foreground font-semibold group">
                        <UserPlus className="mr-2 w-4 h-4" />
                        {loading ? "Création..." : "Créer mon compte"}
                      </Button>
                    </form>

                    <div className="text-xs text-muted-foreground">
                      <p>Seuls les numéros autorisés peuvent créer un compte.</p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

function Field({
  icon: Icon, id, label, value, onChange, placeholder, type = "text", track = false, required = true,
}: {
  icon: any; id: string; label: string; value: string;
  onChange: (v: string) => void; placeholder?: string; type?: string; track?: boolean; required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="relative group">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input
          id={id} type={type} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`pl-10 h-12 bg-input/60 border-border/50 focus-visible:ring-primary ${track ? "tracking-[0.3em]" : ""}`}
          required={required}
        />
      </div>
    </div>
  );
}

function RoleCard({ active, onClick, icon: Icon, label, desc }:
  { active: boolean; onClick: () => void; icon: any; label: string; desc: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`relative p-3 rounded-xl border transition-all text-left ${active ? "border-primary bg-primary/10 shadow-glow" : "border-border/50 hover:border-primary/40 hover:bg-muted/30"}`}>
      <Icon className={`w-5 h-5 mb-1.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-[10px] text-muted-foreground">{desc}</p>
      {active && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-glow-pulse" />}
    </button>
  );
}
