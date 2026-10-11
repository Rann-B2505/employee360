import { expect, test } from "@playwright/test";
import { baseEmployeeEvent } from "./fixtures/employeeEvents";
import { findEmployee } from "./helpers/dbAssertions";
import { apiPost, apiPut } from "./helpers/apiClient";

function uniqueEmployeeId(prefix: string): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

test.describe("updateEmployeeRecord (PUT /employees/{employeeId})", () => {

  test("updates an existing employee record @regression", async ({ request }) => {
    const employeeId = uniqueEmployeeId("EMP-UPD-");
    const email = `${employeeId.toLowerCase()}@company.com`;

    await apiPost(
      request,
      "/employees",
      baseEmployeeEvent({ employeeId, email })
    );

    const response = await apiPut(
      request,
      `/employees/${employeeId}`,
      baseEmployeeEvent({
        employeeId,
        email,
        department: "Engineering",
        location: "Johannesburg",
        effectiveDate: "2026-11-01"
      })
    );

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "accepted",
      employeeId,
      operation: "updated"
    });

    const stored = await findEmployee(employeeId);
    expect(stored).toMatchObject({
      department: "Engineering",
      location: "Johannesburg",
      effective_date: "2026-11-01"
    });
  });

  test("returns 404 when updating an employee that does not exist @regression", async ({
    request
  }) => {
    const employeeId = uniqueEmployeeId("EMP-MISSING-");
    const response = await apiPut(
      request,
      `/employees/${employeeId}`,
      baseEmployeeEvent({ employeeId })
    );

    expect(response.status()).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      status: "rejected",
      reason: "employee not found"
    });
    expect(await findEmployee(employeeId)).toBeUndefined();
  });

  test("rejects missing employeeId and does not store data @regression", async ({ request }) => {
    const response = await apiPut(request, "/employees/%20", baseEmployeeEvent());

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      status: "rejected",
      reason: "employeeId is mandatory"
    });
    expect(await findEmployee("EMP10452")).toBeUndefined();
  });

  test("rejects PUT when employeeId in body does not match URL path @regression", async ({
    request
  }) => {
    const employeeId1 = uniqueEmployeeId("EMP-MISMATCH-A-");
    const employeeId2 = uniqueEmployeeId("EMP-MISMATCH-B-");
    const email1 = `${employeeId1.toLowerCase()}@company.com`;
    const email2 = `${employeeId2.toLowerCase()}@company.com`;

    await apiPost(
      request,
      "/employees",
      baseEmployeeEvent({ employeeId: employeeId1, email: email1, department: "Data" })
    );
    await apiPost(
      request,
      "/employees",
      baseEmployeeEvent({ employeeId: employeeId2, email: email2, department: "Engineering" })
    );

    const response = await apiPut(
      request,
      `/employees/${employeeId2}`,
      baseEmployeeEvent({
        employeeId: employeeId1,
        email: email2,
        department: "Operations"
      })
    );

    expect(response.status()).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      status: "rejected",
      employeeId: employeeId2,
      reason: "employeeId in body does not match URL path"
    });

    const firstRecord = await findEmployee(employeeId1);
    const secondRecord = await findEmployee(employeeId2);
    expect(firstRecord?.department).toBe("Data");
    expect(secondRecord?.department).toBe("Engineering");
  });

  test("allows retry after validation failure when request is corrected @extended", async ({
    request
  }) => {
    const employeeId = uniqueEmployeeId("EMP-RETRY-");
    const email = `${employeeId.toLowerCase()}@company.com`;

    await apiPost(
      request,
      "/employees",
      baseEmployeeEvent({ employeeId, email, department: "Data" })
    );

    const failedAttempt = await apiPut(
      request,
      `/employees/${employeeId}`,
      baseEmployeeEvent({
        employeeId,
        email: "",
        department: "Operations"
      })
    );
    expect(failedAttempt.status()).toBe(400);
    await expect(failedAttempt.json()).resolves.toMatchObject({
      status: "rejected",
      reason: "email is mandatory"
    });

    const retryAttempt = await apiPut(
      request,
      `/employees/${employeeId}`,
      baseEmployeeEvent({
        employeeId,
        email,
        department: "Operations"
      })
    );

    expect(retryAttempt.status()).toBe(200);
    const stored = await findEmployee(employeeId);
    expect(stored?.department).toBe("Operations");
  });

  test("normalizes email and repeated PUT is accepted without duplicates @regression", async ({
    request
  }) => {
    const employeeId = uniqueEmployeeId("EMP-NORM-UPD-");
    const normalizedEmail = `${employeeId.toLowerCase()}@company.com`;
    await apiPost(
      request,
      "/employees",
      baseEmployeeEvent({ employeeId, email: normalizedEmail })
    );

    const firstUpdate = await apiPut(
      request,
      `/employees/${employeeId}`,
      baseEmployeeEvent({ employeeId, email: normalizedEmail.toUpperCase() })
    );
    const secondUpdate = await apiPut(
      request,
      `/employees/${employeeId}`,
      baseEmployeeEvent({ employeeId, email: normalizedEmail })
    );

    expect(firstUpdate.status()).toBe(200);
    expect(secondUpdate.status()).toBe(200);
    const stored = await findEmployee(employeeId);
    expect(stored?.email).toBe(normalizedEmail);
  });

  test("applies create/update validation rules: missing email is rejected @regression", async ({
    request
  }) => {
    const employeeId = uniqueEmployeeId("EMP-VAL-EMAIL-");
    await apiPost(
      request,
      "/employees",
      baseEmployeeEvent({
        employeeId,
        email: `${employeeId.toLowerCase()}@company.com`
      })
    );

    const response = await apiPut(
      request,
      `/employees/${employeeId}`,
      baseEmployeeEvent({ employeeId, email: "" })
    );

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      status: "rejected",
      reason: "email is mandatory"
    });
    const unchanged = await findEmployee(employeeId);
    expect(unchanged?.email).toBe(`${employeeId.toLowerCase()}@company.com`);
  });

  test("applies create/update validation rules: invalid effectiveDate is rejected @regression", async ({
    request
  }) => {
    const employeeId = uniqueEmployeeId("EMP-VAL-DATE-");
    await apiPost(
      request,
      "/employees",
      baseEmployeeEvent({
        employeeId,
        email: `${employeeId.toLowerCase()}@company.com`
      })
    );

    const response = await apiPut(
      request,
      `/employees/${employeeId}`,
      baseEmployeeEvent({
        employeeId,
        email: `${employeeId.toLowerCase()}@company.com`,
        effectiveDate: "01-11-2026"
      })
    );

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      status: "rejected",
      reason: "effectiveDate must be YYYY-MM-DD"
    });
    const unchanged = await findEmployee(employeeId);
    expect(unchanged?.effective_date).toBe("2026-10-01");
  });

  test("rejects malformed JSON payloads @regression", async ({ request }) => {
    const response = await apiPut(
      request,
      "/employees/EMP10452",
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
    const employee1 = uniqueEmployeeId("EMP-COLLIDE-U1-");
    const employee2 = uniqueEmployeeId("EMP-COLLIDE-U2-");
    const sharedEmail = `shared-${Date.now()}@company.com`;
    const secondEmail = `${employee2.toLowerCase()}@company.com`;

    await apiPost(
      request,
      "/employees",
      baseEmployeeEvent({ employeeId: employee1, email: sharedEmail })
    );
    await apiPost(
      request,
      "/employees",
      baseEmployeeEvent({ employeeId: employee2, email: secondEmail })
    );

    const response = await apiPut(
      request,
      `/employees/${employee2}`,
      baseEmployeeEvent({ employeeId: employee2, email: ` ${sharedEmail.toUpperCase()} ` })
    );

    expect(response.status()).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      status: "rejected",
      reason: "email already belongs to another employee"
    });
    const unchangedSecond = await findEmployee(employee2);
    expect(unchangedSecond?.email).toBe(secondEmail);
  });
});
