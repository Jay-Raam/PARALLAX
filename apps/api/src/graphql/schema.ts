import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { defaultFieldResolver, type GraphQLFieldResolver } from "graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { createYoga, type YogaServerInstance } from "graphql-yoga";
import type { Request, Response } from "express";
import { buildContext, type GraphQLContext } from "./context.js";
import { queryResolvers } from "./resolvers/query.js";
import { mutationResolvers } from "./resolvers/mutation.js";
import { subscriptionResolvers } from "./resolvers/subscription.js";
import { typeFields } from "./resolvers/typeFields.js";
import { depthLimitRule, complexityLimitRule } from "./security.js";
import type { PubSubInstance } from "./pubsub.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, "../../../../packages/graphql/src/schema.graphql");
const typeDefs = readFileSync(schemaPath, "utf8");

/**
 * Global default resolver. Mongoose `.lean()` documents expose `_id` but not
 * `id`, so every GraphQL type declaring `id: ID!` would resolve null without
 * this mapping. Everything else falls through to graphql's default resolver.
 */
const resolveId: GraphQLFieldResolver<unknown, GraphQLContext> = (source, args, context, info) => {
  if (info.fieldName === "id" && source && typeof source === "object" && !("id" in source) && "_id" in source) {
    return String((source as { _id: unknown })._id);
  }
  return defaultFieldResolver(source, args, context, info);
};

export const schema = makeExecutableSchema({
  typeDefs,
  defaultFieldResolver: resolveId,
  resolvers: {
    Query: queryResolvers,
    Mutation: mutationResolvers,
    Subscription: subscriptionResolvers,
    ...typeFields,
  },
});

export type GraphQLServer = YogaServerInstance<{ req: Request; res: Response }, GraphQLContext>;

export function createGraphQLServer(pubsub: PubSubInstance): GraphQLServer {
  return createYoga<{ req: Request; res: Response }, GraphQLContext>({
    schema,
    context: (initialContext) => buildContext(initialContext.req, initialContext.res, pubsub),
    graphiql: env.NODE_ENV !== "production",
    maskedErrors: false,
    logging: {
      debug: (...args: unknown[]) => logger.debug(...(args as [string])),
      info: (...args: unknown[]) => logger.info(...(args as [string])),
      warn: (...args: unknown[]) => logger.warn(...(args as [string])),
      error: (...args: unknown[]) => logger.error(...(args as [string])),
    },
    plugins: [
      {
        onValidate({ addValidationRule }: { addValidationRule: (rule: unknown) => void }) {
          addValidationRule(depthLimitRule(env.GRAPHQL_MAX_DEPTH));
          addValidationRule(complexityLimitRule(env.GRAPHQL_MAX_COMPLEXITY));
        },
      },
    ],
    graphqlEndpoint: "/graphql",
  });
}
