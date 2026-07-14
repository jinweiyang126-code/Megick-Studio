#!/usr/bin/env node
/**
 * Fetch published Template Center data from megick.com (or another source)
 * and optionally import into a Megick Studio admin API.
 *
 * Export only (default):
 *   node scripts/import-megick-templates.mjs
 *   node scripts/import-megick-templates.mjs --source https://megick.com --out tmp/megick-templates.json
 *
 * Import into your deployment (creates categories then templates):
 *   node scripts/import-megick-templates.mjs --apply \
 *     --target https://megick.abcyjw.me \
 *     --cookie "mg_session=YOUR_SESSION_COOKIE"
 *
 * Re-run safely: skips templates whose params.megickSourceId already exists on target.
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    source: "https://megick.com",
    target: "",
    out: "tmp/megick-templates.json",
    cookie: "",
    pageSize: 50,
    apply: false,
    fromFile: "",
    status: "PUBLISHED",
    delayMs: 120,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === "--source" && next) {
      args.source = next.replace(/\/$/, "");
      i += 1;
    } else if (token === "--target" && next) {
      args.target = next.replace(/\/$/, "");
      i += 1;
    } else if (token === "--out" && next) {
      args.out = next;
      i += 1;
    } else if (token === "--cookie" && next) {
      args.cookie = next;
      i += 1;
    } else if (token === "--page-size" && next) {
      args.pageSize = Number(next) || 50;
      i += 1;
    } else if (token === "--from-file" && next) {
      args.fromFile = next;
      i += 1;
    } else if (token === "--status" && next) {
      args.status = next;
      i += 1;
    } else if (token === "--delay-ms" && next) {
      args.delayMs = Number(next) || 0;
      i += 1;
    } else if (token === "--apply") {
      args.apply = true;
    } else if (token === "--help" || token === "-h") {
      args.help = true;
    }
  }
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, { cookie, method = "GET", body } = {}) {
  const headers = { Accept: "application/json" };
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail =
      data && typeof data === "object" && "message" in data
        ? String(data.message)
        : text.slice(0, 300);
    throw new Error(`${method} ${url} → ${res.status}: ${detail}`);
  }
  return data;
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim());
}

function uniqueNames(values) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

async function fetchAllTemplates(source, pageSize, delayMs) {
  const items = [];
  let page = 1;
  let pageCount = 1;
  while (page <= pageCount) {
    const url = new URL("/api/templates", source);
    url.searchParams.set("compact", "true");
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));
    const data = await fetchJson(url.toString());
    const batch = Array.isArray(data?.items) ? data.items : [];
    items.push(...batch);
    pageCount = Number(data?.pageCount) || 1;
    console.log(`Fetched page ${page}/${pageCount} (${batch.length} items, total ${items.length})`);
    page += 1;
    if (delayMs > 0 && page <= pageCount) await sleep(delayMs);
  }
  return items;
}

async function fetchCategories(source) {
  return fetchJson(`${source}/api/templates/categories`);
}

function toImportPayload(item, status) {
  const categories = uniqueNames([
    ...asStringArray(item.categories),
    ...(item.category ? [item.category] : []),
  ]);
  const referenceAssetKeys = uniqueNames([
    ...asStringArray(item.referenceAssetKeys),
    ...asStringArray(item.referenceUrls),
  ]);
  const exampleAssetKey =
    (typeof item.exampleAssetKey === "string" && item.exampleAssetKey.trim()) ||
    (typeof item.exampleUrl === "string" && item.exampleUrl.trim()) ||
    null;
  const params =
    item.params && typeof item.params === "object" && !Array.isArray(item.params)
      ? { ...item.params }
      : {};
  params.megickSourceId = item.id;
  params.megickSourceHost = "megick.com";

  return {
    type: item.type === "IMAGE2VIDEO" ? "IMAGE2VIDEO" : "TEXT2IMAGE",
    status,
    title: String(item.title || "").trim(),
    description: item.description ?? null,
    textPrompt: String(item.textPrompt || "").trim(),
    materialPrompt: item.materialPrompt ?? null,
    referenceAssetKeys,
    exampleAssetKey,
    modelCode: item.modelCode ?? null,
    params,
    tags: asStringArray(item.tags),
    category: categories[0] ?? null,
    categories,
    sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : 0,
    isFeatured: Boolean(item.isFeatured),
  };
}

async function listExistingSourceIds(target, cookie) {
  const ids = new Set();
  let page = 1;
  let pageCount = 1;
  while (page <= pageCount) {
    const url = new URL("/api/admin/templates", target);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", "100");
    const data = await fetchJson(url.toString(), { cookie });
    const batch = Array.isArray(data?.items) ? data.items : [];
    for (const item of batch) {
      const sourceId = item?.params?.megickSourceId;
      if (typeof sourceId === "string" && sourceId) ids.add(sourceId);
    }
    pageCount = Number(data?.pageCount) || 1;
    page += 1;
  }
  return ids;
}

async function ensureCategories(target, cookie, categories) {
  if (!categories.length) return;
  const existing = await fetchJson(`${target}/api/admin/templates/categories`, { cookie });
  const byName = new Set(
    (Array.isArray(existing) ? existing : []).map((item) => item.name).filter(Boolean),
  );
  let sortOrder = byName.size;
  for (const category of categories) {
    const name = category.name?.trim();
    if (!name || byName.has(name)) continue;
    await fetchJson(`${target}/api/admin/templates/categories`, {
      cookie,
      method: "POST",
      body: {
        name,
        sortOrder: typeof category.sortOrder === "number" ? category.sortOrder : sortOrder,
        isActive: category.isActive ?? true,
      },
    });
    byName.add(name);
    sortOrder += 1;
    console.log(`Created category: ${name}`);
  }
}

async function importTemplates({ target, cookie, categories, templates, status, delayMs }) {
  await ensureCategories(
    target,
    cookie,
    categories.length
      ? categories
      : uniqueNames(templates.flatMap((item) => item.categories ?? [])).map((name, index) => ({
          name,
          sortOrder: index,
          isActive: true,
        })),
  );

  const existingIds = await listExistingSourceIds(target, cookie);
  const localCats = await fetchJson(`${target}/api/admin/templates/categories`, { cookie });
  const allowedCategories = new Set(
    (Array.isArray(localCats) ? localCats : []).map((row) => row.name).filter(Boolean),
  );
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, item] of templates.entries()) {
    const payload = toImportPayload(item, status);
    if (!payload.title || !payload.textPrompt) {
      skipped += 1;
      console.warn(`[${index + 1}/${templates.length}] skip incomplete template ${item.id}`);
      continue;
    }
    if (existingIds.has(item.id)) {
      skipped += 1;
      console.log(`[${index + 1}/${templates.length}] skip existing ${item.id} (${payload.title})`);
      continue;
    }
    try {
      if (payload.categories?.length) {
        payload.categories = payload.categories.filter((name) => allowedCategories.has(name));
        payload.category = payload.categories[0] ?? null;
      }
      await fetchJson(`${target}/api/admin/templates`, {
        cookie,
        method: "POST",
        body: payload,
      });
      existingIds.add(item.id);
      created += 1;
      console.log(`[${index + 1}/${templates.length}] imported ${item.id} (${payload.title})`);
    } catch (error) {
      failed += 1;
      console.error(
        `[${index + 1}/${templates.length}] failed ${item.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  return { created, skipped, failed };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:
  node scripts/import-megick-templates.mjs [--source URL] [--out FILE]
  node scripts/import-megick-templates.mjs --apply --target URL --cookie "mg_session=..."
  node scripts/import-megick-templates.mjs --apply --from-file FILE --target URL --cookie "..."`);
    return;
  }

  let categories = [];
  let templates = [];

  if (args.fromFile) {
    const dump = JSON.parse(await readFile(args.fromFile, "utf8"));
    categories = Array.isArray(dump.categories) ? dump.categories : [];
    templates = Array.isArray(dump.templates) ? dump.templates : [];
    console.log(`Loaded ${templates.length} templates from ${args.fromFile}`);
  } else {
    categories = await fetchCategories(args.source);
    templates = await fetchAllTemplates(args.source, args.pageSize, args.delayMs);
    const outPath = path.resolve(args.out);
    await mkdir(path.dirname(outPath), { recursive: true });
    const dump = {
      exportedAt: new Date().toISOString(),
      source: args.source,
      total: templates.length,
      categories,
      templates,
    };
    await writeFile(outPath, `${JSON.stringify(dump, null, 2)}\n`, "utf8");
    console.log(`Wrote ${templates.length} templates + ${categories.length} categories → ${outPath}`);
  }

  if (!args.apply) {
    console.log("Export complete. Re-run with --apply --target --cookie to import.");
    return;
  }

  if (!args.target) throw new Error("--target is required with --apply");
  if (!args.cookie) throw new Error("--cookie is required with --apply (admin mg_session)");

  const summary = await importTemplates({
    target: args.target,
    cookie: args.cookie,
    categories,
    templates,
    status: args.status,
    delayMs: args.delayMs,
  });
  console.log(
    `Done. created=${summary.created} skipped=${summary.skipped} failed=${summary.failed}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
