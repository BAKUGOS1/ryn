import { expect, it } from "vitest";
import { resolveDraftRevision } from "@/features/automations/draft-session";
it("allows edited local work to save after publish and pause change only the revision", () => {
  expect(
    resolveDraftRevision(2, 4, "saved definition", "saved definition"),
  ).toEqual({ conflict: false, revision: 4 });
});
it("blocks overwriting a newer definition saved by another editor or JSON form", () => {
  expect(
    resolveDraftRevision(2, 3, "my baseline", "someone else's draft"),
  ).toEqual({ conflict: true, revision: 2 });
});
it("keeps the confirmed save revision while an older refresh is still in flight", () => {
  expect(
    resolveDraftRevision(5, 4, "my latest save", "previous definition"),
  ).toEqual({ conflict: false, revision: 5 });
});
