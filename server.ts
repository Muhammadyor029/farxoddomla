import "dotenv/config";
import express from "express";
import path from "node:path";
import { createServer as createViteServer } from "vite";
import { createApp } from "./server/app";

async function startServer() {
  const { app } = createApp();
  const port = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("/{*path}", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`HUQUQ OLAMI server running at http://0.0.0.0:${port} (${isProd ? "production" : "development"})`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start HUQUQ OLAMI server:", err);
  process.exit(1);
});
