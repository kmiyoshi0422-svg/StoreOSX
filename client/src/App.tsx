import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import CasesList from "./pages/CasesList";
import CaseNew from "./pages/CaseNew";
import CaseDetail from "./pages/CaseDetail";
import PhotoLedger from "./pages/PhotoLedger";
import CsvImport from "./pages/CsvImport";
import BudgetActual from "./pages/BudgetActual";
import MonthlyReport from "./pages/MonthlyReport";
import Partners from "./pages/Partners";
import PartnerDetail from "./pages/PartnerDetail";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/cases"} component={CasesList} />
        <Route path={"/cases/new"} component={CaseNew} />
        <Route path={"/cases/import"} component={CsvImport} />
        <Route path={"/budget"} component={BudgetActual} />
        <Route path={"/reports/monthly"} component={MonthlyReport} />
        <Route path={"/partners"} component={Partners} />
        <Route path={"/partners/:id"}>
          {(params) => <PartnerDetail id={Number(params.id)} />}
        </Route>
        <Route path={"/cases/:id/ledger"}>
          {(params) => <PhotoLedger id={Number(params.id)} />}
        </Route>
        <Route path={"/cases/:id"}>
          {(params) => <CaseDetail id={Number(params.id)} />}
        </Route>
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
