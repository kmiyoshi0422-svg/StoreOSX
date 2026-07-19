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
import PhotoLedgerBatch from "./pages/PhotoLedgerBatch";
import CaseReport from "./pages/CaseReport";
import CompletionReport from "./pages/CompletionReport";
import CsvImport from "./pages/CsvImport";
import CasePdfImport from "./pages/CasePdfImport";
import CasesMap from "./pages/CasesMap";
import PartnerImport from "./pages/PartnerImport";
import EstimateImport from "./pages/EstimateImport";
import EstimateOcrExcel from "./pages/EstimateOcrExcel";
import ExpenseImport from "./pages/ExpenseImport";
import ExpenseByUser from "./pages/ExpenseByUser";
import Reports from "./pages/Reports";
import BudgetActual from "./pages/BudgetActual";
import MonthlyReport from "./pages/MonthlyReport";
import Partners from "./pages/Partners";
import AdminOnly from "./components/AdminOnly";
import PartnerDetail from "./pages/PartnerDetail";
import PartnerView from "./pages/PartnerView";
import StoresList from "./pages/StoresList";
import Workload from "./pages/Workload";
import FullwidthExclusions from "./pages/FullwidthExclusions";
import ImpressionSettings from "./pages/ImpressionSettings";
import RainLeakInspection from "./pages/RainLeakInspection";

function Router() {
  return (
    <Switch>
      {/* 協力業者向け公開ビュー（サイドバーなし、未ログインでも閲覧可） */}
      <Route path={"/partner-view/:token"}>
        {(params) => <PartnerView token={String(params.token)} />}
      </Route>

      {/* 社内向けダッシュボード */}
      <Route>
        <DashboardLayout>
          <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/cases"} component={CasesList} />
        <Route path={"/cases/new"} component={CaseNew} />
        <Route path={"/cases/import"} component={CsvImport} />
        <Route path={"/cases/import-pdf"} component={CasePdfImport} />
        <Route path={"/cases/map"} component={CasesMap} />
        <Route path={"/partners/import"} component={PartnerImport} />
        <Route path={"/estimates/import"} component={EstimateImport} />
        <Route path={"/estimates/ocr-excel"} component={EstimateOcrExcel} />
        <Route path={"/expenses/import"} component={ExpenseImport} />
        <Route path={"/expenses/by-user"}>
          <AdminOnly>
            <ExpenseByUser />
          </AdminOnly>
        </Route>
        <Route path={"/reports"}>
          <AdminOnly><Reports /></AdminOnly>
        </Route>
        <Route path={"/budget"}>
          <AdminOnly><BudgetActual /></AdminOnly>
        </Route>
        <Route path={"/reports/monthly"}>
          <AdminOnly><MonthlyReport /></AdminOnly>
        </Route>
        <Route path={"/stores"} component={StoresList} />
        <Route path={"/workload"} component={Workload} />
        <Route path={"/settings/exclusions"} component={FullwidthExclusions} />
        <Route path={"/settings/impression"} component={ImpressionSettings} />
        <Route path={"/rain-leak"} component={RainLeakInspection} />
        <Route path={"/partners"} component={Partners} />
        <Route path={"/partners/:id"}>
          {(params) => <PartnerDetail id={Number(params.id)} />}
        </Route>
        <Route path={"/photo-ledger/batch"} component={PhotoLedgerBatch} />
        <Route path={"/cases/:id/ledger"}>
          {(params) => <PhotoLedger id={Number(params.id)} />}
        </Route>
        <Route path={"/cases/:id/survey-report"}>
          {(params) => <CaseReport id={Number(params.id)} reportType="survey" />}
        </Route>
        <Route path={"/cases/:id/completion-report"}>
          {(params) => <CompletionReport id={Number(params.id)} />}
        </Route>
        <Route path={"/cases/:id"}>
          {(params) => <CaseDetail id={Number(params.id)} />}
        </Route>
            <Route path={"/404"} component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
      </Route>
    </Switch>
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
