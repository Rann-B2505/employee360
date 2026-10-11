import { all, close, createConnection, get, run } from "./sqliteClient";

export interface StoredEmployee {
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  department: string | null;
  location: string | null;
  employment_status: string | null;
  effective_date: string;
  event_type: string;
}

export async function initializeDatabase(): Promise<void> {
  const db = createConnection();
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS employees (
      employee_id TEXT PRIMARY KEY,
      first_name TEXT NULL,
      last_name TEXT NULL,
      email TEXT NOT NULL,
      department TEXT NULL,
      location TEXT NULL,
      employment_status TEXT NULL,
      effective_date TEXT NOT NULL,
      event_type TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  );
  await run(
    db,
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_email_nocase ON employees (LOWER(email))"
  );
  await close(db);
}

export async function resetDatabase(): Promise<void> {
  const db = createConnection();
  await run(db, "DELETE FROM employees");
  await close(db);
}

export interface EmployeeWriteInput {
  employeeId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  department: string | null;
  location: string | null;
  employmentStatus: string | null;
  effectiveDate: string;
  eventType: string;
}

export async function createEmployee(input: EmployeeWriteInput): Promise<void> {
  const db = createConnection();
  await run(
    db,
    `INSERT INTO employees (
      employee_id, first_name, last_name, email, department, location, employment_status, effective_date, event_type, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.employeeId,
      input.firstName,
      input.lastName,
      input.email,
      input.department,
      input.location,
      input.employmentStatus,
      input.effectiveDate,
      input.eventType,
      new Date().toISOString()
    ]
  );
  await close(db);
}

export async function updateEmployee(input: EmployeeWriteInput): Promise<void> {
  const db = createConnection();
  await run(
    db,
    `UPDATE employees
     SET first_name = ?,
         last_name = ?,
         email = ?,
         department = ?,
         location = ?,
         employment_status = ?,
         effective_date = ?,
         event_type = ?,
         updated_at = ?
     WHERE employee_id = ?`,
    [
      input.firstName,
      input.lastName,
      input.email,
      input.department,
      input.location,
      input.employmentStatus,
      input.effectiveDate,
      input.eventType,
      new Date().toISOString(),
      input.employeeId
    ]
  );
  await close(db);
}

export async function getEmployeeById(
  employeeId: string
): Promise<StoredEmployee | undefined> {
  const db = createConnection();
  const row = await get<StoredEmployee>(
    db,
    `SELECT employee_id, first_name, last_name, email, department, location, employment_status, effective_date, event_type
     FROM employees WHERE employee_id = ?`,
    [employeeId]
  );
  await close(db);
  return row;
}

export async function getEmployeeCount(): Promise<number> {
  const db = createConnection();
  const row = await get<{ count: number }>(
    db,
    "SELECT COUNT(1) as count FROM employees"
  );
  await close(db);
  return row?.count ?? 0;
}

export async function getAllEmployees(): Promise<StoredEmployee[]> {
  const db = createConnection();
  const rows = await all<StoredEmployee>(
    db,
    `SELECT employee_id, first_name, last_name, email, department, location, employment_status, effective_date, event_type
     FROM employees ORDER BY employee_id`
  );
  await close(db);
  return rows;
}
