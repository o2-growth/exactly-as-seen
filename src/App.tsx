import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FinancialModelProvider } from "@/contexts/FinancialModelContext";
import { VersionHistoryProvider } from "@/contexts/VersionHistoryContext";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Auth from "./pages/Auth";
import Overview from "./pages/Overview";
import PnL from "./pages/PnL";
import CashFlow from "./pages/CashFlow";
import Assumptions from "./pages/Assumptions";
import DebtFinance from "./pages/DebtFinance";
import Valuation from "./pages/Valuation";
import VersionHistory from "./pages/VersionHistory";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import PremissasPage from "./pages/PremissasPage";
import SimuladorTributario from "./pages/SimuladorTributario";
// FinanceCycle is now integrated into CashFlow page

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <FinancialModelProvider>
        <VersionHistoryProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<ProtectedRoute><AppLayout><Overview /></AppLayout></ProtectedRoute>} />
              <Route path="/pnl" element={<ProtectedRoute><AppLayout><PnL /></AppLayout></ProtectedRoute>} />
              <Route path="/cashflow" element={<ProtectedRoute><AppLayout><CashFlow /></AppLayout></ProtectedRoute>} />
              <Route path="/assumptions" element={<ProtectedRoute><AppLayout><Assumptions /></AppLayout></ProtectedRoute>} />
              <Route path="/clients" element={<Navigate to="/assumptions" replace />} />
              <Route path="/premissas" element={<ProtectedRoute><AppLayout><PremissasPage /></AppLayout></ProtectedRoute>} />
              <Route path="/simulador-tributario" element={<ProtectedRoute><AppLayout><SimuladorTributario /></AppLayout></ProtectedRoute>} />
              <Route path="/debt" element={<ProtectedRoute><AppLayout><DebtFinance /></AppLayout></ProtectedRoute>} />
              <Route path="/valuation" element={<ProtectedRoute><AppLayout><Valuation /></AppLayout></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><AppLayout><VersionHistory /></AppLayout></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </VersionHistoryProvider>
      </FinancialModelProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
