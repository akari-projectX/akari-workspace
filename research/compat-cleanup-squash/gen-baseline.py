#!/usr/bin/env python3
"""Generate the squashed baseline from the pg_dump of the migrated chain.

  gen-baseline.py CHAIN_SCHEMA.sql MIGRATIONS_DIR > 0001_baseline.sql

The dump is split into objects, regrouped by domain (types, functions, one
section per group of tables with their constraints, indexes and triggers,
foreign keys, seed rows), de-qualified and de-noised (NOT NULL constraint
names that survived table renames), and the comments that explained an
object in the migration that created or last changed it are carried over.
The month partitions of traffic_daily are created by the migration-time call
of akari_ensure_traffic_partitions, as before.
"""
import os
import re
import sys

dump = open(sys.argv[1]).read()
migdir = sys.argv[2]

# --- 1. split the dump into objects -------------------------------------------------------
dump = "\n".join(l for l in dump.split("\n") if not l.startswith("\\"))
HDR = re.compile(r"^--\n-- Name: (?P<name>.*?); Type: (?P<type>[A-Z ]+); Schema: (?:public|-); Owner: -.*\n--\n\n", re.M)
parts = HDR.split(dump)
# parts = [preamble, name, type, body, name, type, body, ...]
items = []
for i in range(1, len(parts), 3):
    body = parts[i + 2].split("\n--\n-- PostgreSQL database dump complete")[0]
    body = re.sub(r"^SET default_\w+ = [^\n]*\n\n?", "", body, flags=re.M)
    items.append({"name": parts[i], "type": parts[i + 1], "sql": body.strip()})

RENAMES = [
    ("node_alerts_", "server_alerts_"),
    ("node_latency_", "server_latency_"),
    ("node_metrics_", "server_metrics_"),
    ("node_enrollments_", "server_enrollments_"),
    ("rollout_nodes_", "rollout_servers_"),
]


def clean(sql):
    sql = re.sub(r"\bpublic\.", "", sql)
    sql = re.sub(r" CONSTRAINT \w+ NOT NULL", " NOT NULL", sql)
    for a, b in RENAMES:
        sql = sql.replace(a, b)
    if sql.startswith("CREATE TRIGGER"):
        sql = re.sub(r" (DEFERRABLE|FOR EACH|WHEN \(|EXECUTE FUNCTION)", r"\n    \1", sql)
    return sql


for it in items:
    it["sql"] = clean(it["sql"])
    it["name"] = clean(it["name"])


def table_of(it):
    t, sql = it["type"], it["sql"]
    if t == "TABLE":
        return re.match(r"CREATE TABLE (\w+)", sql).group(1)
    if t == "SEQUENCE":
        return re.match(r"ALTER TABLE (\w+)", sql).group(1)
    if t in ("CONSTRAINT", "FK CONSTRAINT"):
        return re.match(r"ALTER TABLE (?:ONLY )?(\w+)", sql).group(1)
    if t == "INDEX":
        return re.match(r"CREATE (?:UNIQUE )?INDEX \w+ ON (?:ONLY )?(\w+)", sql).group(1)
    if t == "TRIGGER":
        return re.search(r" ON (\w+)\s+(?:DEFERRABLE|FOR EACH)", sql).group(1)
    return None


PART = re.compile(r"^traffic_daily_(20\d\d\d\d|default)")
keep = []
for it in items:
    if it["type"] in ("TABLE ATTACH", "INDEX ATTACH"):
        continue
    tb = table_of(it)
    if tb and PART.match(tb):
        continue
    if it["type"] == "INDEX" and PART.match(it["name"]):
        continue
    it["table"] = tb
    keep.append(it)
items = keep

# --- 2. comments carried over from the migrations --------------------------------------------
COMMENTS = {}  # (kind, name) -> [lines]; the latest migration wins
COLCOMMENTS = {}  # (table, column) -> [lines]


def statements(text):
    """(comment lines, statement text) pairs of a migration file."""
    out, comment, buf, i, n = [], [], [], 0, len(text)
    cur = ""
    in_dollar = None
    for line in text.split("\n"):
        s = line.strip()
        if not cur and not in_dollar:
            if s.startswith("--"):
                t = line.strip()[2:].rstrip()
                t = t[1:] if t.startswith(" ") else t
                if set(t) <= set("-= "):
                    t = ""
                comment.append(t)
                continue
            if s == "":
                if comment and comment[-1] != "":
                    comment.append("")
                continue
        cur += line + "\n"
        for m in re.finditer(r"\$\w*\$", line):
            tag = m.group(0)
            if in_dollar is None:
                in_dollar = tag
            elif in_dollar == tag:
                in_dollar = None
        if in_dollar is None and line.rstrip().endswith(";"):
            out.append((comment, cur.strip()))
            comment, cur = [], ""
    return out


