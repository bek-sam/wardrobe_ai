import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import ts from "typescript";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const sourceExtensions = [".ts", ".tsx"];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

function classify(file) {
  const parts = relative(file).split("/");
  if (parts[1] === "features") return `feature:${parts[2] ?? "unknown"}`;
  if (parts[1] === "lib") return `lib:${parts[2] ?? "unknown"}`;
  if (parts[1] === "jobs") return `job:${parts[2] ?? "unknown"}`;
  if (parts[1] === "app") return parts[2] === "api" ? "app:api" : "app:web";
  if (parts[1] === "components") return `components:${parts[2] ?? "shared"}`;
  return parts.slice(0, 2).join(":");
}

const files = walk(sourceRoot).filter((file) => sourceExtensions.includes(path.extname(file)));
const fileSet = new Set(files.map((file) => path.normalize(file)));

function resolveImport(fromFile, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = path.join(sourceRoot, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(fromFile), specifier);
  else return null;

  const candidates = [
    ...sourceExtensions.map((extension) => `${base}${extension}`),
    ...sourceExtensions.map((extension) => path.join(base, `index${extension}`)),
  ];
  return candidates.map(path.normalize).find((candidate) => fileSet.has(candidate)) ?? null;
}

function importSpecifiers(file, source) {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const imports = [];

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return imports;
}

const contents = new Map(files.map((file) => [file, fs.readFileSync(file, "utf8")]));
const lineCounts = new Map(
  [...contents].map(([file, source]) => {
    if (source === "") return [file, 0];
    const count = source.split(/\r?\n/).length;
    return [file, source.endsWith("\n") ? count - 1 : count];
  }),
);
const graph = new Map(files.map((file) => [file, new Set()]));
const unresolvedInternalImports = [];

for (const [file, source] of contents) {
  for (const specifier of importSpecifiers(file, source)) {
    const target = resolveImport(file, specifier);
    if (target) graph.get(file).add(target);
    else if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      unresolvedInternalImports.push({ from: relative(file), specifier });
    }
  }
}

const incoming = new Map(files.map((file) => [file, 0]));
for (const targets of graph.values()) {
  for (const target of targets) incoming.set(target, (incoming.get(target) ?? 0) + 1);
}

function stronglyConnectedComponents() {
  let nextIndex = 0;
  const indices = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];

  function connect(node) {
    indices.set(node, nextIndex);
    lowLinks.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);

    for (const target of graph.get(node)) {
      if (!indices.has(target)) {
        connect(target);
        lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(target)));
      } else if (onStack.has(target)) {
        lowLinks.set(node, Math.min(lowLinks.get(node), indices.get(target)));
      }
    }

    if (lowLinks.get(node) === indices.get(node)) {
      const component = [];
      let member;
      do {
        member = stack.pop();
        onStack.delete(member);
        component.push(member);
      } while (member !== node);
      components.push(component);
    }
  }

  for (const file of files) if (!indices.has(file)) connect(file);
  return components.filter((component) => component.length > 1);
}

const boundaryEdges = new Map();
const crossFeatureImports = [];
for (const [from, targets] of graph) {
  for (const to of targets) {
    const fromBoundary = classify(from);
    const toBoundary = classify(to);
    if (fromBoundary !== toBoundary) {
      const key = `${fromBoundary} -> ${toBoundary}`;
      boundaryEdges.set(key, (boundaryEdges.get(key) ?? 0) + 1);
    }
    if (
      fromBoundary.startsWith("feature:") &&
      toBoundary.startsWith("feature:") &&
      fromBoundary !== toBoundary
    ) {
      crossFeatureImports.push({ from: relative(from), to: relative(to) });
    }
  }
}

function aggregate(prefix) {
  const matching = files.filter((file) => relative(file).startsWith(prefix));
  return {
    files: matching.length,
    lines: matching.reduce((sum, file) => sum + lineCounts.get(file), 0),
  };
}

const featureNames = [
  ...new Set(
    files
      .map(relative)
      .filter((file) => file.startsWith("src/features/"))
      .map((file) => file.split("/")[2]),
  ),
].sort();
const sortedLines = [...lineCounts.values()].sort((a, b) => a - b);
const cycles = stronglyConnectedComponents().map((component) => component.map(relative).sort());

function reachableFrom(entryFiles) {
  const reached = new Set();
  const pending = [...entryFiles];
  while (pending.length > 0) {
    const file = pending.pop();
    if (!file || reached.has(file)) continue;
    reached.add(file);
    for (const target of graph.get(file) ?? []) pending.push(target);
  }
  return reached;
}

const isApiRoute = (file) => relative(file).startsWith("src/app/api/") && file.endsWith("/route.ts");
const isAuthCallbackRoute = (file) =>
  relative(file).startsWith("src/app/auth/") && file.endsWith("/route.ts");
