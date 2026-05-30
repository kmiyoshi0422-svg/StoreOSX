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

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/cases"} component={CasesList} />
        <Route path={"/cases/new"} component={CaseNew} />
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
