// State-only publish/pause revisions may be rebased without losing local edits.
// A changed saved definition always requires an explicit reload.
export function resolveDraftRevision(
  localRevision: number,
  remoteRevision: number,
  savedDefinition: string,
  remoteDefinition: string,
) {
  const conflict =
    remoteRevision > localRevision && savedDefinition !== remoteDefinition;
  return {
    conflict,
    revision: conflict
      ? localRevision
      : Math.max(localRevision, remoteRevision),
  };
}
