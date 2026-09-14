import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "pg";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  importSqliteToPostgres,
  verifySqliteToPostgres
} from "../scripts/migrate-sqlite-to-postgres";

import {
  assertDisposableDatabase,
  disposableDatabase
} from "./support/disposable-database";
const baseUrl = disposableDatabase().url;
const dbName = `personalhub_test_migration_${process.pid}_${randomBytes(6).toString("hex")}`;
const databaseUrl = baseUrl ? new URL(baseUrl) : undefined;
if (databaseUrl) databaseUrl.pathname = `/${dbName}`;
const childEnv: NodeJS.ProcessEnv = {
  ...process.env,
  PERSONALHUB_TEST_DATABASE_URL: databaseUrl?.toString(),
  PERSONALHUB_TEST_CONFIRM: dbName
};
const fixtureDir = mkdtempSync(join(tmpdir(), "personalhub-migration-"));
const fixture = join(fixtureDir, "populated.db");
let childCreated = false;

function exec(command: string, args: string[], env = process.env) {
  return execFileSync(command, args, {
    cwd: resolve("."),
    env,
    encoding: "utf8"
  });
}

async function sql(text: string, params: unknown[] = []) {
  const client = new Client({ connectionString: databaseUrl!.toString() });
  await client.connect();
  try {
    return await client.query(text, params);
  } finally {
    await client.end();
  }
}
async function baseSql(text: string) {
  const client = new Client({ connectionString: baseUrl });
  await client.connect();
  try {
    return (await client.query(text)).rows;
  } finally {
    await client.end();
  }
}

