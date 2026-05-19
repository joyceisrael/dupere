import { useEffect, useState } from "react";
import { getSession, setSession, type User } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

const EVT = "rdp:auth-change";

export function useAuth() {
  const [user, setUserState] = useState<User | null>(() => getSession());

  useEffect(() => {
    const checkSession = async () => {
      const session = getSession();
      if (!session) {
        setUserState(null);
        return;
      }

      // Verify the session is still valid in Supabase
      const { data, error } = await supabase.from('users').select('*').eq('id', session.id).single();
      if (error || !data) {
        console.log('Session invalid or user not found in Supabase, signing out...');
        setSession(null);
        setUserState(null);
        window.dispatchEvent(new Event(EVT));
        return;
      }

      // Check if the user has been deleted (name changed to Deleted Admin/User)
      if (data.full_name.startsWith("Deleted Admin") || data.full_name.startsWith("Deleted User")) {
        console.log('User has been deleted in Supabase, signing out...');
        setSession(null);
        setUserState(null);
        window.dispatchEvent(new Event(EVT));
        return;
      }

      setUserState(session);
    };

    const handler = () => {
      checkSession();
    };

    window.addEventListener(EVT, handler);
    window.addEventListener("storage", handler);

    // Check on mount
    checkSession();

    // Check periodically (every 10 seconds) for deleted accounts
    const interval = setInterval(checkSession, 10000);

    return () => {
      window.removeEventListener(EVT, handler);
      window.removeEventListener("storage", handler);
      clearInterval(interval);
    };
  }, []);

  return {
    user,
    setUser: (u: User | null) => {
      setSession(u);
      window.dispatchEvent(new Event(EVT));
    },
    signOut: () => {
      setSession(null);
      window.dispatchEvent(new Event(EVT));
    },
  };
}

export const notifyAuthChange = () => window.dispatchEvent(new Event(EVT));
