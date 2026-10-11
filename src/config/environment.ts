import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const defaultDbPath = path.resolve(process.cwd(), ".data/employee360.test.sqlite");

export const environment = {
  port: Number(process.env.PORT ?? "4010"),
  dbPath: process.env.EMPLOYEE_DB_PATH
    ? path.resolve(process.cwd(), process.env.EMPLOYEE_DB_PATH)
    : defaultDbPath
};