describe("SQLite to PostgreSQL migration", () => {
  beforeAll(async () => {
    exec("python3", [
      "-c",
      `import sqlite3,sys
c=sqlite3.connect(sys.argv[1])
c.executescript('''
CREATE TABLE "Tag" (id TEXT PRIMARY KEY,name TEXT NOT NULL,color TEXT,createdAt DATETIME NOT NULL,updatedAt DATETIME NOT NULL);
CREATE TABLE "Project" (id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT,status TEXT,type TEXT,priority TEXT,startDate DATETIME,targetDate DATETIME,completedAt DATETIME,repositoryUrl TEXT,localPath TEXT,liveUrl TEXT,techStack TEXT,objective TEXT,currentProgress TEXT,nextAction TEXT,lessonsLearned TEXT,createdAt DATETIME NOT NULL,updatedAt DATETIME NOT NULL);
CREATE TABLE "Task" (id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT,status TEXT,priority TEXT,startDate DATETIME,dueDate DATETIME,completedAt DATETIME,projectId TEXT,createdAt DATETIME NOT NULL,updatedAt DATETIME NOT NULL);
CREATE TABLE "Assignment" (id TEXT PRIMARY KEY,courseCode TEXT,courseName TEXT,title TEXT,description TEXT,type TEXT,status TEXT,priority TEXT,startDate DATETIME,deadline DATETIME,completedAt DATETIME,createdAt DATETIME NOT NULL,updatedAt DATETIME NOT NULL);
CREATE TABLE "Note" (id TEXT PRIMARY KEY,title TEXT,body TEXT,linkedTaskId TEXT,linkedAssignmentId TEXT,projectId TEXT,createdAt DATETIME NOT NULL,updatedAt DATETIME NOT NULL);
CREATE TABLE "_TaskTags" ("A" TEXT,"B" TEXT); CREATE TABLE "_AssignmentTags" ("A" TEXT,"B" TEXT); CREATE TABLE "_NoteTags" ("A" TEXT,"B" TEXT);
''')
c.execute('INSERT INTO "Tag" VALUES (?,?,?,?,?)',('tag-1','work','#123456','2026-01-01 01:02:03.123','2026-01-02T04:05:06+08:00'))
c.execute('INSERT INTO "Project" VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',('project-1','Project',None,'completed','software','high','2026-01-02','2026-02-03',None,'https://repo','/tmp/project',None,'TS','objective','progress','next','lesson','2026-01-01 01:02:03','2026-01-02 04:05:06'))
c.execute('INSERT INTO "Task" VALUES (?,?,?,?,?,?,?,?,?,?,?)',('task-1','Task',None,'done','urgent','2026-01-03','2026-01-04',None,'project-1','2026-01-01 01:02:03','2026-01-02 04:05:06'))
c.execute('INSERT INTO "Assignment" VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',('assignment-1','CS101','Computer Science','Assignment',None,'lab','completed','low','2026-01-05','2026-01-06',None,'2026-01-01 01:02:03','2026-01-02 04:05:06'))
c.execute('INSERT INTO "Note" VALUES (?,?,?,?,?,?,?,?)',('note-1','Note','Body','task-1','assignment-1','project-1','2026-01-01 01:02:03','2026-01-02 04:05:06'))
c.executemany('INSERT INTO "_TaskTags" VALUES (?,?)',[('tag-1','task-1')]); c.executemany('INSERT INTO "_AssignmentTags" VALUES (?,?)',[('assignment-1','tag-1')]); c.executemany('INSERT INTO "_NoteTags" VALUES (?,?)',[('note-1','tag-1')]); c.commit()`,
      fixture
    ]);
    await assertDisposableDatabase(baseSql, process.env);
    const admin = new URL(baseUrl!);
    admin.pathname = "/postgres";
    const client = new Client({ connectionString: admin.toString() });
    await client.connect();
    await client.query(`CREATE DATABASE "${dbName}"`);
    childCreated = true;
    await client.end();
    exec("npx", ["prisma", "migrate", "deploy"], {
      ...process.env,
      PERSONALHUB_DATABASE_URL: databaseUrl!.toString()
    });
    await sql(
      "CREATE TABLE public._personalhub_test_owner (token text NOT NULL)"
    );
    await sql(
      "INSERT INTO public._personalhub_test_owner (token) VALUES ($1)",
      [childEnv.PERSONALHUB_TEST_TOKEN]
    );
  }, 60_000);

  afterAll(async () => {
    if (baseUrl && childCreated) {
      await assertDisposableDatabase(
        async (text) => (await sql(text)).rows,
        childEnv
      );
      const admin = new URL(baseUrl);
      admin.pathname = "/postgres";
      const client = new Client({ connectionString: admin.toString() });
      await client.connect();
      try {
        await client.query(`DROP DATABASE "${dbName}" WITH (FORCE)`);
      } finally {
        await client.end();
      }
    }
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("rolls back every inserted row when a legacy relation cannot be imported", async () => {
    exec("python3", [
      "-c",
      `import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);c.execute('insert into "_TaskTags" values (?,?)',('tag-1','missing-task'));c.commit()`,
      fixture
    ]);
    await expect(
      importSqliteToPostgres({
        source: fixture,
        destination: databaseUrl!.toString()
      })
    ).rejects.toThrow();
    expect((await sql('select count(*) from "Tag"')).rows[0].count).toBe("0");
    exec("python3", [
      "-c",
      `import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);c.execute('delete from "_TaskTags" where "B"=?',('missing-task',));c.commit()`,
      fixture
    ]);
  });

  it("imports atomically and verifies every scalar, ID, date/timestamp, relation, and join", async () => {
    await expect(
      importSqliteToPostgres({
        source: fixture,
        destination: databaseUrl!.toString()
      })
    ).resolves.toMatchObject({ verified: true });
    await expect(
      verifySqliteToPostgres({
        source: fixture,
        destination: databaseUrl!.toString()
      })
    ).resolves.toMatchObject({
      verified: true,
      sourceCounts: {
        Task: 1,
        Assignment: 1,
        Project: 1,
        Note: 1,
        Tag: 1,
        _TaskTags: 1,
        _AssignmentTags: 1,
        _NoteTags: 1
      }
    });
    expect(
      (await sql('select "completedAt" from "Task" where id=$1', ["task-1"]))
        .rows[0].completedAt
    ).toBeNull();
  });

  it("refuses a nonempty target without changing its user records", async () => {
    await sql(
      'insert into "Tag" (id,name,"createdAt","updatedAt") values ($1,$2,now(),now())',
      ["existing", "existing"]
    );
    await expect(
      importSqliteToPostgres({
        source: fixture,
        destination: databaseUrl!.toString()
      })
    ).rejects.toThrow("nonempty");
    expect(
      (await sql('select id from "Tag" where id=$1', ["existing"])).rowCount
    ).toBe(1);
  });

  it("rejects unknown legacy enum values before it can alter a target", async () => {
    exec("python3", [
      "-c",
      `import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);c.execute('update "Task" set status=?',('mystery',));c.commit()`,
      fixture
    ]);
    await expect(
      importSqliteToPostgres({
        source: fixture,
        destination: databaseUrl!.toString()
      })
    ).rejects.toThrow("Unknown legacy Task.status");
    expect(
      (await sql('select id from "Tag" where id=$1', ["existing"])).rowCount
    ).toBe(1);
    exec("python3", [
      "-c",
      `import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);c.execute('update "Task" set status=?',('done',));c.commit()`,
      fixture
    ]);
  });
});

describe("migration source validation", () => {
  it("rejects an unknown legacy enum instead of silently normalizing it", async () => {
    await expect(
      importSqliteToPostgres({
        source: "/does/not/exist",
        destination: "postgresql://invalid"
      })
    ).rejects.toThrow();
  });
});
