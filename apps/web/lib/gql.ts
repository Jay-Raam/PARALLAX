import { GraphQLClient } from "graphql-request";
import type { DocumentNode } from "graphql";
import { createClient, type Client as WsClient } from "graphql-ws";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
export const GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_URL ?? `${API_URL}/graphql`;
export const WS_URL = GRAPHQL_URL.replace(/^http/, "ws");
export const API_ORIGIN = API_URL;

/**
 * The single typed entry point for all server state.
 * Every request carries the httpOnly session cookie.
 */
export const gql = new GraphQLClient(GRAPHQL_URL, {
  credentials: "include",
  fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
});

export async function gqlRequest<T>(document: string | DocumentNode, variables?: Record<string, unknown>): Promise<T> {
  return gql.request<T>(document, variables);
}

let wsClient: WsClient | null = null;

export function getWsClient(): WsClient {
  if (!wsClient) {
    wsClient = createClient({
      url: WS_URL,
      retryAttempts: 5,
      lazy: true,
    });
  }
  return wsClient;
}

/** GraphQL error → friendly message mapping. */
export function graphqlErrorMessage(err: unknown): string {
  const e = err as {
    response?: { errors?: Array<{ message: string; extensions?: { code?: string } }> };
    message?: string;
  };
  const first = e?.response?.errors?.[0];
  if (first?.message) return first.message;
  if (e?.message) return e.message;
  return "Something went wrong.";
}
