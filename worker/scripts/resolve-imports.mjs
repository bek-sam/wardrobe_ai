import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(projectRoot, "dist");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function emittedTarget(fromFile, specifier) {
  const base = specifier.startsWith("@/")
    ? path.join(outputRoot, specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, `${base}.js`, path.join(base, "index.js")];
  return candidates.find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
  );
}

function runtimeSpecifier(fromFile, specifier) {
  if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return specifier;
  const target = emittedTarget(fromFile, specifier);
  if (!target) throw new Error(`Cannot resolve emitted import ${specifier} from ${fromFile}`);
  const relative = path.relative(path.dirname(fromFile), target).split(path.sep).join("/");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

const importPattern = /((?:from\s+|import\s*\(\s*|import\s+)(["']))([^"']+)(\2)/g;
for (const file of walk(outputRoot).filter((candidate) => candidate.endsWith(".js"))) {
  const source = fs.readFileSync(file, "utf8");
  const rewritten = source.replace(
    importPattern,
    (match, prefix, quote, specifier, suffix) =>
      `${prefix}${runtimeSpecifier(file, specifier)}${suffix}`,
  );
  if (rewritten !== source) fs.writeFileSync(file, rewritten);
}
