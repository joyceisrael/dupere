import { useEffect, useRef, useState } from "react";
import { Camera, User as UserIcon, Bell, Volume2, Smartphone, LogOut, Crown, Shield, Trash2, Users, Ban, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { updateUser, getUsers, deleteUser, type User } from "@/lib/simple-auth-storage";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const { user, signOut, setUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.fullName ?? "");
  const [code, setCode] = useState(user?.code ?? "");
  const [sound, setSound] = useState(() => localStorage.getItem('rdp.sound') === 'true');
  const [push, setPush] = useState(() => localStorage.getItem('rdp.push') === 'true');
  const [inApp, setInApp] = useState(() => localStorage.getItem('rdp.inApp') !== 'false');
  const [admins, setAdmins] = useState<User[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (user?.role === "coordinator") {
      // Load admins from Supabase
      const loadAdmins = async () => {
        const { data, error } = await supabase.from('users').select('*').eq('role', 'admin');
        if (error) {
          console.error('Error loading admins from Supabase:', error);
          setAdmins(getUsers().filter(u => u.role === "admin" && !u.fullName.startsWith("Deleted Admin")));
        } else if (data) {
          const converted = data
            .filter((u: any) => !u.full_name.startsWith("Deleted Admin"))
            .map((u: any) => ({
            id: u.id,
            fullName: u.full_name,
            phone: u.phone,
            code: u.code,
            role: u.role,
            avatarDataUrl: u.avatar
          }));
          setAdmins(converted);
        }
      };
      loadAdmins();
    }
  }, [user]);

  // Save notification preferences to localStorage
  useEffect(() => {
    localStorage.setItem('rdp.sound', sound.toString());
  }, [sound]);

  useEffect(() => {
    localStorage.setItem('rdp.push', push.toString());
  }, [push]);

  useEffect(() => {
    localStorage.setItem('rdp.inApp', inApp.toString());
  }, [inApp]);

  if (!user) return null;
  const initials = user.fullName.split(" ").map(s => s[0]).slice(0, 2).join("");

  const onPick = async (f: File) => {
    if (f.size > 2 * 1024 * 1024) return toast.error("Image trop lourde (max 2 Mo).");
    const reader = new FileReader();
    reader.onload = async () => {
      const avatar = reader.result as string;
      // Store avatar in Supabase for cross-device sync
      const { error } = await supabase.from('users').update({ avatar }).eq('id', user.id);
      if (error) {
        console.error('Error updating avatar in Supabase:', error);
        toast.error("Erreur lors de la mise à jour de la photo.");
        return;
      }
      const updated = { ...user, avatarDataUrl: avatar };
      updateUser(updated);
      setUser(updated);
      toast.success("Photo mise à jour.");
    };
    reader.readAsDataURL(f);
  };

  const removePhoto = async () => {
    // Remove avatar from Supabase for cross-device sync
    const { error } = await supabase.from('users').update({ avatar: null }).eq('id', user.id);
    if (error) {
      console.error('Error removing avatar from Supabase:', error);
      toast.error("Erreur lors de la suppression de la photo.");
      return;
    }
    const { avatarDataUrl, ...rest } = user;
    updateUser(rest);
    setUser(rest);
    toast.success("Photo supprimée.");
  };

  const deleteAccount = async () => {
    try {
      // Release phone number so it can be used again (directly in localStorage)
      if (user.phone) {
        const cleanPhone = user.phone.replace(/\s/g, '');
        const USED_NUMBERS_KEY = 'rdp.used_numbers';
        try {
          const used = JSON.parse(localStorage.getItem(USED_NUMBERS_KEY) || '[]');
          const updated = used.filter((n: string) => n !== cleanPhone);
          localStorage.setItem(USED_NUMBERS_KEY, JSON.stringify(updated));
          console.log('Released phone number:', user.phone);
        } catch (e) {
          console.error('Error releasing phone number:', e);
        }
      }

      // Delete all reminder sync data for this user (to avoid foreign key constraints)
      console.log('Deleting reminder_sync_sessions...');
      const { error: sessionsError } = await supabase.from('reminder_sync_sessions').delete().eq('created_by', user.id);
      if (sessionsError) {
        console.error('Error deleting reminder_sync_sessions:', sessionsError);
      } else {
        console.log('reminder_sync_sessions deleted successfully');
      }

      console.log('Deleting reminder_sync_participants...');
      const { error: participantsError } = await supabase.from('reminder_sync_participants').delete().eq('user_id', user.id);
      if (participantsError) {
        console.error('Error deleting reminder_sync_participants:', participantsError);
      } else {
        console.log('reminder_sync_participants deleted successfully');
      }

      console.log('Deleting reminder_sync_actions...');
      const { error: actionsError } = await supabase.from('reminder_sync_actions').delete().eq('performed_by', user.id);
      if (actionsError) {
        console.error('Error deleting reminder_sync_actions:', actionsError);
      } else {
        console.log('reminder_sync_actions deleted successfully');
      }

      // Instead of deleting, update the user to change the phone number (to allow reuse)
      console.log('Updating user in Supabase to change phone number...');
      const { error: updateError } = await supabase.from('users').update({
        phone: 'deleted_' + user.id.slice(0, 8),
        full_name: 'Deleted User ' + user.id.slice(0, 8)
      }).eq('id', user.id);

      if (updateError) {
        console.error('Error updating user in Supabase:', updateError);
        console.error('Error details:', JSON.stringify(updateError, null, 2));
        // If update fails, still delete from localStorage and sign out
        console.log('Deleting from localStorage only due to Supabase error');
        deleteUser(user.id, true);
        await signOut();
        navigate("/auth");
        toast.success("Compte supprimé localement. Le numéro peut être réutilisé.");
        return;
      }

      // Delete user from localStorage (skip Supabase since we already updated it)
      deleteUser(user.id, true);
      // Sign out
      await signOut();
      navigate("/auth");
      toast.success("Compte supprimé. Le numéro peut être réutilisé.");
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error("Erreur lors de la suppression du compte.");
    }
  };

  const saveProfile = async () => {
    const { error } = await supabase.from('users').update({
      full_name: name.trim() || user.fullName,
      code: code || user.code
    }).eq('id', user.id);
    if (error) {
      console.error('Error updating profile in Supabase:', error);
      return toast.error("Erreur lors de la mise à jour.");
    }
    const updated = { ...user, fullName: name.trim() || user.fullName, code: code || user.code };
    updateUser(updated);
    setUser(updated);
    toast.success("Profil mis à jour.");
  };

  const askPush = async () => {
    if (!("Notification" in window)) return toast.error("Push non supporté sur ce navigateur.");
    const p = await Notification.requestPermission();
    if (p === "granted") {
      setPush(true);
      new Notification("Les Rachetés du Père", { body: "Notifications activées 🔔" });
    } else {
      toast.error("Permission refusée.");
    }
  };

  const removeAdmin = async (adminId: string) => {
    // Check if user is trying to delete themselves
    if (adminId === user.id) {
      return toast.error("Vous ne pouvez pas supprimer votre propre compte via cette fonction. Utilisez 'Supprimer mon compte' en bas.");
    }

    console.log('=== Starting admin deletion for ID:', adminId, '===');

    // Delete all reminder sync data for this admin (to avoid foreign key constraints)
    console.log('Deleting reminder_sync_sessions for admin...');
    const { error: sessionsError } = await supabase.from('reminder_sync_sessions').delete().eq('created_by', adminId);
    if (sessionsError) {
      console.error('Error deleting reminder_sync_sessions:', sessionsError);
    } else {
      console.log('reminder_sync_sessions deleted successfully');
    }

    console.log('Deleting reminder_sync_participants for admin...');
    const { error: participantsError } = await supabase.from('reminder_sync_participants').delete().eq('user_id', adminId);
    if (participantsError) {
      console.error('Error deleting reminder_sync_participants:', participantsError);
    } else {
      console.log('reminder_sync_participants deleted successfully');
    }

    console.log('Deleting reminder_sync_actions for admin...');
    const { error: actionsError } = await supabase.from('reminder_sync_actions').delete().eq('performed_by', adminId);
    if (actionsError) {
      console.error('Error deleting reminder_sync_actions:', actionsError);
    } else {
      console.log('reminder_sync_actions deleted successfully');
    }

    // Update the admin to change phone number (to allow reuse) instead of deleting
    console.log('Updating admin in Supabase to change phone number...');
    const newPhone = 'deleted_' + adminId.slice(0, 8);
    const newName = 'Deleted Admin ' + adminId.slice(0, 8);
    console.log('New phone:', newPhone, 'New name:', newName);

    const { error: updateError } = await supabase.from('users').update({
      phone: newPhone,
      full_name: newName
    }).eq('id', adminId);

    if (updateError) {
      console.error('Error updating admin in Supabase:', updateError);
      console.error('Error details:', JSON.stringify(updateError, null, 2));
      return toast.error("Erreur lors de la suppression.");
    }

    console.log('Admin updated successfully in Supabase');

    deleteUser(adminId, true);
    setAdmins(prev => prev.filter(a => a.id !== adminId));
    toast.success("Compte administrateur supprimé.");
    console.log('=== Admin deletion completed ===');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground text-sm mt-1">Gérez votre profil et vos préférences.</p>
      </div>

      {/* Profile card */}
      <section className="glass rounded-3xl p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
        <div className="flex items-center gap-3">
          <UserIcon className="w-5 h-5 text-primary" />
          <h2 className="font-display text-lg sm:text-xl font-bold">Profil</h2>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <div className="relative group">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-gradient-divine flex items-center justify-center text-2xl sm:text-3xl font-display font-bold text-primary-foreground shadow-divine ring-2 ring-primary/40">
              {user.avatarDataUrl
                ? <img src={user.avatarDataUrl} alt="" className="w-full h-full object-cover" />
                : initials}
            </div>
            <button onClick={() => fileRef.current?.click()}
              className="absolute inset-0 rounded-2xl bg-background/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
              aria-label="Changer la photo">
              <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden
              onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] sm:text-xs uppercase tracking-widest">
              {user.role === "coordinator" ? <><Crown className="w-3 h-3" /> Coordonnateur</> : <><Shield className="w-3 h-3" /> Administrateur</>}
            </div>
            <p className="font-display text-xl sm:text-2xl font-bold mt-2">{user.fullName}</p>
            <div className="flex gap-2 mt-2 justify-center sm:justify-start">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <Camera className="w-3.5 h-3.5 mr-1.5" /> Changer
              </Button>
              {user.avatarDataUrl && (
                <Button size="sm" variant="ghost" onClick={removePhoto}>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Retirer
                </Button>
              )}
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nom complet</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Code secret</Label>
            <Input type="password" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
        </div>
        <Button onClick={saveProfile} className="bg-gradient-divine hover:shadow-divine w-full sm:w-auto">Enregistrer</Button>
      </section>

      {/* Coordinator: Admin management */}
      {user.role === "coordinator" && (
        <section className="glass rounded-3xl p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-5">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-display text-lg sm:text-xl font-bold">Gestion des administrateurs</h2>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            En tant que coordonnateur, vous pouvez superviser et supprimer les comptes administrateurs.
          </p>
          {admins.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucun administrateur enregistré.</p>
          ) : (
            <div className="space-y-3">
              {admins.map(a => (
                <div key={a.id} className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 p-4 rounded-xl bg-muted/20 border border-border/30">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="w-10 h-10 rounded-lg bg-gradient-divine flex items-center justify-center text-xs font-bold text-primary-foreground flex-shrink-0">
                      {a.fullName.split(" ").map(s => s[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{a.fullName}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                        <Shield className="w-3 h-3 inline mr-1" />Administrateur
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => removeAdmin(a.id)}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 w-full sm:w-auto">
                    <Ban className="w-3.5 h-3.5 mr-1.5" /> Supprimer
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Notifications */}
      <section className="glass rounded-3xl p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-5">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="font-display text-lg sm:text-xl font-bold">Notifications</h2>
        </div>
        <Row icon={Smartphone} title="Notifications in-app" desc="Toasts et badges quand l'app est ouverte.">
          <Switch checked={inApp} onCheckedChange={setInApp} />
        </Row>
        <Row icon={Volume2} title="Sons d'alerte" desc="Joue un son discret pour les rappels.">
          <Switch checked={sound} onCheckedChange={setSound} />
        </Row>
        <Row icon={Bell} title="Push navigateur" desc="Recevez des alertes même app fermée.">
          {push ? <Switch checked onCheckedChange={() => setPush(false)} /> : (
            <Button size="sm" variant="outline" onClick={askPush}>Activer</Button>
          )}
        </Row>
      </section>

      {/* Danger */}
      <section className="glass rounded-3xl p-4 sm:p-6 md:p-8 space-y-3">
        <Button variant="outline" onClick={() => { signOut(); navigate("/auth"); }}
          className="border-destructive/40 text-destructive hover:bg-destructive/10 w-full sm:w-auto">
          <LogOut className="w-4 h-4 mr-2" /> Se déconnecter
        </Button>
        <Button variant="outline" onClick={() => setDeleteDialogOpen(true)}
          className="border-destructive/40 text-destructive hover:bg-destructive/10 w-full sm:w-auto">
          <Trash2 className="w-4 h-4 mr-2" /> Supprimer mon compte
        </Button>
      </section>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Supprimer le compte
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible et toutes vos données seront perdues.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={() => { setDeleteDialogOpen(false); deleteAccount(); }}>
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ icon: Icon, title, desc, children }: { icon: any; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
