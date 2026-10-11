import { APIRequestContext, APIResponse } from "@playwright/test";
import { attachApiInteraction } from "./allureLogging";

async function attachAndReturn(
  response: APIResponse,
  method: string,
  url: string,
  data?: unknown,
  headers?: Record<string, string>
) {
  const responseBody = await response.text();
  await attachApiInteraction({
    method,
    url,
    requestBody: data,
    requestHeaders: headers,
    status: response.status(),
    responseBody
  });
  return response;
}

export async function apiPost(
  request: APIRequestContext,
  url: string,
  data: unknown,
  headers?: Record<string, string>
): Promise<APIResponse> {
  const response = await request.post(url, {
    data,
    headers
  });
  return attachAndReturn(response, "POST", url, data, headers);
}

export async function apiPut(
  request: APIRequestContext,
  url: string,
  data: unknown,
  headers?: Record<string, string>
): Promise<APIResponse> {
  const response = await request.put(url, {
    data,
    headers
  });
  return attachAndReturn(response, "PUT", url, data, headers);
}
