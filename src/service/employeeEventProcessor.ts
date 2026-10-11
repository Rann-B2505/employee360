import {
  createEmployee,
  getEmployeeById,
  updateEmployee
} from "../db/employeeRepository";

export interface EmployeeEvent {
  eventType?: unknown;
  employeeId?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  department?: unknown;
  location?: unknown;
  employmentStatus?: unknown;
  effectiveDate?: unknown;
}

export interface ProcessResult {
  status: "accepted" | "rejected";
  employeeId: string | null;
  operation?: "created" | "updated";
  errorType?: "validation" | "conflict" | "not_found" | "system";
  reason?: string;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  return value.trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidIsoDate(dateValue: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return false;
  }
  const parsed = new Date(`${dateValue}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(dateValue);
}

function validationError(payload: EmployeeEvent): string | null {
  const employeeId = asTrimmedString(payload.employeeId);
  if (!employeeId) {
    return "employeeId is mandatory";
  }

  const email = asTrimmedString(payload.email);
  if (!email) {
    return "email is mandatory";
  }
  if (!isValidEmail(email)) {
    return "email is invalid";
  }

  const effectiveDate = asTrimmedString(payload.effectiveDate);
  if (!effectiveDate) {
    return "effectiveDate is mandatory";
  }
  if (!isValidIsoDate(effectiveDate)) {
    return "effectiveDate must be YYYY-MM-DD";
  }

  const optionalTextFields = [
    ["firstName", payload.firstName],
    ["lastName", payload.lastName],
    ["department", payload.department],
    ["location", payload.location],
    ["employmentStatus", payload.employmentStatus]
  ] as const;

  for (const [field, value] of optionalTextFields) {
    if (value !== null && value !== undefined && typeof value !== "string") {
      return `${field} must be a string when provided`;
    }
  }

  return null;
}

function normalizedPayload(payload: EmployeeEvent) {
  return {
    employeeId: asTrimmedString(payload.employeeId),
    firstName: asOptionalString(payload.firstName),
    lastName: asOptionalString(payload.lastName),
    email: asTrimmedString(payload.email)?.toLowerCase() ?? null,
    department: asOptionalString(payload.department),
    location: asOptionalString(payload.location),
    employmentStatus: asOptionalString(payload.employmentStatus),
    effectiveDate: asTrimmedString(payload.effectiveDate),
    eventType: asTrimmedString(payload.eventType) ?? "EmployeeUpdated"
  };
}

function isSqliteConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const maybeCode = (error as { code?: unknown }).code;
  return maybeCode === "SQLITE_CONSTRAINT";
}

export async function processEmployeeEvent(
  payload: EmployeeEvent,
  operation: "create" | "update"
): Promise<ProcessResult> {
  const normalized = normalizedPayload(payload);
  const employeeId = normalized.employeeId;
  const error = validationError(payload);
  if (error) {
    return {
      status: "rejected",
      employeeId,
      reason: error,
      errorType: "validation"
    };
  }
  const existingEmployee = await getEmployeeById(normalized.employeeId!);
  if (operation === "create" && existingEmployee) {
    const reason = "employee already exists";
    return { status: "rejected", employeeId, reason, errorType: "conflict" };
  }
  if (operation === "update" && !existingEmployee) {
    const reason = "employee not found";
    return { status: "rejected", employeeId, reason, errorType: "not_found" };
  }

  try {
    const writeInput = {
      employeeId: normalized.employeeId!,
      firstName: normalized.firstName,
      lastName: normalized.lastName,
      email: normalized.email!,
      department: normalized.department,
      location: normalized.location,
      employmentStatus: normalized.employmentStatus,
      effectiveDate: normalized.effectiveDate!,
      eventType: normalized.eventType
    };
    if (operation === "create") {
      await createEmployee(writeInput);
    } else {
      await updateEmployee(writeInput);
    }
    return {
      status: "accepted",
      employeeId,
      operation: operation === "create" ? "created" : "updated"
    };
  } catch (dbError) {
    const reason = isSqliteConstraintError(dbError)
      ? "email already belongs to another employee"
      : "downstream persistence failure";
    return {
      status: "rejected",
      employeeId,
      reason,
      errorType: isSqliteConstraintError(dbError) ? "conflict" : "system"
    };
  }
}
