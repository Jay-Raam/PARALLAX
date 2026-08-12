import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { env, isMemoryRedis } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDatabase } from "./db/index.js";
import { createGraphQLServer } from "./graphql/schema.js";
import { authRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { webhookRouter } from "./routes/webhooks.js";
import { closeRedis } from "./lib/redis.js";
import { rateLimiter } from "./lib/rateLimit.js";
import { pubsub } from "./graphql/pubsub.js";
import "./models/index.js";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/use/ws";


export async function startServer() {
  await connectDatabase();

  const app = express();
  app.set("trust proxy", true);
  app.disable("x-powered-by");

  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
      credentials: true,
    }),
  );
  app.use(cookieParser());

  // Debug incoming cookies & request details
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.debug(
      {
        path: req.path,
        cookies: req.cookies ? Object.keys(req.cookies) : [],
        hasSessionCookie: Boolean(req.cookies?.parallax_session),
        origin: req.headers.origin,
        secure: req.secure,
        protocol: req.protocol,
      },
      "Incoming request cookie debug",
    );
    next();
  });

  // Capture raw body for webhook signature verification
  app.use(
    express.json({
      limit: "1mb",
      verify: (req: Request, _res: Response, buf: Buffer) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(
    pinoHttp({
      logger,
      genReqId: () => randomUUID(),
      customProps: (req) => {
        const session = (req as Request & { cookies?: Record<string, string> }).cookies?.parallax_session;
        let userId: string | undefined;
        try {
          if (session) {
            const body = session.split(".")[0];
            if (body) userId = (JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { userId?: string }).userId;
          }
        } catch {
          // ignore malformed cookies
        }
        return { requestId: (req as Request & { id?: string }).id, userId };
      },
    }),
  );

  app.use(healthRouter);

  const yoga = createGraphQLServer(pubsub);
  app.use(
    yoga.graphqlEndpoint,
    rateLimiter({ limit: env.RATE_LIMIT_MAX, windowMs: env.RATE_LIMIT_WINDOW_MS, keyPrefix: "graphql" }),
    yoga as unknown as express.RequestHandler,
  );

  app.use("/auth", authRouter);
  app.use("/webhooks", webhookRouter);

  // 404 + error handling
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err: err.message, path: req.path }, "Unhandled request error");
    res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" } });
  });

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, mode: env.NODE_ENV, workerMode: env.WORKER_MODE }, "PARALLAX API listening");
  });

  // Setup WebSocket subscription server
  const wsServer = new WebSocketServer({
    server,
    path: yoga.graphqlEndpoint,
  });

  const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
    const cookies: Record<string, string> = {};
    if (!cookieHeader) return cookies;
    for (const part of cookieHeader.split(";")) {
      const [key, val] = part.split("=");
      if (key && val) {
        cookies[key.trim()] = decodeURIComponent(val.trim());
      }
    }
    return cookies;
  };

  useServer(
    {
      execute: (args: any) => args.rootValue.execute(args),
      subscribe: (args: any) => args.rootValue.subscribe(args),
      onConnect: async (ctx: any) => {
        logger.info({ headers: ctx.extra.request.headers }, "WebSocket client connected");
      },
      onDisconnect: async (ctx: any, code: any, reason: any) => {
        logger.info({ code, reason }, "WebSocket client disconnected");
      },
      onSubscribe: async (ctx: any, id: any, payload: any) => {
        logger.info({ subscriptionId: id }, "WebSocket subscription requested");
        try {
          const req = ctx.extra.request as any;
          if (req && !req.cookies) {
            req.cookies = parseCookies(req.headers.cookie);
          }

          const { schema, execute, subscribe, contextFactory, parse, validate } = yoga.getEnveloped({
            ...ctx,
            req,
            res: {} as any,
            socket: ctx.extra.socket,
            params: payload,
          });

          const args = {
            schema,
            operationName: payload.operationName,
            document: parse(payload.query),
            variableValues: payload.variables,
            contextValue: await contextFactory(),
            rootValue: { execute, subscribe },
          };

          const errors = validate(args.schema, args.document);
          if (errors.length) {
            logger.warn({ errors }, "WebSocket subscription validation failed");
            return errors;
          }
          logger.info({ subscriptionId: id }, "WebSocket subscription validation passed");
          return args;
        } catch (err: any) {
          logger.error({ err: err.message, stack: err.stack }, "Error in WebSocket onSubscribe");
          throw err;
        }
      },
    },
    wsServer,
  );

  // Embedded worker mode (single-process dev without Redis)
  if (env.WORKER_MODE === "embedded" || isMemoryRedis) {
    const { registerProcessors } = await import("./worker/processors.js");
    registerProcessors();
    logger.info("Embedded workers registered");
  }

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down");
    server.close();
    await closeRedis();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  return server;
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((err) => {
    logger.fatal({ err: (err as Error).message }, "API failed to start");
    process.exit(1);
  });
}
