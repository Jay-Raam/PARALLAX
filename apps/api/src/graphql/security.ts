import { GraphQLError, Kind, type ValidationContext, type ASTVisitor } from "graphql";
import { env } from "../config/env.js";

const EXPENSIVE_FIELDS = new Set([
  "repositories",
  "commits",
  "pullRequests",
  "issues",
  "dependencies",
  "securityAlerts",
  "workflowRuns",
  "deployments",
  "releases",
  "contributors",
  "recommendations",
  "notifications",
  "auditLogs",
  "activity",
  "search",
  "reviews",
  "files",
  "trend",
  "series",
  "edges",
  "stages",
  "activitySeries",
  "cycleTimeSeries",
  "resolutionSeries",
  "successSeries",
  "weeklyDistribution",
  "recent",
  "topOutdated",
  "latest",
]);

/**
 * Rejects queries deeper than the configured maximum. Prevents stack
 * exhaustion and expensive nested traversals.
 */
export function depthLimitRule(maxDepth: number = env.GRAPHQL_MAX_DEPTH) {
  return function depthLimitRuleFactory(context: ValidationContext): ASTVisitor {
    return {
      OperationDefinition(node) {
        let depth = 0;
        const visit = (selectionSet: typeof node.selectionSet, currentDepth: number) => {
          for (const selection of selectionSet.selections) {
            if (selection.kind === Kind.FIELD) {
              if (selection.selectionSet) {
                visit(selection.selectionSet, currentDepth + 1);
              }
            } else if (selection.kind === Kind.INLINE_FRAGMENT) {
              visit(selection.selectionSet, currentDepth);
            }
          }
          depth = Math.max(depth, currentDepth);
        };
        visit(node.selectionSet, 1);
        if (depth > maxDepth) {
          context.reportError(
            new GraphQLError(`Query exceeds maximum depth of ${maxDepth} (requested ${depth})`, {
              nodes: node,
              extensions: { code: "QUERY_TOO_DEEP" },
            }),
          );
        }
      },
    };
  };
}

/**
 * Rejects queries whose estimated cost exceeds the configured limit.
 * Connection fields are priced higher to bound database work.
 */
export function complexityLimitRule(maxComplexity: number = env.GRAPHQL_MAX_COMPLEXITY) {
  return function complexityLimitRuleFactory(context: ValidationContext): ASTVisitor {
    return {
      OperationDefinition(node) {
        const cost = computeCost(node);
        if (cost > maxComplexity) {
          context.reportError(
            new GraphQLError(
              `Query is too expensive: estimated cost ${cost} exceeds the limit of ${maxComplexity}`,
              {
                nodes: node,
                extensions: { code: "QUERY_TOO_COMPLEX", cost, maxComplexity },
              },
            ),
          );
        }
      },
    };
  };
}

function computeCost(node: { selectionSet?: { selections: readonly unknown[] } }): number {
  let cost = 0;
  const visit = (selectionSet: { selections: readonly unknown[] }, multiplier: number) => {
    for (const selection of selectionSet.selections as readonly {
      kind: Kind;
      name?: { value: string };
      selectionSet?: { selections: readonly unknown[] };
    }[]) {
      if (selection.kind === Kind.FIELD) {
        const fieldCost = EXPENSIVE_FIELDS.has(selection.name?.value ?? "") ? 10 : 1;
        cost += fieldCost * multiplier;
        if (selection.selectionSet) {
          visit(selection.selectionSet, multiplier * (fieldCost >= 10 ? 2 : 1));
        }
      } else if (selection.kind === Kind.INLINE_FRAGMENT && selection.selectionSet) {
        visit(selection.selectionSet, multiplier);
      }
    }
  };
  visit(node.selectionSet ?? { selections: [] }, 1);
  return cost;
}
