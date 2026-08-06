import type { Model, FilterQuery, QueryOptions } from "mongoose";
import { ValidationError } from "./errors.js";

export interface PaginationArgs {
  first?: number | null;
  after?: string | null;
  last?: number | null;
  before?: string | null;
}

export interface PageResult<T> {
  edges: { node: T; cursor: string }[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  totalCount: number;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function decodeCursor(cursor: string | null | undefined): Record<string, unknown> | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed;
  } catch {
    throw new ValidationError("Invalid pagination cursor");
  }
}

function encodeCursor(keys: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(keys), "utf8").toString("base64url");
}

/**
 * Cursor pagination over a Mongoose model.
 * The cursor encodes the last edge's sort values, so it works with any sort keys.
 */
export async function paginate<T>(
  model: Model<T>,
  filter: FilterQuery<T>,
  args: PaginationArgs,
  sortField = "createdAt",
  extraSort: Record<string, 1 | -1> = {},
): Promise<PageResult<T>> {
  const first = args.first ?? (args.after ? MAX_PAGE_SIZE : DEFAULT_PAGE_SIZE);
  const last = args.last;
  const sort: Record<string, 1 | -1> = { [sortField]: -1, _id: -1, ...extraSort };

  if (first && first > MAX_PAGE_SIZE) {
    throw new ValidationError(`"first" may not exceed ${MAX_PAGE_SIZE}`);
  }
  if (last && last > MAX_PAGE_SIZE) {
    throw new ValidationError(`"last" may not exceed ${MAX_PAGE_SIZE}`);
  }
  if (first && last) {
    throw new ValidationError('Provide either "first" or "last", not both');
  }

  const after = decodeCursor(args.after);
  const before = decodeCursor(args.before);

  const condition: FilterQuery<T> = { ...filter };

  // Build cursor predicate for the (sortField, _id) tuple with sortField descending
  const applyCursor = (cursor: Record<string, unknown>, direction: "after" | "before") => {
    const value = cursor[sortField];
    const id = cursor._id;
    const operator = direction === "after" ? { $lt: value, $or: undefined } : { $gt: value };
    if (operator.$or) {
      (condition as Record<string, unknown>).$or = [
        { [sortField]: { $lt: value }, _id: { $gt: id } },
        { [sortField]: { $lt: value }, _id: { $lte: id } },
      ];
    } else {
      (condition as Record<string, unknown>).$or = [
        { [sortField]: { $gt: value } },
        { [sortField]: value, _id: { $lt: id } },
      ];
    }
    void operator;
  };

  if (after) applyCursor(after, "after");
  if (before) applyCursor(before, "before");

  const totalCount = await model.countDocuments(filter).lean();
  const effectiveLimit = last ?? first;
  const effectiveSort = last ? invertSort(sort) : sort;

  const docs = await model
    .find(condition)
    .sort(effectiveSort)
    .limit(effectiveLimit + 1)
    .lean()
    .exec();

  const hasExtra = docs.length > effectiveLimit;
  const page = docs.slice(0, effectiveLimit);

  // If using `last`, we fetched in reverse — flip back for stable ordering
  const ordered = last ? [...page].reverse() : page;
  const hasNext = last ? false : hasExtra;
  const hasPrevious = last ? hasExtra : Boolean(before);

  const edges = ordered.map((doc) => ({
    node: doc as unknown as T,
    cursor: encodeCursor({
      [sortField]: (doc as unknown as Record<string, unknown>)[sortField],
      _id: String((doc as unknown as Record<string, unknown>)._id),
    }),
  }));

  return {
    edges,
    pageInfo: {
      hasNextPage: hasNext,
      hasPreviousPage: hasPrevious,
      startCursor: edges[0]?.cursor ?? null,
      endCursor: edges[edges.length - 1]?.cursor ?? null,
    },
    totalCount,
  };
}

function invertSort(sort: Record<string, 1 | -1>): Record<string, 1 | -1> {
  const inverted: Record<string, 1 | -1> = {};
  for (const [key, dir] of Object.entries(sort)) {
    inverted[key] = dir === 1 ? -1 : 1;
  }
  return inverted;
}

/** Option to run lean projections by default on pagination queries. */
export const leanOptions: QueryOptions = { lean: true };
