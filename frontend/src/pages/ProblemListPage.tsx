import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listProblems } from "../api/client";
import type { Problem } from "../types";

export default function ProblemListPage() {
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProblems()
      .then(setProblems)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error-box">{error}</p>;
  if (!problems) return <p className="muted">Loading problems...</p>;

  return (
    <div>
      <h1>Practice a design</h1>
      <p className="muted">Pick a problem, write out your design, and get feedback.</p>

      {problems.map((problem) => (
        <Link to={`/problems/${problem.id}`} className="card-link" key={problem.id}>
          <div className="card">
            <span className={`badge ${problem.difficulty}`}>{problem.difficulty}</span>
            <h2 style={{ margin: "0.4rem 0 0.3rem" }}>{problem.title}</h2>
            <p className="muted" style={{ margin: 0 }}>
              {problem.summary}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
