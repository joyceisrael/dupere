import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Persons from "./pages/Persons";
import Events from "./pages/Events";
import Reminders from "./pages/Reminders";
import Stats from "./pages/Stats";
import SettingsPage from "./pages/Settings";
import Comparison from "./pages/Comparison";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0, // No caching
      gcTime: 0, // No garbage collection time
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: false,
    },
  },
});

// Clear cache on page load to prevent 404 errors
if (typeof window !== 'undefined') {
  queryClient.clear();
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
          <Route path="/persons" element={<AppLayout><Persons /></AppLayout>} />
          <Route path="/events" element={<AppLayout><Events /></AppLayout>} />
          <Route path="/reminders" element={<AppLayout><Reminders /></AppLayout>} />
          <Route path="/comparison" element={<AppLayout><Comparison /></AppLayout>} />
          <Route path="/stats" element={<AppLayout><Stats /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
