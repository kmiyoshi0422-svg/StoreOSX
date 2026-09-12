import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import AdminOnly from "./components/AdminOnly";

// ─── Eagerly loaded (critical path) ───────────────────────
import Home from "./pages/Home";
import CasesList from "./pages/CasesList";

// ─── Lazily loaded pages (code-split) ─────────────────────
const CaseNew = lazy(() => import("./pages/CaseNew"));
const CaseDetail = lazy(() => import("./pages/CaseDetail"));
const PhotoLedger = lazy(() => import("./pages/PhotoLedger"));
const PhotoLedgerBatch = lazy(() => import("./pages/PhotoLedgerBatch"));
const CaseReport = lazy(() => import("./pages/CaseReport"));
const CompletionReport = lazy(() => import("./pages/CompletionReport"));
const CsvImport = lazy(() => import("./pages/CsvImport"));
const CasePdfImport = lazy(() => import("./pages/CasePdfImport"));
const CasesMap = lazy(() => import("./pages/CasesMap"));
const PartnerImport = lazy(() => import("./pages/PartnerImport"));
const EstimateImport = lazy(() => import("./pages/EstimateImport"));
const EstimateOcrExcel = lazy(() => import("./pages/EstimateOcrExcel"));
const ExpenseImport = lazy(() => import("./pages/ExpenseImport"));
const ExpenseByUser = lazy(() => import("./pages/ExpenseByUser"));
const ExpenseList = lazy(() => import("./pages/ExpenseList"));
const ExpenseSubmit = lazy(() => import("./pages/ExpenseSubmit"));
const ExpenseApprove = lazy(() => import("./pages/ExpenseApprove"));
const Reports = lazy(() => import("./pages/Reports"));
const BudgetActual = lazy(() => import("./pages/BudgetActual"));
const MonthlyReport = lazy(() => import("./pages/MonthlyReport"));
const Partners = lazy(() => import("./pages/Partners"));
const PartnerDetail = lazy(() => import("./pages/PartnerDetail"));
const PartnerView = lazy(() => import("./pages/PartnerView"));
const StoresList = lazy(() => import("./pages/StoresList"));
const StoreDetail = lazy(() => import("./pages/StoreDetail"));
const Workload = lazy(() => import("./pages/Workload"));
const FullwidthExclusions = lazy(() => import("./pages/FullwidthExclusions"));
const ImpressionSettings = lazy(() => import("./pages/ImpressionSettings"));
const RainLeakInspection = lazy(() => import("./pages/RainLeakInspection"));
const DocumentLibrary = lazy(() => import("./pages/DocumentLibrary"));
const CrossSchedule = lazy(() => import("./pages/CrossSchedule"));
const Effectiveness = lazy(() => import("./pages/Effectiveness"));
const CompletedReports = lazy(() => import("./pages/CompletedReports"));
const PdfHistory = lazy(() => import("./pages/PdfHistory"));

// ─── Loading fallback ─────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* 協力業者向け公開ビュー（サイドバーなし、未ログインでも閲覧可） */}
        <Route path={"/partner-view/:token"}>
          {(params) => <PartnerView token={String(params.token)} />}
        </Route>

        {/* 社内向けダッシュボード */}
        <Route>
          <DashboardLayout>
            <Suspense fallback={<PageLoader />}>
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
                <Route path={"/expenses/submit"} component={ExpenseSubmit} />
                <Route path={"/expenses/approve"}>
                  <AdminOnly>
                    <ExpenseApprove />
                  </AdminOnly>
                </Route>
                <Route path={"/expenses/list"}>
                  <AdminOnly>
                    <ExpenseList />
                  </AdminOnly>
                </Route>
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
                <Route path={"/reports/completed"}>
                  <AdminOnly><CompletedReports /></AdminOnly>
                </Route>
                <Route path={"/pdf-history"} component={PdfHistory} />
                <Route path={"/stores"} component={StoresList} />
                <Route path={"/stores/:id"}>
                  {(params) => <StoreDetail id={Number(params.id)} />}
                </Route>
                <Route path={"/workload"} component={Workload} />
                <Route path={"/cross-schedule"} component={CrossSchedule} />
                <Route path={"/effectiveness"}>
                  <AdminOnly><Effectiveness /></AdminOnly>
                </Route>
                <Route path={"/settings/exclusions"} component={FullwidthExclusions} />
                <Route path={"/settings/impression"} component={ImpressionSettings} />
                <Route path={"/document-library"} component={DocumentLibrary} />
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
            </Suspense>
          </DashboardLayout>
        </Route>
      </Switch>
    </Suspense>
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
