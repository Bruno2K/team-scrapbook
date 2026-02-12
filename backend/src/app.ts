import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "./openapi.js";
import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import feedRoutes from "./routes/feedRoutes.js";
import scrapRoutes from "./routes/scrapRoutes.js";
import communityRoutes from "./routes/communityRoutes.js";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:8080" }));
app.use(express.json());

// Swagger / OpenAPI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get("/api-docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(openApiSpec);
});

app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/feed", feedRoutes);
app.use("/scraps", scrapRoutes);
app.use("/communities", communityRoutes);

export default app;
