import jwt from "jsonwebtoken";

export const SESSION_COOKIE_NAME = "lld_session";
const SESSION_TTL = "7d";

export function signSessionToken(learnerId: string, secret: string): string {
  return jwt.sign({ sub: learnerId }, secret, { expiresIn: SESSION_TTL });
}

// Returns the learnerId if the token is valid and unexpired, null otherwise -
// callers shouldn't need to know or care why a token was rejected.
export function verifySessionToken(token: string, secret: string): string | null {
  try {
    const payload = jwt.verify(token, secret);
    return typeof payload === "object" && typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
