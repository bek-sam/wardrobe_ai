import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const repositoryRoot = process.cwd();
const projects = {
  frontend: { root: repositoryRoot, source: path.join(repositoryRoot, "src") },
  backend: { root: path.join(repositoryRoot, "backend"), source: path.join(repositoryRoot, "backend/src") },
  worker: { root: path.join(repositoryRoot, "worker"), source: path.join(repositoryRoot, "worker/src") },
  "ai-orchestration": {
    root: path.join(repositoryRoot, "ai-orchestration"),
    source: path.join(repositoryRoot, "ai-orchestration/src"),
  },
  contracts: { root: path.join(repositoryRoot, "contracts"), source: path.join(repositoryRoot, "contracts/src") },
};
const requiredDirectories = [
  "backend",
  "worker",
  "ai-orchestration",
  "contracts",
  "database",
  "infrastructure",
  "legacy",
  "scripts",
  "src",
];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts"]);
const forbiddenPackages = {
  frontend: ["@supabase/", "openai", "sharp", "fastify", "@wardrobe/backend", "@wardrobe/worker", "@wardrobe/ai-orchestration"],
  backend: ["openai", "@wardrobe/worker", "@wardrobe/ai-orchestration"],
  worker: ["openai", "@wardrobe/backend", "@wardrobe/ai-orchestration", "@supabase/ssr"],
  "ai-orchestration": ["@supabase/", "postgres", "pg", "@wardrobe/backend", "@wardrobe/worker"],
  contracts: ["next", "react", "fastify", "@supabase/", "openai", "sharp"],
};
const forbiddenSourcePatterns = {
  frontend: [
    { pattern: /SUPABASE_(?:SERVICE_ROLE|SECRET)/g, reason: "Supabase privileged credential name" },
    { pattern: /OPENAI_[A-Z0-9_]+/g, reason: "AI provider configuration" },
    { pattern: /AI_SERVICE_TOKEN/g, reason: "private workload token" },
    { pattern: /AUTH_(?:ACTION|RATE_LIMIT_HMAC)_SECRET/g, reason: "Backend auth secret" },
  ],
  backend: [{ pattern: /OPENAI_[A-Z0-9_]+/g, reason: "AI provider configuration" }],
  worker: [{ pattern: /OPENAI_[A-Z0-9_]+/g, reason: "AI provider configuration" }],
  "ai-orchestration": [
    { pattern: /SUPABASE_(?:URL|PUBLISHABLE|SERVICE_ROLE|SECRET)/g, reason: "product database configuration" },
  ],
};

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory() && !["node_modules", "dist", ".next"].includes(entry.name)) return walk(absolute);
    return entry.isFile() ? [absolute] : [];
  });
}

function importsIn(file) {
  const source = fs.readFileSync(file, "utf8");
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const imports = [];
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      imports.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    )
      imports.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return imports;
}

function relative(file) {
  return path.relative(repositoryRoot, file).split(path.sep).join("/");
}

function inside(directory, target) {
  const difference = path.relative(directory, target);
  return difference === "" || (!difference.startsWith("..") && !path.isAbsolute(difference));
}

function forbidden(specifier, rule) {
  return specifier === rule || specifier.startsWith(`${rule}/`) || specifier.startsWith(rule);
}

const violations = [];
for (const directory of requiredDirectories) {
  if (!fs.existsSync(path.join(repositoryRoot, directory))) violations.push(`Missing root owner: ${directory}/`);
}
if (fs.existsSync(path.join(repositoryRoot, "frontend"))) {
  violations.push("Redundant frontend/ project exists; root src/ is the only Frontend owner.");
}
if (fs.existsSync(path.join(repositoryRoot, "src/app/api"))) {
  violations.push("Frontend contains src/app/api; public API handlers belong in backend/.");
}
if (fs.existsSync(path.join(repositoryRoot, "src/jobs"))) {
  violations.push("Frontend contains src/jobs; durable processors belong in worker/.");
}
if (fs.existsSync(path.join(repositoryRoot, "backend/src/jobs"))) {
  violations.push("Backend contains jobs; durable processors belong in worker/.");
}

for (const [name, project] of Object.entries(projects)) {
  const files = walk(project.source).filter((file) => sourceExtensions.has(path.extname(file)));
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const { pattern, reason } of forbiddenSourcePatterns[name] ?? []) {
      pattern.lastIndex = 0;
      if (pattern.test(source)) violations.push(`${relative(file)} contains forbidden ${name} ${reason}`);
    }
    if (name === "frontend") {
      for (const match of source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
        const key = match[1];
        if (key !== "NODE_ENV" && key !== "BACKEND_URL" && !key.startsWith("NEXT_PUBLIC_")) {
          violations.push(`${relative(file)} reads non-public Frontend environment variable ${key}`);
        }
      }
    }
    for (const specifier of importsIn(file)) {
      if (specifier.startsWith(".")) {
        const target = path.resolve(path.dirname(file), specifier);
        if (!inside(project.source, target)) {
          violations.push(`${relative(file)} imports outside ${name} source: ${specifier}`);
        }
      }
      if (
        specifier.startsWith("@wardrobe/") &&
        specifier !== "@wardrobe/contracts" &&
        !specifier.startsWith("@wardrobe/contracts/")
      ) {
        violations.push(`${relative(file)} imports deployable implementation ${specifier}`);
      }
      for (const rule of forbiddenPackages[name] ?? []) {
        if (forbidden(specifier, rule)) {
          violations.push(`${relative(file)} uses forbidden ${name} dependency ${specifier}`);
        }
      }
      if (specifier.includes("/legacy/") || specifier.includes("/scripts/")) {
        violations.push(`${relative(file)} imports non-production source ${specifier}`);
      }
    }
  }

  const packagePath = path.join(project.root, "package.json");
  if (!fs.existsSync(packagePath)) continue;
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const dependencies = { ...packageJson.dependencies, ...packageJson.optionalDependencies };
  for (const dependency of Object.keys(dependencies)) {
    for (const rule of forbiddenPackages[name] ?? []) {
      if (forbidden(dependency, rule)) {
        violations.push(`${relative(packagePath)} declares forbidden ${name} dependency ${dependency}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`Project boundary check failed (${violations.length} violation(s)):`);
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(
    "Project boundary check passed: root src is Frontend-only; deployables share contracts and communicate across network boundaries.",
  );
}
