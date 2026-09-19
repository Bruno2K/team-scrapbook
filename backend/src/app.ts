import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "./openapi.js";
import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import feedRoutes from "./routes/feedRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";
import scrapRoutes from "./routes/scrapRoutes.js";
import communityRoutes from "./routes/communityRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import aiActionsRoutes from "./routes/aiActionsRoutes.js";
import { notificationRoutes } from "./modules/notifications/index.js";
import {
  correlationMiddleware,
  httpObservabilityMiddleware,
  metricsHandler,
  unhandledErrorMiddleware,
} from "./platform/observability/index.js";

const app = express();

app.use(correlationMiddleware);
app.use(httpObservabilityMiddleware);
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? "http://localhost:8080",
  exposedHeaders: ["X-Request-Id"],
}));
app.use(express.json());
app.get("/metrics", metricsHandler);

// Swagger / OpenAPI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get("/api-docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(openApiSpec);
});

app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/users", notificationRoutes);
app.use("/users", userRoutes);
app.use("/feed", feedRoutes);
app.use("/comments", commentRoutes);
app.use("/scraps", scrapRoutes);
app.use("/communities", communityRoutes);
app.use("/upload", uploadRoutes);
app.use("/chat", chatRoutes);
app.use("/ai-actions", aiActionsRoutes);
app.use(unhandledErrorMiddleware);

export default app;
