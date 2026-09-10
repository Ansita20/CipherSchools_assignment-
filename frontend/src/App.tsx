import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppHeader from "./components/AppHeader";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import AttemptWorkspacePage from "./pages/AttemptWorkspacePage";
import FeedbackPage from "./pages/FeedbackPage";
import HistoryPage from "./pages/HistoryPage";
import LoginPage from "./pages/LoginPage";
import ProblemDetailPage from "./pages/ProblemDetailPage";
import ProblemListPage from "./pages/ProblemListPage";
import SignupPage from "./pages/SignupPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-shell">
          <AppHeader />
          <main className="app-main">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<ProblemListPage />} />
                <Route path="/problems/:problemId" element={<ProblemDetailPage />} />
                <Route path="/attempts/:attemptId" element={<AttemptWorkspacePage />} />
                <Route path="/submissions/:submissionId" element={<FeedbackPage />} />
                <Route path="/history" element={<HistoryPage />} />
              </Route>
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