const isWebEntry = (file) => {
  const name = path.basename(file);
  return (
    relative(file).startsWith("src/app/") &&
    !isApiRoute(file) &&
    !isAuthCallbackRoute(file) &&
    [
      "page.ts",
      "page.tsx",
      "layout.ts",
      "layout.tsx",
      "error.ts",
      "error.tsx",
      "loading.ts",
      "loading.tsx",
      "not-found.ts",
      "not-found.tsx",
      "global-error.ts",
      "global-error.tsx",
    ].includes(name)
  );
};

const frontendReachable = reachableFrom([
  ...files.filter(isWebEntry),
  ...files.filter((file) => relative(file) === "src/proxy.ts"),
]);
const backendReachable = reachableFrom(files.filter((file) => isApiRoute(file) || isAuthCallbackRoute(file)));
const workerReachable = reachableFrom(
  files.filter((file) => relative(file).startsWith("src/jobs/")),
);
const overlap = (left, right) => [...left].filter((file) => right.has(file));

const report = {
  generatedAt: new Date().toISOString(),
  source: {
    files: files.length,
    lines: sortedLines.reduce((sum, count) => sum + count, 0),
    lineDistribution: {
      p25: percentile(sortedLines, 0.25),
      median: percentile(sortedLines, 0.5),
      p75: percentile(sortedLines, 0.75),
      p90: percentile(sortedLines, 0.9),
      p95: percentile(sortedLines, 0.95),
      max: sortedLines.at(-1) ?? 0,
      atMost10: sortedLines.filter((count) => count <= 10).length,
      atMost25: sortedLines.filter((count) => count <= 25).length,
    },
  },
  features: Object.fromEntries(
    featureNames.map((name) => [name, aggregate(`src/features/${name}/`)]),
  ),
  dependencies: {
    resolvedInternalEdges: [...graph.values()].reduce((sum, targets) => sum + targets.size, 0),
    unresolvedInternalImports,
    cycles,
    crossFeatureImportCount: crossFeatureImports.length,
    crossFeatureImports,
    topBoundaryEdges: [...boundaryEdges]
      .sort((first, second) => second[1] - first[1])
      .slice(0, 30)
      .map(([edge, count]) => ({ edge, count })),
    topFanOut: [...graph]
      .sort((first, second) => second[1].size - first[1].size)
      .slice(0, 20)
      .map(([file, targets]) => ({ file: relative(file), imports: targets.size })),
    topFanIn: [...incoming]
      .sort((first, second) => second[1] - first[1])
      .slice(0, 20)
      .map(([file, count]) => ({ file: relative(file), importers: count })),
  },
  boundaries: {
    routeFiles: files.filter((file) => relative(file).endsWith("/route.ts")).length,
    routesWithDirectTableAccess: [...contents].filter(
      ([file, source]) => relative(file).startsWith("src/app/api/") && source.includes(".from("),
    ).length,
    sourceFilesUsingAdminClient: [...contents].filter(([, source]) =>
      source.includes("@/lib/supabase/admin"),
    ).length,
    sourceFilesUsingProcessEnv: [...contents].filter(([, source]) =>
      source.includes("process.env"),
    ).length,
    tinyIndexFiles: files.filter(
      (file) => path.basename(file) === "index.ts" && lineCounts.get(file) <= 5,
    ).length,
    runtimeReachability: {
      frontend: frontendReachable.size,
      backend: backendReachable.size,
      worker: workerReachable.size,
      frontendBackendOverlap: overlap(frontendReachable, backendReachable).map(relative).sort(),
      frontendWorkerOverlap: overlap(frontendReachable, workerReachable).map(relative).sort(),
      backendWorkerOverlap: overlap(backendReachable, workerReachable).map(relative).sort(),
      unreferenced: files
        .filter(
          (file) =>
            !frontendReachable.has(file) && !backendReachable.has(file) && !workerReachable.has(file),
        )
        .map(relative)
        .sort(),
    },
  },
};

if (process.argv.includes("--check")) {
  const unresolvedCodeImports = unresolvedInternalImports.filter(
    ({ specifier }) => !specifier.endsWith(".css"),
  );
  const violations = [
    ...cycles.map((cycle) => `Dependency cycle: ${cycle.join(" -> ")}`),
    ...unresolvedCodeImports.map(
      ({ from, specifier }) => `Unresolved internal import: ${from} imports ${specifier}`,
    ),
  ];
  if (violations.length > 0) {
    console.error(`Architecture check failed (${violations.length} violation(s)):`);
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Architecture check passed: ${files.length} files, ${report.dependencies.resolvedInternalEdges} edges, no cycles.`,
    );
  }
} else if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log("Wardrobe architecture audit");
  console.log(JSON.stringify(report, null, 2));
}
