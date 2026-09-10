import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getProblem, startAttempt } from "../api/client";
import type { Problem } from "../types";

export default function ProblemDetailPage() {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!problemId) return;
    getProblem(problemId)
      .then(setProblem)
      .catch((err) => setError(err.message));
  }, [problemId]);

  async function handleStart() {
    if (!problemId) return;
    setStarting(true);
    try {
      const attempt = await startAttempt(problemId);
      navigate(`/attempts/${attempt.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStarting(false);
    }
  }

  if (error) return <p className="error-box">{error}</p>;
  if (!problem) return <p className="muted">Loading...</p>;

  return (
    <div>
      <span className={`badge ${problem.difficulty}`}>{problem.difficulty}</span>
      <h1>{problem.title}</h1>
      <p>{problem.summary}</p>

      <h2>Requirements</h2>
      <ul>
        {problem.requirements.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      <h2>Constraints</h2>
      <ul>
        {problem.constraints.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>

      <button onClick={handleStart} disabled={starting}>
        {starting ? "Starting..." : "Start attempt"}
      </button>
    </div>
  );
}
