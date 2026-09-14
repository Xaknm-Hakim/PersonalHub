/** Read-only SQLite snapshot importer. It never opens the legacy database for writing. */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

type Row = Record<string, unknown>;
type Table =
  | "Task"
  | "Assignment"
  | "Project"
  | "Note"
  | "Tag"
  | "_TaskTags"
  | "_AssignmentTags"
  | "_NoteTags";
type EntityTable = "Task" | "Assignment" | "Project" | "Note" | "Tag";
type Source = Record<Table, Row[]>;
export type MigrationOptions = {
  source: string;
  destination: string;
  planningTimezone?: string;
};
export type MigrationReport = {
  verified: true;
  sourceCounts: Record<Table, number>;
  targetCounts: Record<Table, number>;
  policy: string;
};

const tables: Table[] = [
  "Task",
  "Assignment",
  "Project",
  "Note",
  "Tag",
  "_TaskTags",
  "_AssignmentTags",
  "_NoteTags"
];
const entityTables: EntityTable[] = [
  "Tag",
  "Project",
  "Task",
  "Assignment",
  "Note"
];
const columns = {
  Tag: ["id", "name", "color", "createdAt", "updatedAt"],
  Project: [
    "id",
    "title",
    "description",
    "status",
    "type",
    "priority",
    "startDate",
    "targetDate",
    "completedAt",
    "repositoryUrl",
    "localPath",
    "liveUrl",
    "techStack",
    "objective",
    "currentProgress",
    "nextAction",
    "lessonsLearned",
    "createdAt",
    "updatedAt"
  ],
  Task: [
    "id",
    "title",
    "description",
    "status",
    "priority",
    "startDate",
    "dueDate",
    "completedAt",
    "projectId",
    "createdAt",
    "updatedAt"
  ],
  Assignment: [
    "id",
    "courseCode",
    "courseName",
    "title",
    "description",
    "type",
    "status",
    "priority",
    "startDate",
    "deadline",
    "completedAt",
    "createdAt",
    "updatedAt"
  ],
  Note: [
    "id",
    "title",
    "body",
    "linkedTaskId",
    "linkedAssignmentId",
    "projectId",
    "createdAt",
    "updatedAt"
  ]
} as const;
const joins = {
  _TaskTags: ["A", "B"],
  _AssignmentTags: ["A", "B"],
  _NoteTags: ["A", "B"]
} as const;
const dateColumns = new Set(["startDate", "dueDate", "targetDate", "deadline"]);
const stampColumns = new Set(["createdAt", "updatedAt", "completedAt"]);
const nullable = new Set([
  "description",
  "color",
  "startDate",
  "dueDate",
  "targetDate",
  "completedAt",
  "repositoryUrl",
  "localPath",
  "liveUrl",
  "techStack",
  "objective",
  "currentProgress",
  "nextAction",
  "lessonsLearned",
  "projectId",
  "linkedTaskId",
  "linkedAssignmentId"
]);
const legacyNullableAdditions = new Set([
  "Task.completedAt",
  "Task.projectId",
  "Assignment.completedAt",
  "Note.projectId"
]);
const known: Record<string, readonly string[]> = {
  "Task.status": ["todo", "doing", "done", "cancelled"],
  "Assignment.status": [
    "not_started",
    "in_progress",
    "submitted",
    "graded",
    "completed",
    "cancelled"
  ],
  "Project.status": [
    "planned",
    "developing",
    "active",
    "paused",
    "completed",
    "archived",
    "abandoned"
  ],
  "Assignment.type": [
    "assignment",
    "exercise",
    "lab",
    "quiz",
    "project",
    "revision",
    "other"
  ],
  "Project.type": [
    "software",
    "infrastructure",
    "networking",
    "cloud",
    "academic",
    "event_ops",
    "lab",
    "documentation",
    "other"
  ],
  "Task.priority": ["low", "medium", "high", "urgent"],
  "Assignment.priority": ["low", "medium", "high", "urgent"],
  "Project.priority": ["low", "medium", "high", "urgent"]
};
const defaultPlanningTimezone = "Asia/Kuala_Lumpur";
const policy =
  "SQLite/Prisma integer timestamps and SQLite CURRENT_TIMESTAMP-style zone-less timestamps are UTC instants. Planning-date instants use the configured legacy planning timezone (default Asia/Kuala_Lumpur); date-only text retains its written calendar day. Completion timestamps preserve their instant and are not converted to planning dates.";

