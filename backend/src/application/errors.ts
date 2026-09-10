export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Not signed in, or signed in with the wrong credentials - distinct from
// ValidationError (malformed input) so the API can return 401 instead of
// 400, and the frontend can tell "you typed something wrong" apart from
// "you need to log in" and react differently (e.g. redirect to /login).
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}
