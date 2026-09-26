// Optional isolated SQL validation: install PGlite outside the app, and set PGLITE_MODULE to its module path.
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`
CREATE TABLE "User" (id text PRIMARY KEY);
CREATE TABLE corpus_collection_activity_permissions (id bigserial PRIMARY KEY, user_id text NOT NULL, activity_id bigint NOT NULL, can_view_insights boolean NOT NULL DEFAULT true, can_export_insights boolean NOT NULL DEFAULT false, UNIQUE(user_id, activity_id));
CREATE TABLE corpus_collection_audit_logs (id bigserial PRIMARY KEY, operator_id text NOT NULL, action text NOT NULL, CONSTRAINT corpus_collection_audit_logs_operator_id_fkey FOREIGN KEY(operator_id) REFERENCES "User"(id) ON DELETE CASCADE);
INSERT INTO "User" VALUES ('operator'), ('admin');
INSERT INTO corpus_collection_activity_permissions(user_id, activity_id) VALUES ('operator', 1);
INSERT INTO corpus_collection_audit_logs(operator_id,action) VALUES ('operator','legacy');
`);
await db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
let r = await db.query(
  "SELECT can_view_insights, submission_actions FROM corpus_collection_activity_permissions WHERE activity_id=1",
);
assert.equal(r.rows[0].can_view_insights, true);
assert.deepEqual(r.rows[0].submission_actions, []);
await db.exec(
  `INSERT INTO corpus_collection_activity_permissions(user_id,activity_id,submission_actions) VALUES('operator',2,'["view","award"]'); INSERT INTO corpus_collection_operator_roles(user_id,role_code,assigned_by) VALUES('operator','ACTIVITY_OPERATOR','admin');`,
);
r = await db.query(
  "SELECT can_view_insights FROM corpus_collection_activity_permissions WHERE activity_id=2",
);
assert.equal(r.rows[0].can_view_insights, false);
await db.exec(
  `UPDATE corpus_collection_activity_permissions SET can_view_insights=false,can_export_insights=false WHERE activity_id=2`,
);
r = await db.query(
  "SELECT submission_actions FROM corpus_collection_activity_permissions WHERE activity_id=2",
);
assert.deepEqual(r.rows[0].submission_actions, ["view", "award"]);
await db.exec(`DELETE FROM "User" WHERE id='operator'`);
r = await db.query(
  "SELECT COUNT(*)::int AS n FROM corpus_collection_audit_logs",
);
assert.equal(r.rows[0].n, 1);
r = await db.query(
  "SELECT COUNT(*)::int AS n FROM corpus_collection_operator_roles",
);
assert.equal(r.rows[0].n, 0);
await db.exec(
  `CREATE ROLE public_test; GRANT SELECT ON corpus_collection_operator_roles TO public_test; INSERT INTO corpus_collection_operator_roles(user_id,role_code,assigned_by) VALUES('admin','ACTIVITY_ADMIN','admin'); SET ROLE public_test;`,
);
r = await db.query("SELECT * FROM corpus_collection_operator_roles");
assert.equal(r.rows.length, 0);
await db.exec("RESET ROLE");
await db.close();
console.log(
  "PASS: schema application, existing insight preservation, new insight default denied, independent revocation, durable audit, role cleanup, RLS default deny (7 checks)",
);
