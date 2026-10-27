#!/usr/bin/env python3
"""Normalise a pg_dump --schema-only for comparison (applied to BOTH sides).

Dropped: the header (SET lines, search_path), ownership noise, '\\restrict'
tokens. NOT NULL constraint names are removed (PostgreSQL 18 names them after
the table a column was created in, so a renamed table keeps node_* names), and
objects are sorted by (type, name) so the order of sections does not matter.
"""
import re
import sys

text = open([a for a in sys.argv[1:] if not a.startswith("--")][0]).read()
text = "\n".join(l for l in text.split("\n") if not l.startswith("\\"))
HDR = re.compile(r"^--\n-- Name: (?P<name>.*?); Type: (?P<type>[A-Z ]+); Schema: (?:public|-); Owner: -.*\n--\n\n", re.M)
parts = HDR.split(text)
blocks = []
for i in range(1, len(parts), 3):
    name, typ, sql = parts[i], parts[i + 1], parts[i + 2].strip()
    blocks.append((typ, name, sql))


def norm(s):
    s = re.sub(r" CONSTRAINT \w+ NOT NULL", " NOT NULL", s)
    return s


out = []
for typ, name, sql in blocks:
    sql, name = norm(sql), norm(name)
    out.append((typ, name, sql))
out.sort()
for typ, name, sql in out:
    print(f"## {typ} {name}\n{sql}\n")
