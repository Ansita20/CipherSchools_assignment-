import type { Attempt, AttemptSummary, EvaluationView, Learner, Problem, Submission, SubmissionSection, SubmitResponse } from "../types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? `request failed with status ${res.status}`, res.status);
  }

  return res.status === 204 ? (undefined as T) : res.json();
}

export interface HealthResponse {
  status: string;
  env: string;
  aiEnabled: boolean;
}

export function checkHealth(): Promise<HealthResponse> {
  return request("/health");
}

export function signup(email: string, password: string): Promise<Learner> {
  return request("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function login(email: string, password: string): Promise<Learner> {
  return request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function logout(): Promise<void> {
  return request("/auth/logout", { method: "POST" });
}

// Not signed in is a normal, expected outcome here (e.g. on first load),
// not an error - so this resolves to null instead of throwing on a 401.
export async function getCurrentUser(): Promise<Learner | null> {
  try {
    return await request<Learner>("/auth/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export function listProblems(): Promise<Problem[]> {
  return request("/problems");
}

export function getProblem(id: string): Promise<Problem> {
  return request(`/problems/${id}`);
}

export function startAttempt(problemId: string): Promise<Attempt> {
  return request("/attempts", { method: "POST", body: JSON.stringify({ problemId }) });
}

export function listAttempts(): Promise<AttemptSummary[]> {
  return request("/attempts");
}

export function getAttempt(id: string): Promise<Attempt & { submission: Submission | null }> {
  return request(`/attempts/${id}`);
}

export function submitAttempt(attemptId: string, sections: SubmissionSection[]): Promise<SubmitResponse> {
  return request("/submissions", { method: "POST", body: JSON.stringify({ attemptId, sections }) });
}

export function getSubmissionStatus(submissionId: string): Promise<SubmitResponse> {
  return request(`/submissions/${submissionId}`);
}

export function retryEvaluation(submissionId: string): Promise<{ evaluation: EvaluationView }> {
  return request(`/submissions/${submissionId}/retry`, { method: "POST" });
}