def block(comment):
    """The comment lines directly above the statement (after the last blank)."""
    c = list(comment)
    while c and c[-1] == "":
        c.pop()
    res = []
    while c and c[-1] != "":
        res.append(c.pop())
    return res[::-1]


STALE = re.compile(r"(nodes\.tags|node_block_daily|BRIN|as before|later release|migration|backfill|back-fill|\b1[01]\d\d\b|\b0\d\d\d\b|already[- ]existing|existing rows|old rows|dev database|test database|rebuilt|renamed|was dropped|v0\.|W\d\d|PLAN-|D\d+\b|Q\d\b|\bPR\b)", re.I)

for f in sorted(os.listdir(migdir)):
    if not f.endswith(".sql") or f.startswith("1000_"):
        continue
    for comment, st in statements(open(os.path.join(migdir, f)).read()):
        c = block(comment)
        if not c:
            continue
        head = st.split("\n")[0]
        m = re.match(r"CREATE (?:OR REPLACE )?FUNCTION (\w+)", st)
        if m:
            COMMENTS[("function", m.group(1))] = c
            continue
        m = re.match(r"CREATE TABLE (?:IF NOT EXISTS )?(\w+)", st)
        if m:
            COMMENTS[("table", m.group(1))] = c
            continue
        m = re.match(r"CREATE (?:CONSTRAINT )?TRIGGER (\w+)", st)
        if m:
            COMMENTS[("trigger", m.group(1))] = c
            continue
        m = re.match(r"CREATE (?:UNIQUE )?INDEX (?:IF NOT EXISTS )?(\w+)", st)
        if m:
            COMMENTS[("index", m.group(1))] = c
            continue
        m = re.match(r"ALTER TABLE (?:ONLY )?(\w+)\s+ADD COLUMN (?:IF NOT EXISTS )?(\w+)", st)
        if m:
            if len(re.findall(r"\bADD COLUMN\b", st)) == 1 and any(m.group(2) in l for l in c):
                COLCOMMENTS[(m.group(1), m.group(2))] = c
            continue
        m = re.match(r"ALTER TABLE (?:ONLY )?(\w+)\s+ADD CONSTRAINT (\w+)", st)
        if m:
            COMMENTS[("constraint", m.group(2))] = c

TABLE_RENAMES = {
    "node_enrollments": "server_enrollments", "node_metrics_1m": "server_metrics_1m",
    "node_metrics_1h": "server_metrics_1h", "node_latency": "server_latency",
    "node_alert_rules": "server_alert_rules", "node_alerts": "server_alerts",
    "rollout_nodes": "rollout_servers", "node_block_counters": "server_block_counters",
    "node_block_daily": "server_block_daily",
}
for (k, n), c in list(COMMENTS.items()):
    if n in TABLE_RENAMES:
        COMMENTS[(k, TABLE_RENAMES[n])] = c
for (t, col), c in list(COLCOMMENTS.items()):
    if t in TABLE_RENAMES:
        COLCOMMENTS[(TABLE_RENAMES[t], col)] = c


def fmt_comment(lines, indent=""):
    lines = [l for l in lines]
    if len(lines) == 1 and len(lines[0].split()) <= 5 and not re.search(r"[.,;:`(]", lines[0]):
        return ""  # a banner title, not a comment on the object
    if any(STALE.search(l) for l in lines):
        return ""
    return "".join(f"{indent}-- {l}\n" if l else f"{indent}--\n" for l in lines)


# --- 3. layout -----------------------------------------------------------------------------
SECTIONS = [
    ("Servers, nodes, entrances, enrollment, certificates", [
        "servers", "nodes", "node_groups", "entrances", "entrance_group_members", "entrance_rate_rules",
        "server_enrollments", "revoked_certs", "grpc_server_names"]),
    ("Users and authentication", ["users", "password_resets", "email_codes", "webauthn_credentials", "invite_codes"]),
    ("Access (who may use which entrance) and live traffic", [
        "entrance_users", "entrance_users_departed", "traffic_counters", "traffic_sessions"]),
    ("Traffic history", [
        "traffic_daily", "traffic_daily_pending", "traffic_entrance_daily", "traffic_monthly"]),
    ("Plans and subscriptions", ["plans", "plan_groups", "plan_period_prices", "user_plans", "user_plan_groups"]),
    ("Payments, orders, coupons", [
        "payment_methods", "coupon_batches", "coupons", "orders", "payment_events", "coupon_redemptions"]),
    ("Balance, commissions, withdrawals", ["user_balances", "balance_ledger", "commissions", "withdrawals"]),
    ("Monitoring and alerts", [
        "server_metrics_1m", "server_metrics_1h", "server_latency", "server_alerts", "server_alert_rules",
        "alert_settings", "alert_notifications", "block_rules", "server_block_counters", "server_block_daily"]),
    ("Agent releases and rollouts", [
        "agent_releases", "agent_release_chunks", "agent_update_settings", "rollouts", "rollout_servers"]),
    ("Site settings", [
        "panel_settings", "access_settings", "site_domains", "auth_settings", "signup_settings", "site_branding",
        "commission_settings", "cleanup_settings", "sub_templates", "dns_accounts"]),
    ("Mail", ["mail_settings", "mail_outbox", "mail_templates", "user_notices"]),
    ("Tickets, announcements, knowledge base", [
        "tickets", "ticket_messages", "announcement_tags", "announcements", "announcement_reads",
        "kb_categories", "kb_articles"]),
    ("Audit and admin batch jobs", ["audit_log", "admin_batch_jobs", "admin_batch_items"]),
]
placed = {t for _, ts in SECTIONS for t in ts}
all_tables = {it["table"] for it in items if it["type"] == "TABLE"}
missing = all_tables - placed
extra = placed - all_tables
if missing or extra:
    sys.exit(f"layout mismatch: unplaced {sorted(missing)}, unknown {sorted(extra)}")

