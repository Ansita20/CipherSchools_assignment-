import { useEffect, useState } from "react";
import { checkHealth } from "./api/client";

// Placeholder shell: proves the React app, Vite dev proxy, dotenv-driven
// backend config and CORS are all wired together. Real routing between
// ProblemList -> ProblemDetail -> AttemptWorkspace -> Feedback -> History
// pages replaces this once the domain/application layers exist.
export default function App() {
  const [status, setStatus] = useState<"checking" | "ok" | "error">("checking");

  useEffect(() => {
    checkHealth()
      .then(() => setStatus("ok"))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>LLD Practice Platform</h1>
      <p>
        Backend connection:{" "}
        {status === "checking" && "checking..."}
        {status === "ok" && "connected"}
        {status === "error" && "unreachable (is the backend running on :4000?)"}
      </p>
    </main>
  );
}
