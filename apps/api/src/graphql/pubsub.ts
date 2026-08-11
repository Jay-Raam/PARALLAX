import { createPubSub } from "graphql-yoga";

/** Event map for the Yoga PubSub instance. Values are [payload] tuples. */
export type PubSubEvents = Record<string, [payload: unknown]>;

export const pubsub = createPubSub<PubSubEvents>();
export type PubSubInstance = typeof pubsub;
