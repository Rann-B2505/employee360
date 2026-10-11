import { expect, test } from "@playwright/test";
import { baseEmployeeEvent } from "./fixtures/employeeEvents";
import {
  findEmployee,
  findEmployeeByEmail
} from "./helpers/dbAssertions";
import { apiPost } from "./helpers/apiClient";

function uniqueEmployeeId(prefix: string): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

test.describe("createEmployeeRecord (POST /employees)", () => {

  test("creates a valid employee record @regression", async ({ request }) => {
    const employeeId = uniqueEmployeeId("EMP-CREATE-");
    const email = `${employeeId.toLowerCase()}@company.com`;
    const response = await apiPost(
      request,
      "/employees",
      baseEmployeeEvent({ employeeId, email })
    );

    expect(response.status()).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      status: "accepted",
      employeeId,
      operation: "created"
    });

    const stored = await findEmployee(employeeId);
    expect(stored).toMatchObject({
      employee_id: employeeId,
      email,
      first_name: "Amira",
      last_name: "Khan",
      department: "Data & AI",
      location: "Cape Town",
      employment_status: "Active",
      effective_date: "2026-10-01"
    });
  });

  test("rejects missing employeeId and does not store data @regression", async ({ request }) => {
    const uniqueEmail = `missing-id-${Date.now()}@company.com`;
    const response = await apiPost(
      request,
      "/employees",
      baseEmployeeEvent({ employeeId: "", email: uniqueEmail })
    );

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      status: "rejected",
      reason: "employeeId is mandatory"
    });
    expect(await findEmployeeByEmail(uniqueEmail)).toBeUndefined();
  });

  test("normalizes mixed-case email and stores it in lowercase @regression", async ({
    request
  }) => {
    const employeeId = uniqueEmployeeId("EMP-NORM-");
    const normalizedEmail = `${employeeId.toLowerCase()}@company.com`;
    const mixedCaseEmail = `${employeeId.slice(0, 3).toUpperCase()}${employeeId
      .slice(3)
      .toLowerCase()}@CoMpAnY.CoM`;
    const mixedCaseEvent = baseEmployeeEvent({
      employeeId,
      email: mixedCaseEmail
    });

    const response = await apiPost(request, "/employees", mixedCaseEvent);
    expect(response.status()).toBe(201);

    const stored = await findEmployee(employeeId);
    expect(stored?.email).toBe(normalizedEmail);
  });

  test("rejects repeated POST for the same employee without creating duplicates @regression", async ({
    request
  }) => {
    const employeeId = uniqueEmployeeId("EMP-DUP-");
    const normalizedEmail = `${employeeId.toLowerCase()}@company.com`;
    const createEvent = baseEmployeeEvent({ employeeId, email: normalizedEmail });

    expect((await apiPost(request, "/employees", createEvent)).status()).toBe(201);
    expect((await apiPost(request, "/employees", createEvent)).status()).toBe(409);

    const stored = await findEmployee(employeeId);
    expect(stored).toMatchObject({
      employee_id: employeeId,
      email: normalizedEmail
    });
  });

  test("handles concurrent duplicate POSTs with one success and one conflict @extended", async ({
    request
  }) => {
    const employeeId = uniqueEmployeeId("EMP-CONCUR-");
    const email = `${employeeId.toLowerCase()}@company.com`;
    const payload = baseEmployeeEvent({ employeeId, email });

    const [first, second] = await Promise.all([
      apiPost(request, "/employees", payload),
      apiPost(request, "/employees", payload)
    ]);

    const statuses = [first.status(), second.status()].sort();
    expect(statuses).toEqual([201, 409]);
    const stored = await findEmployee(employeeId);
    expect(stored).toMatchObject({
      employee_id: employeeId,
      email
    });
  });

  test("processes valid records in batch while rejecting invalid ones @regression", async ({
    request
  }) => {
    const employeeId1 = uniqueEmployeeId("EMP-BATCH-A-");
    const employeeId2 = uniqueEmployeeId("EMP-BATCH-B-");
    const missingIdEmail = `missing-id-batch-${Date.now()}@company.com`;

    const response = await apiPost(request, "/employees/batch", [
      baseEmployeeEvent({ employeeId: employeeId1, email: `${employeeId1.toLowerCase()}@company.com` }),
      baseEmployeeEvent({ employeeId: "", email: missingIdEmail }),
      baseEmployeeEvent({ employeeId: employeeId2, email: `${employeeId2.toLowerCase()}@company.com` })
    ]);

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      summary: { accepted: 2, rejected: 1 }
    });
    expect(await findEmployee(employeeId1)).toBeDefined();
    expect(await findEmployee(employeeId2)).toBeDefined();
    expect(await findEmployeeByEmail(missingIdEmail)).toBeUndefined();
  });

  test("rejects duplicate-processing when the same batch is replayed @extended", async ({
    request
  }) => {
    const employeeId1 = uniqueEmployeeId("EMP-REPLAY-A-");
    const employeeId2 = uniqueEmployeeId("EMP-REPLAY-B-");
    const batchPayload = [
      baseEmployeeEvent({
        employeeId: employeeId1,
        email: `${employeeId1.toLowerCase()}@company.com`
      }),
      baseEmployeeEvent({
        employeeId: employeeId2,
        email: `${employeeId2.toLowerCase()}@company.com`
      })
    ];

    const firstRun = await apiPost(request, "/employees/batch", batchPayload);
    const replayRun = await apiPost(request, "/employees/batch", batchPayload);

    expect(firstRun.status()).toBe(200);
    await expect(firstRun.json()).resolves.toMatchObject({
      summary: { accepted: 2, rejected: 0 }
    });
    expect(replayRun.status()).toBe(200);
    await expect(replayRun.json()).resolves.toMatchObject({
      summary: { accepted: 0, rejected: 2 }
    });
    expect(await findEmployee(employeeId1)).toBeDefined();
    expect(await findEmployee(employeeId2)).toBeDefined();
  });

  test("rejects malformed JSON payloads @regression", async ({ request }) => {
    const response = await apiPost(
      request,
      "/employees",
      "{\"eventType\":\"EmployeeUpdated\",",
      { "content-type": "application/json" }
    );

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      status: "rejected",
      reason: "malformed JSON payload"
    });
  });

  test("rejects canonical email collisions across employee IDs @regression", async ({
    request
  }) => {
    const email = `shared-${Date.now()}@company.com`;
    const employee1 = uniqueEmployeeId("EMP-COLLIDE-A-");
    const employee2 = uniqueEmployeeId("EMP-COLLIDE-B-");

    await apiPost(
      request,
      "/employees",
      baseEmployeeEvent({ employeeId: employee1, email })
    );

    const response = await apiPost(
      request,
      "/employees",
      baseEmployeeEvent({ employeeId: employee2, email: ` ${email.toUpperCase()} ` })
    );

    expect(response.status()).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      status: "rejected",
      reason: "email already belongs to another employee"
    });
    expect(await findEmployee(employee1)).toBeDefined();
    expect(await findEmployee(employee2)).toBeUndefined();
  });
});