function val(row: Row, col: string) {
  return Object.prototype.hasOwnProperty.call(row, col)
    ? (row[col] ?? null)
    : null;
}
function assertTimezone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
  } catch {
    throw new Error(`Invalid planning timezone: ${timeZone}`);
  }
}
function calendarDate(d: Date, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
      .formatToParts(d)
      .filter((x) => x.type !== "literal")
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day}`;
}
function isCalendarDate(text: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const [year, month, day] = m.slice(1).map(Number);
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
  );
}
function epochMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  const text = String(value);
  if (/^-\d+$/.test(text) || /^\d{11,}$/.test(text)) {
    const n = Number(text);
    if (Number.isSafeInteger(n)) return n;
  }
  return null;
}

/** Normalize a legacy planning date without relying on the host machine timezone. */
export function normalizeDateOnly(
  value: unknown,
  field: string,
  planningTimezone = defaultPlanningTimezone
): string | null {
  if (value == null || value === "") return null;
  assertTimezone(planningTimezone);
  const epoch = epochMillis(value);
  if (epoch !== null) {
    const d = new Date(epoch);
    if (Number.isNaN(d.getTime()))
      throw new Error(`Invalid ${field}: ${value}`);
    return calendarDate(d, planningTimezone);
  }
  const text = String(value);
  if (isCalendarDate(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text))
    throw new Error(`Invalid ${field}: ${text}`);
  const normalized = text.replace(" ", "T");
  const d = new Date(
    /(?:[zZ]|[+-]\d\d:?\d\d)$/.test(normalized) ? normalized : `${normalized}Z`
  );
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ${field}: ${text}`);
  return calendarDate(d, planningTimezone);
}

