import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getSubmissionStatus, retryEvaluation, startAttempt } from "../api/client";
import type { SubmitResponse } from "../types";

const POLL_MS = 1500;

export default function FeedbackPage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();

  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [startingNext, setStartingNext] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!submissionId) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await getSubmissionStatus(submissionId!);
        if (cancelled) return;
        setResult(res);
        if (res.evaluation.status === "queued" || res.evaluation.status === "running") {
          timer.current = setTimeout(poll, POLL_MS);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
  }, [submissionId]);

  async function handleRetry() {
    if (!submissionId) return;
    setRetrying(true);
    try {
      await retryEvaluation(submissionId);
      const res = await getSubmissionStatus(submissionId);
      setResult(res);
      if (res.evaluation.status === "queued" || res.evaluation.status === "running") {
        timer.current = setTimeout(async () => {
          const next = await getSubmissionStatus(submissionId);
          setResult(next);
        }, POLL_MS);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRetrying(false);
    }
  }

  async function handleTryAgain() {
    if (!result) return;
    setStartingNext(true);
    try {
      const attempt = await startAttempt(result.submission.problemId);
      navigate(`/attempts/${attempt.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStartingNext(false);
    }
  }

  if (error) return <p className="error-box">{error}</p>;
  if (!result) return <p className="muted">Loading...</p>;

  const { evaluation } = result;
  const isRubricFeedback = evaluation.feedback !== null && evaluation.feedback.criteria.length > 0;

  return (
    <div>
      <h1>Feedback</h1>
      <span className={`badge status-${evaluation.status}`}>{evaluation.status}</span>

      {(evaluation.status === "queued" || evaluation.status === "running") && (
        <p style={{ marginTop: "1rem" }}>
          <span className="spinner" />
          Evaluating your design - this page will update automatically.
        </p>
      )}

      {evaluation.status === "failed" && (
        <div className="error-box">
          <p style={{ margin: "0 0 0.5rem" }}>Evaluation failed: {evaluation.error}</p>
          <button onClick={handleRetry} disabled={retrying}>
            {retrying ? "Retrying..." : "Retry evaluation"}
          </button>
        </div>
      )}

      {evaluation.status === "completed" && evaluation.feedback && (
        <div style={{ marginTop: "1rem" }}>
          {isRubricFeedback && (
            <p>
              Overall score: <span className="score">{evaluation.feedback.overallScore} / 5</span>
            </p>
          )}
          <p>{evaluation.feedback.summary}</p>

          {evaluation.feedback.criteria.map((c) => (
            <div className="criterion" key={c.criterion}>
              <div className="criterion-head">
                <span className="criterion-name">{c.criterion.replace(/_/g, " ")}</span>
                <span className="score">{c.score} / 5</span>
              </div>
              <p className="criterion-line">
                <b>Evidence:</b> {c.evidence}
              </p>
              {c.concern && (
                <p className="criterion-line">
                  <b>Concern:</b> {c.concern}
                </p>
              )}
              {c.suggestion && (
                <p className="criterion-line">
                  <b>Suggestion:</b> {c.suggestion}
                </p>
              )}
            </div>
          ))}

          {evaluation.completeness.missingConcepts.length > 0 && (
            <p className="muted">
              Not mentioned: {evaluation.completeness.missingConcepts.join(", ")} - worth checking those were
              considered.
            </p>
          )}
        </div>
      )}

      {(evaluation.status === "completed" || evaluation.status === "failed") && (
        <div style={{ marginTop: "1.5rem" }}>
          <button onClick={handleTryAgain} disabled={startingNext}>
            {startingNext ? "Starting..." : "Try this problem again"}
          </button>{" "}
          <Link to="/history">View history</Link>
        </div>
      )}
    </div>
  );
}
