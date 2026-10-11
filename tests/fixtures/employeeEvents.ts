import { EmployeeEvent } from "../../src/service/employeeEventProcessor";

export function baseEmployeeEvent(
  overrides: Partial<EmployeeEvent> = {}
): EmployeeEvent {
  return {
    eventType: "EmployeeUpdated",
    employeeId: "EMP10452",
    firstName: "Amira",
    lastName: "Khan",
    email: "amira.khan@company.com",
    department: "Data & AI",
    location: "Cape Town",
    employmentStatus: "Active",
    effectiveDate: "2026-10-01",
    ...overrides
  };
}
