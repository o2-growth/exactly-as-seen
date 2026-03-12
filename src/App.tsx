import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FinancialModelProvider } from "@/contexts/FinancialModelContext";
import { VersionHistoryProvider } from "@/contexts/VersionHistoryContext";
import AppLayout from "@/components/layout/AppLayout";
import Overview from "./pages/Overview";
import PnL from "./pages/PnL";
import CashFlow from "./pages/CashFlow";
import Assumptions from "./pages/Assumptions";
import DebtFinance from "./pages/DebtFinance";
import Valuation from "./pages/Valuation";
import VersionHistory from "./pages/VersionHistory";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <FinancialModelProvider>
        <VersionHistoryProvider>
          <BrowserRouter>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/pnl" element={<PnL />} />
                <Route path="/cashflow" element={<CashFlow />} />
                <Route path="/assumptions" element={<Assumptions />} />
                <Route path="/clients" element={<Navigate to="/assumptions" replace />} />
                <Route path="/debt" element={<DebtFinance />} />
                <Route path="/valuation" element={<Valuation />} />
                <Route path="/history" element={<VersionHistory />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </BrowserRouter>
        </VersionHistoryProvider>
      </FinancialModelProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