out = []
W = out.append
BAR = "-- " + "=" * 73


def section(title):
    W(f"{BAR}\n-- {title}\n{BAR}\n")


W("""-- Baseline schema of the panel. One file: the schema is created from nothing
-- and every later change is a new numbered file after this one.
--
-- Per-table notes and invariants: migrations/CLAUDE.md. Generated from the
-- pg_dump of the migrated schema, then regrouped by domain.
--
-- No schema qualification and no search_path changes: tests migrate each into
-- its own schema (src/testdb.rs).
""")

types = [it for it in items if it["type"] == "TYPE"]
section("Types")
for it in types:
    W(it["sql"] + "\n")

funcs = sorted([it for it in items if it["type"] == "FUNCTION"], key=lambda it: it["name"])

section("Functions (billing arithmetic, reset/period calendar, guard and NOTIFY triggers)")
W("""-- SQL functions that read tables are created before those tables exist; the
-- setting lasts for this migration's transaction only.
SET LOCAL check_function_bodies = false;
""")
for it in funcs:
    fname = re.match(r"CREATE FUNCTION (\w+)", it["sql"]).group(1)
    W(fmt_comment(COMMENTS.get(("function", fname), [])) + it["sql"] + "\n")

by_table = {}
for it in items:
    if it["table"]:
        by_table.setdefault(it["table"], []).append(it)

ORDER = {"TABLE": 0, "SEQUENCE": 1, "CONSTRAINT": 2, "INDEX": 3, "TRIGGER": 4}


def with_columns(table, sql):
    """Put the carried-over column comments above their column lines."""
    res = []
    for line in sql.split("\n"):
        m = re.match(r"    (\w+) ", line)
        if m and m.group(1) != "CONSTRAINT" and (table, m.group(1)) in COLCOMMENTS:
            c = fmt_comment(COLCOMMENTS[(table, m.group(1))], "    ")
            if c:
                res.append(c.rstrip("\n"))
        res.append(line)
    return "\n".join(res)


fks = []
for title, tables in SECTIONS:
    section(title)
    for t in tables:
        objs = sorted(by_table[t], key=lambda it: (ORDER.get(it["type"], 9), it["name"]))
        for it in objs:
            if it["type"] == "FK CONSTRAINT":
                fks.append(it)
                continue
            sql = it["sql"]
            kind = {"TABLE": "table", "CONSTRAINT": "constraint", "INDEX": "index", "TRIGGER": "trigger"}.get(it["type"])
            cm = ""
            if it["type"] == "TABLE":
                cm = fmt_comment(COMMENTS.get(("table", t), []))
                sql = with_columns(t, sql)
            elif kind:
                nm = it["name"].split(" ")[-1]
                cm = fmt_comment(COMMENTS.get((kind, nm), []))
            W(cm + sql + "\n")
        if t == "traffic_daily":
            W("""-- Month partitions traffic_daily_YYYYMM are created by the reaper
-- (akari_ensure_traffic_partitions); rows outside every month land in the
-- DEFAULT partition and are rolled up from there.
CREATE TABLE traffic_daily_default PARTITION OF traffic_daily DEFAULT
WITH (fillfactor = 80);
""")

section("Foreign keys (after all tables: some reference each other)")
for it in sorted(fks, key=lambda it: (it["table"], it["name"])):
    W(it["sql"] + "\n")

section("Seed rows: the single-row settings tables (code expects id = 1 / TRUE) and presets")
seed = open(os.path.join(os.path.dirname(__file__), "seed.sql")).read().strip()
W(seed + "\n")

W("""-- The month partitions of traffic_daily from last month to two months ahead.
SELECT akari_ensure_traffic_partitions(1, 2);""")

sys.stdout.write("\n".join(out).rstrip("\n") + "\n")
