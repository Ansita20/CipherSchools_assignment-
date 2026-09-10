import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAttempts, listProblems } from "../api/client";
import type { AttemptSummary, Problem } from "../types";

export default function HistoryPage() {
  const [attempts, setAttempts] = useState<AttemptSummary[] | null>(null);
  const [problems, setProblems] = useState<Record<string, Problem>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listAttempts(), listProblems()])
      .then(([attemptList, problemList]) => {
        setAttempts(attemptList);
        setProblems(Object.fromEntries(problemList.map((p) => [p.id, p])));
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error-box">{error}</p>;
  if (!attempts) return <p className="muted">Loading...</p>;

  if (attempts.length === 0) {
    return (
      <div>
        <h1>History</h1>
        <p className="muted">
          No attempts yet. <Link to="/">Pick a problem</Link> to get started.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1>History</h1>
      <table>
        <thead>
          <tr>
            <th>Problem</th>
            <th>Started</th>
            <th>Status</th>
            <th>Score</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((attempt) => (
            <tr key={attempt.id}>
              <td>{problems[attempt.problemId]?.title ?? attempt.problemId}</td>
              <td>{new Date(attempt.startedAt).toLocaleString()}</td>
              <td>
                <span className={`badge status-${attempt.status}`}>{attempt.status}</span>
              </td>
              <td>{attempt.evaluation?.overallScore ? `${attempt.evaluation.overallScore} / 5` : "-"}</td>
              <td>
                {attempt.submissionId ? (
                  <Link to={`/submissions/${attempt.submissionId}`}>View feedback</Link>
                ) : (
                  <Link to={`/attempts/${attempt.id}`}>Continue</Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
