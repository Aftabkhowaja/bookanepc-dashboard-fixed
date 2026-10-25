import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import handler from "./api/chat.js";
import health from "./api/health.js";

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function vercelResponse(res) {
  const wrapped = {
    statusCode: 200,
    setHeader(name, value) {
      res.setHeader(name, value);
      return wrapped;
    },
    status(code) {
      wrapped.statusCode = code;
      res.statusCode = code;
      return wrapped;
    },
    json(payload) {
      if (!res.headersSent) {
        res.statusCode = wrapped.statusCode;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      res.end(JSON.stringify(payload));
    },
  };
  return wrapped;
}

function localChatApi() {
  const attach = (middlewares) => {
    middlewares.use("/api/health", async (req, res) => {
      await health(req, vercelResponse(res));
    });
    middlewares.use("/api/chat", async (req, res) => {
      try {
        req.body = await readRawBody(req);
        await handler(req, vercelResponse(res));
      } catch (error) {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: error.message || "Chat request failed." }));
        }
      }
    });
  };

  return {
    name: "local-chat-api",
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), localChatApi()],
});
