import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { env } from "./env.js";
import { analyzeRouter } from "./routes/analyze.js";
import { healthRouter } from "./routes/health.js";
import { searchRouter } from "./routes/search.js";
import { HttpError } from "./types.js";

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (env.FRONTEND_URL && origin === env.FRONTEND_URL) {
        callback(null, true);
        return;
      }

      if (!env.FRONTEND_URL && env.NODE_ENV !== "production") {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "1mb" }));

app.use("/api", healthRouter);
app.use("/api", searchRouter);
app.use("/api", analyzeRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({
        error: error.message,
        ...(error.details ? { details: error.details } : {}),
      });
      return;
    }

    console.error("[server] unexpected error", error);
    res.status(500).json({ error: "Internal server error" });
  },
);

app.listen(env.PORT, () => {
  console.log(`spy-response-backend listening on port ${env.PORT}`);
});
