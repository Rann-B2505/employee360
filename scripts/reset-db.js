const path = require("node:path");
const sqlite3 = require("sqlite3");

sqlite3.verbose();

const dbPath = process.env.EMPLOYEE_DB_PATH
  ? path.resolve(process.cwd(), process.env.EMPLOYEE_DB_PATH)
  : path.resolve(process.cwd(), ".data/employee360.test.sqlite");

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("DELETE FROM employees", (error) => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      process.exitCode = 1;
    }
    db.close();
  });
});
