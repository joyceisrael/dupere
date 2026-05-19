import { useEffect, useState } from "react";

const KEY = "rdp.search";
const EVT = "rdp:search";

export function useSearch() {
  const [query, setQueryState] = useState(() => sessionStorage.getItem(KEY) ?? "");

  useEffect(() => {
    const h = () => setQueryState(sessionStorage.getItem(KEY) ?? "");
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);

  return {
    query,
    setQuery: (v: string) => {
      sessionStorage.setItem(KEY, v);
      window.dispatchEvent(new Event(EVT));
    },
  };
}