/** Normalize legacy timestamp values as UTC instants; no local-time guess is made. */
export function normalizeTimestamp(value: unknown, field: string): Date | null {
  if (value == null || value === "") return null;
  const epoch = epochMillis(value);
  const text = String(value).replace(" ", "T");
  const d =
    epoch === null
      ? new Date(/(?:[zZ]|[+-]\d\d:?\d\d)$/.test(text) ? text : `${text}Z`)
      : new Date(epoch);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ${field}: ${value}`);
  return d;
}

function readSource(source: string): Source {
  if (!existsSync(source)) throw new Error(`Snapshot not found: ${source}`);
  const py = `import json,sqlite3,sys
c=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
names=${JSON.stringify(tables)}; expected=${JSON.stringify({ ...columns, ...joins })}
optional=${JSON.stringify([...legacyNullableAdditions])}
present={r[0] for r in c.execute("select name from sqlite_master where type='table'")}
missing=[n for n in names if n not in present]
if missing: raise SystemExit('Missing required legacy tables: '+', '.join(missing))
for n in names:
 actual={r[1] for r in c.execute('pragma table_info("'+n+'")')}
 absent=[x for x in expected[n] if x not in actual and n+'.'+x not in optional]
 if absent: raise SystemExit('Missing required legacy columns in '+n+': '+', '.join(absent))
print(json.dumps({n:[dict(x) for x in c.execute('select * from "'+n+'"')] for n in names}))`;
  return JSON.parse(
    execFileSync("python3", ["-c", py, source], { encoding: "utf8" })
  ) as Source;
}

export function validateMigrationSource(
  source: Source,
  planningTimezone = defaultPlanningTimezone
) {
  assertTimezone(planningTimezone);
  const ids = Object.fromEntries(
    entityTables.map((t) => [t, new Set<string>()])
  ) as Record<EntityTable, Set<string>>;
  for (const table of entityTables)
    for (const row of source[table]) {
      for (const col of columns[table]) {
        if (
          !Object.prototype.hasOwnProperty.call(row, col) &&
          !legacyNullableAdditions.has(`${table}.${col}`)
        )
          throw new Error(`Missing required legacy column ${table}.${col}`);
        if (!nullable.has(col) && val(row, col) == null)
          throw new Error(
            `Legacy ${table}.${col} is null for ${val(row, "id")}`
          );
      }
      const id = val(row, "id");
      if (typeof id !== "string" || !id)
        throw new Error(`Invalid legacy ${table}.id: ${id}`);
      if (ids[table].has(id))
        throw new Error(`Duplicate legacy ${table}.id: ${id}`);
      ids[table].add(id);
      for (const col of columns[table]) {
        if (dateColumns.has(col))
          normalizeDateOnly(val(row, col), `${table}.${col}`, planningTimezone);
        if (stampColumns.has(col))
          normalizeTimestamp(val(row, col), `${table}.${col}`);
      }
      for (const [key, allowed] of Object.entries(known)) {
        const [entity, col] = key.split(".");
        if (
          entity === table &&
          val(row, col) != null &&
          !allowed.includes(String(val(row, col)))
        )
          throw new Error(`Unknown legacy ${table}.${col}: ${val(row, col)}`);
      }
    }
  for (const row of source.Task)
    if (
      val(row, "projectId") != null &&
      !ids.Project.has(String(val(row, "projectId")))
    )
      throw new Error(`Missing legacy Project for Task ${val(row, "id")}`);
  for (const row of source.Note)
    for (const [col, target] of [
      ["projectId", "Project"],
      ["linkedTaskId", "Task"],
      ["linkedAssignmentId", "Assignment"]
    ] as const)
      if (val(row, col) != null && !ids[target].has(String(val(row, col))))
        throw new Error(`Missing legacy ${target} for Note ${val(row, "id")}`);
  const joinTargets = {
    _TaskTags: ["Tag", "Task"],
    _AssignmentTags: ["Assignment", "Tag"],
    _NoteTags: ["Note", "Tag"]
  } as const;
  for (const table of Object.keys(joins) as (keyof typeof joins)[]) {
    const seen = new Set<string>();
    for (const row of source[table]) {
      for (const col of joins[table])
        if (
          !Object.prototype.hasOwnProperty.call(row, col) ||
          val(row, col) == null
        )
          throw new Error(`Invalid legacy ${table}.${col}`);
      const pair = `${val(row, "A")}\u0000${val(row, "B")}`;
      if (seen.has(pair))
        throw new Error(
          `Duplicate legacy ${table} join ${val(row, "A")}/${val(row, "B")}`
        );
      seen.add(pair);
      const [left, right] = joinTargets[table];
      if (
        !ids[left].has(String(val(row, "A"))) ||
        !ids[right].has(String(val(row, "B")))
      )
        throw new Error(
          `Missing legacy row for ${table} join ${val(row, "A")}/${val(row, "B")}`
        );
    }
  }
}

export function normalizeMigrationRow(
  row: Row,
  table: EntityTable,
  planningTimezone = defaultPlanningTimezone
): Record<string, unknown> {
  return Object.fromEntries(
    columns[table].map((col) => [
      col,
      dateColumns.has(col)
        ? normalizeDateOnly(val(row, col), `${table}.${col}`, planningTimezone)
        : stampColumns.has(col)
          ? normalizeTimestamp(val(row, col), `${table}.${col}`)
          : val(row, col)
    ])
  );
}
async function counts(c: Client) {
  const result = {} as Record<Table, number>;
  for (const t of tables)
    result[t] = Number(
      (await c.query(`select count(*) from "${t}"`)).rows[0].count
    );
  return result;
}
function selectColumn(col: string) {
  return dateColumns.has(col)
    ? `"${col}"::text as "${col}"`
    : stampColumns.has(col)
      ? `(extract(epoch from "${col}") * 1000)::bigint as "${col}"`
      : `"${col}"`;
}
function insertParameter(col: string, index: number) {
  return stampColumns.has(col)
    ? `$${index}::timestamptz AT TIME ZONE 'UTC'`
    : `$${index}`;
}
function same(expected: unknown, actual: unknown) {
  return expected instanceof Date
    ? Number(actual) === expected.getTime()
    : expected === actual;
}
async function verifyData(
  c: Client,
  data: Source,
  planningTimezone: string
): Promise<MigrationReport> {
  const targetCounts = await counts(c),
    sourceCounts = Object.fromEntries(
      tables.map((t) => [t, data[t].length])
    ) as Record<Table, number>;
  for (const t of tables)
    if (targetCounts[t] !== sourceCounts[t])
      throw new Error(
        `Verification failed for ${t}: source ${sourceCounts[t]}, target ${targetCounts[t]}`
      );
  for (const table of entityTables)
    for (const row of data[table]) {
      const expected = normalizeMigrationRow(row, table, planningTimezone);
      const actual = (
        await c.query(
          `select ${columns[table].map(selectColumn).join(",")} from "${table}" where id=$1`,
          [expected.id]
        )
      ).rows[0];
      if (!actual)
        throw new Error(`Verification missing ${table} ${expected.id}`);
      for (const col of columns[table])
        if (!same(expected[col], actual[col]))
          throw new Error(
            `Verification mismatch ${table}.${col} for ${expected.id}: expected ${expected[col] instanceof Date ? expected[col].getTime() : JSON.stringify(expected[col])}, received ${JSON.stringify(actual[col])}`
          );
    }
  for (const table of Object.keys(joins) as (keyof typeof joins)[])
    for (const row of data[table])
      if (
        !(
          await c.query(`select 1 from "${table}" where "A"=$1 and "B"=$2`, [
            row.A,
            row.B
          ])
        ).rowCount
      )
        throw new Error(`Verification missing ${table} join ${row.A}/${row.B}`);
  return { verified: true, policy, sourceCounts, targetCounts };
}
export async function verifySqliteToPostgres({
  source,
  destination,
  planningTimezone = defaultPlanningTimezone
}: MigrationOptions): Promise<MigrationReport> {
  const data = readSource(source);
  validateMigrationSource(data, planningTimezone);
  const c = new Client({ connectionString: destination });
  await c.connect();
  try {
    return await verifyData(c, data, planningTimezone);
  } finally {
    await c.end();
  }
}
export async function importSqliteToPostgres({
  source,
  destination,
  planningTimezone = defaultPlanningTimezone
}: MigrationOptions): Promise<MigrationReport> {
  const data = readSource(source);
  validateMigrationSource(data, planningTimezone);
  const c = new Client({ connectionString: destination });
  await c.connect();
  try {
    await c.query("BEGIN");
    try {
      for (const t of tables)
        await c.query(`lock table "${t}" in access exclusive mode`);
      if (Object.values(await counts(c)).some(Boolean))
        throw new Error(
          "Target is nonempty; refusing import without changing existing user records."
        );
      for (const table of entityTables)
        for (const row of data[table]) {
          const item = normalizeMigrationRow(row, table, planningTimezone),
            names = columns[table];
          await c.query(
            `insert into "${table}" (${names.map((n) => `"${n}"`).join(",")}) values (${names.map((name, i) => insertParameter(name, i + 1)).join(",")})`,
            names.map((n) => item[n])
          );
        }
      for (const table of Object.keys(joins) as (keyof typeof joins)[])
        for (const row of data[table])
          await c.query(`insert into "${table}" ("A","B") values ($1,$2)`, [
            row.A,
            row.B
          ]);
      const report = await verifyData(c, data, planningTimezone);
      await c.query("COMMIT");
      return report;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    }
  } finally {
    await c.end();
  }
}
async function main() {
  const source = resolve(
    process.argv[2] ??
      "backups/overhaul-safety-20260910-193400/migration-development-copy.db"
  );
  if (source === resolve("data/personalhub.db"))
    throw new Error(
      "Refusing the primary legacy database. Create and pass a SQLite backup copy."
    );
  const destination = process.env.PERSONALHUB_DATABASE_URL;
  if (!destination)
    throw new Error(
      "PERSONALHUB_DATABASE_URL is required (load .env.overhaul explicitly; never use legacy DATABASE_URL)."
    );
  const report = await importSqliteToPostgres({
    source,
    destination,
    planningTimezone:
      process.env.LEGACY_PLANNING_TIMEZONE ?? defaultPlanningTimezone
  });
  mkdirSync("reports", { recursive: true });
  writeFileSync(
    "reports/migration-report.json",
    JSON.stringify({ source, ...report }, null, 2)
  );
  console.log(JSON.stringify(report.targetCounts));
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
