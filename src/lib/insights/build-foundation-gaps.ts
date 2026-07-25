export function buildFoundationGaps(roles: ReadonlyMap<string, number>) {
  const hasBaseFoundation =
    (roles.get("dress") ?? 0) > 0 ||
    ((roles.get("top") ?? 0) > 0 && (roles.get("bottom") ?? 0) > 0);
  const missingFoundations = [
    ...(!hasBaseFoundation && (roles.get("top") ?? 0) === 0 ? ["top"] : []),
    ...(!hasBaseFoundation && (roles.get("bottom") ?? 0) === 0 ? ["bottom"] : []),
    ...((roles.get("shoes") ?? 0) === 0 ? ["shoes"] : []),
    ...((roles.get("layer") ?? 0) === 0 ? ["layer"] : []),
  ];
  return missingFoundations.map((role) => ({
    role,
    note: `No active ${role} is recorded. Add one only if it matches your real routines.`,
  }));
}
