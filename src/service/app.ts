import express, { NextFunction, Request, Response } from "express";
import { initializeDatabase } from "../db/employeeRepository";
import {
  EmployeeEvent,
  processEmployeeEvent
} from "./employeeEventProcessor";

function trimmedOrNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function createApp() {
  await initializeDatabase();

  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.post("/employees", async (req, res) => {
    const payload = req.body as unknown;

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      res.status(400).json({
        status: "rejected",
        reason: "payload must be a single employee object"
      });
      return;
    }

    const result = await processEmployeeEvent(payload as EmployeeEvent, "create");
    if (result.status === "accepted") {
      res.status(201).json(result);
      return;
    }
    if (result.errorType === "validation") {
      res.status(400).json(result);
      return;
    }
    if (result.errorType === "conflict") {
      res.status(409).json(result);
      return;
    }
    res.status(500).json(result);
  });

  app.put("/employees/:employeeId", async (req, res) => {
    const payload = req.body as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      res.status(400).json({
        status: "rejected",
        reason: "payload must be a single employee object"
      });
      return;
    }
    const eventPayload = {
      ...(payload as EmployeeEvent),
      employeeId: req.params.employeeId
    };
    const result = await processEmployeeEvent(eventPayload, "update");
    if (result.status === "accepted") {
      res.status(200).json(result);
      return;
    }
    if (result.errorType === "validation") {
      res.status(400).json(result);
      return;
    }
    if (result.errorType === "not_found") {
      res.status(404).json(result);
      return;
    }
    if (result.errorType === "conflict") {
      res.status(409).json(result);
      return;
    }
    res.status(500).json(result);
  });

  app.post("/employees/batch", async (req, res) => {
    const payload = req.body as unknown;
    if (!Array.isArray(payload)) {
      res.status(400).json({
        status: "rejected",
        reason: "payload must be an array of employee objects"
      });
      return;
    }
    const results = await Promise.all(
      payload.map((event) => processEmployeeEvent(event as EmployeeEvent, "create"))
    );
    const accepted = results.filter((item) => item.status === "accepted").length;
    const rejected = results.length - accepted;
    res.status(200).json({
      summary: { accepted, rejected },
      results
    });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof SyntaxError && "body" in error) {
      res.status(400).json({
        status: "rejected",
        reason: "malformed JSON payload"
      });
      return;
    }

    res.status(500).json({
      status: "rejected",
      reason: "unexpected service failure"
    });
  });

  return app;
}
