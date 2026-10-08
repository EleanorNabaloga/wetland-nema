import fs from 'fs';

function patch(file, edits) {
  let s = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  let changed = false;
  for (const [from, to, label] of edits) {
    if (s.includes(to)) { console.log(file + ': "' + label + '" already applied'); continue; }
    if (!s.includes(from)) { console.log(file + ': COULD NOT FIND "' + label + '" - tell Claude'); continue; }
    s = s.replace(from, to);
    changed = true;
    console.log(file + ': applied "' + label + '"');
  }
  if (changed) fs.writeFileSync(file, s);
}

patch('app/api/reports/[id]/route.js', [
  [
    'import { CATEGORIES, NEEDS_INSPECTION } from "@/lib/sla";',
    'import { CATEGORIES, NEEDS_INSPECTION } from "@/lib/sla";\nimport { recordTrustEvent, eventForCategory } from "@/lib/trust";',
    'import trust helpers',
  ],
  [
    '      return { ok: true };\n    });',
    '      return { ok: true, categoryChanged: categoryGiven && b.category !== row.triage_category, category };\n    });',
    'report whether the category changed',
  ],
  [
    '    if (result.error) return json({ error: result.error }, result.code);\n    return json({ ok: true });',
    '    if (result.error) return json({ error: result.error }, result.code);\n\n    // Trust score. This must never stop an officer from reviewing a report.\n    try {\n      if (b.falseReport === true) await recordTrustEvent(id, "report_false");\n      else if (result.categoryChanged) {\n        const ev = eventForCategory(result.category);\n        if (ev) await recordTrustEvent(id, ev);\n      }\n    } catch (e) {\n      console.error("Trust score update failed:", e);\n    }\n    return json({ ok: true });',
    'update trust after a review',
  ],
]);

patch('app/dashboard/page.js', [
  [
    'const [error, setError] = useState("");',
    'const [error, setError] = useState("");\n  const [trust, setTrust] = useState(null);\n  const [trustTick, setTrustTick] = useState(0);',
    'trust state',
  ],
  [
    '  const needsInspection = sel && NEEDS_INSPECTION.includes(sel.category);',
    '  const needsInspection = sel && NEEDS_INSPECTION.includes(sel.category);\n\n  useEffect(() => {\n    setTrust(null);\n    if (!selId) return;\n    let live = true;\n    fetch("/api/trust?report=" + encodeURIComponent(selId), { cache: "no-store" })\n      .then((r) => (r.ok ? r.json() : null))\n      .then((d) => {\n        if (live) setTrust(d);\n      })\n      .catch(() => {});\n    return () => {\n      live = false;\n    };\n  }, [selId, sel && sel.status, sel && sel.category, trustTick]);',
    'load trust for the selected report',
  ],
  [
    '<dt>Evidence hash</dt>',
    '<dt>Reporter trust</dt>\n                <dd>\n                  {trust\n                    ? `${trust.level} (score ${trust.score}, ${trust.verifiedCount} verified)${trust.markedFalse ? " - marked false" : ""}`\n                    : "Not available"}\n                  {reviewed && trust && !trust.markedFalse && (\n                    <button\n                      type="button"\n                      className="ghost"\n                      style={{ marginLeft: 8 }}\n                      onClick={async () => {\n                        if (!confirm("Mark this report as false? This lowers the reporter\'s trust.")) return;\n                        if (await patch(sel.id, { falseReport: true })) {\n                          setTrustTick((n) => n + 1);\n                          load();\n                        }\n                      }}\n                    >\n                      Mark as false report\n                    </button>\n                  )}\n                </dd>\n                <dt>Evidence hash</dt>',
    'show trust and the false-report button',
  ],
]);
