import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { FinancialModelProvider } from "@/contexts/FinancialModelContext";
import AppLayout from "@/components/layout/AppLayout";
import Overview from "./pages/Overview";
import PnL from "./pages/PnL";
import CashFlow from "./pages/CashFlow";
import Assumptions from "./pages/Assumptions";
import ClientsGrowth from "./pages/ClientsGrowth";
import DebtFinance from "./pages/DebtFinance";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <FinancialModelProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/pnl" element={<PnL />} />
              <Route path="/cashflow" element={<CashFlow />} />
              <Route path="/assumptions" element={<Assumptions />} />
              <Route path="/clients" element={<ClientsGrowth />} />
              <Route path="/debt" element={<DebtFinance />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </FinancialModelProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
