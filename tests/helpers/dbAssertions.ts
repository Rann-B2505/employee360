import path from "node:path";
import sqlite3 from "sqlite3";
import { attachDbOperation } from "./allureLogging";

const dbPath = path.resolve(process.cwd(), ".data/employee360.test.sqlite");

function withDb<T>(query: (db: sqlite3.Database) => Promise<T>): Promise<T> {
  sqlite3.verbose();
  const db = new sqlite3.Database(dbPath);
  return query(db).finally(
    () =>
      new Promise<void>((resolve, reject) => {
        db.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
  );
}

function get<T>(
  db: sqlite3.Database,
  sql: string,
  params: unknown[] = []
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row as T | undefined);
    });
  });
}

export async function clearTables(): Promise<void> {
  const sqlEmployees = "DELETE FROM employees";
  await withDb(async (db) => {
    await new Promise<void>((resolve, reject) => {
      db.run(sqlEmployees, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });
  await attachDbOperation({
    operation: "clearTables",
    sql: sqlEmployees
  });
}

export async function findEmployee(employeeId: string) {
  const sql = `SELECT employee_id, email, first_name, last_name, department, location, employment_status, effective_date
       FROM employees WHERE employee_id = ?`;
  const result = await withDb((db) =>
    get<{
      employee_id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      department: string | null;
      location: string | null;
      employment_status: string | null;
      effective_date: string;
    }>(
      db,
      sql,
      [employeeId]
    )
  );
  await attachDbOperation({
    operation: "findEmployee",
    sql,
    params: [employeeId],
    result
  });
  return result;
}

export async function findEmployeeByEmail(email: string) {
  const sql = `SELECT employee_id, email, first_name, last_name, department, location, employment_status, effective_date
       FROM employees WHERE LOWER(email) = LOWER(?)`;
  const result = await withDb((db) =>
    get<{
      employee_id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      department: string | null;
      location: string | null;
      employment_status: string | null;
      effective_date: string;
    }>(db, sql, [email])
  );
  await attachDbOperation({
    operation: "findEmployeeByEmail",
    sql,
    params: [email],
    result
  });
  return result;
}

export async function employeeCount(): Promise<number> {
  const sql = "SELECT COUNT(1) as count FROM employees";
  const row = await withDb((db) => get<{ count: number }>(db, sql));
  const count = row?.count ?? 0;
  await attachDbOperation({
    operation: "employeeCount",
    sql,
    result: { count }
  });
  return count;
}
