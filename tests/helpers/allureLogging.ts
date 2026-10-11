import { test } from "@playwright/test";

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function attach(name: string, body: string, contentType: string) {
  try {
    await test.info().attach(name, {
      body: Buffer.from(body, "utf-8"),
      contentType
    });
  } catch {
    // Ignore attachment failures to avoid impacting test execution.
  }
}

export async function attachApiInteraction(input: {
  method: string;
  url: string;
  requestBody?: unknown;
  requestHeaders?: Record<string, string>;
  status: number;
  responseBody: string;
}) {
  await attach(
    `API Request: ${input.method} ${input.url}`,
    safeJson({
      method: input.method,
      url: input.url,
      headers: input.requestHeaders ?? {},
      body: input.requestBody ?? null
    }),
    "application/json"
  );
  await attach(
    `API Response: ${input.method} ${input.url}`,
    safeJson({
      status: input.status,
      body: tryParseJson(input.responseBody)
    }),
    "application/json"
  );
}

export async function attachDbOperation(input: {
  operation: string;
  sql: string;
  params?: unknown[];
  result?: unknown;
}) {
  await attach(
    `DB Operation: ${input.operation}`,
    safeJson({
      sql: input.sql,
      params: input.params ?? [],
      result: input.result ?? null
    }),
    "application/json"
  );
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
