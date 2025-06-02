import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "../client/dist");

  console.log("Checking for build directory at:", distPath);
  console.log("Build directory exists:", fs.existsSync(distPath));

  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}.` +
      `\nPlease ensure you have run the build command.`
    );
    // In production, serve a simple message instead of crashing
    app.get("*", (_req, res) => {
      res.status(500).send(`
        <html>
          <body>
            <h1>Build Error</h1>
            <p>The application build directory was not found. Please run 'npm run build' first.</p>
            <p>Build directory expected at: ${distPath}</p>
          </body>
        </html>
      `);
    });
    return;
  }

  // Serve static files
  app.use(express.static(distPath));

  // Catch-all handler: send back React's index.html file for SPA routing
  app.get("*", (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    console.log("Serving index.html from:", indexPath);
    res.sendFile(indexPath);
  });
}