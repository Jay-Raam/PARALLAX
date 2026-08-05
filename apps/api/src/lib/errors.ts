import { GraphQLError } from "graphql";

/** Base application error. Maps to a GraphQL error with a stable code. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }

  toGraphQLError(): GraphQLError {
    return new GraphQLError(this.message, {
      extensions: {
        code: this.code,
        status: this.status,
        details: this.details,
      },
    });
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "You must be signed in to perform this action") {
    super(message, "UNAUTHENTICATED", 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, "FORBIDDEN", 403);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, "NOT_FOUND", 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Rate limit exceeded. Please slow down and try again.") {
    super(message, "RATE_LIMITED", 429);
  }
}

export class GitHubApiError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "GITHUB_API_ERROR", 502, details);
  }
}

export class SyncError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "SYNC_ERROR", 500, details);
  }
}

export class AnalyticsError extends AppError {
  constructor(message = "Could not compute analytics") {
    super(message, "ANALYTICS_ERROR", 500);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function toGraphQLError(err: unknown): GraphQLError {
  if (err instanceof AppError) return err.toGraphQLError();
  if (err instanceof GraphQLError) return err;
  const message = err instanceof Error ? err.message : "Internal server error";
  return new GraphQLError(message, {
    extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
  });
}
