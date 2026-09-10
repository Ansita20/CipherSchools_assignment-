import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAttempt, getProblem, submitAttempt } from "../api/client";
import type { Attempt, Problem, Submission } from "../types";

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function AttemptWorkspacePage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [sections, setSections] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!attemptId) return;

    (async () => {
      let attempt: Attempt & { submission: Submission | null };
      try {
        attempt = await getAttempt(attemptId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return;
      }

      if (attempt.status === "submitted" && attempt.submission) {
        navigate(`/submissions/${attempt.submission.id}`, { replace: true });
        return;
      }

      try {
        const p = await getProblem(attempt.problemId);
        setProblem(p);
        setSections(Object.fromEntries(p.submissionTemplate.map((f) => [f.key, ""])));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [attemptId, navigate]);

  async function handleSubmit() {
    if (!attemptId || !problem) return;
    setSubmitting(true);
    setError(null);
    try {
      const sectionList = problem.submissionTemplate.map((f) => ({ key: f.key, text: sections[f.key] ?? "" }));
      const res = await submitAttempt(attemptId, sectionList);
      navigate(`/submissions/${res.submission.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  if (error) return <p className="error-box">{error}</p>;
  if (!problem) return <p className="muted">Loading...</p>;

  return (
    <div>
      <h1>{problem.title}</h1>
      <p className="muted">{problem.summary}</p>

      {problem.submissionTemplate.map((field) => {
        const text = sections[field.key] ?? "";
        const words = wordCount(text);
        const met = words >= field.minWords;
        return (
          <div className="field" key={field.key}>
            <label htmlFor={field.key}>{field.label}</label>
            <p className="field-help">{field.helpText}</p>
            <textarea
              id={field.key}
              value={text}
              onChange={(e) => setSections((s) => ({ ...s, [field.key]: e.target.value }))}
            />
            <div className={`field-count ${met ? "ok" : "short"}`}>
              {words} / {field.minWords} words
            </div>
          </div>
        );
      })}

      <button onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Submitting..." : "Submit for feedback"}
      </button>
    </div>
  );
}
