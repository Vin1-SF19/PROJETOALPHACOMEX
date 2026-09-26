import { expect, it } from "vitest";
import { destinoEhPosterior } from "@/lib/bpm/ordem-etapas";

it("só admite destinos com ordem maior que a origem", () => {
  expect(destinoEhPosterior(1, 2)).toBe(true);
  expect(destinoEhPosterior(1, 1)).toBe(false);
  expect(destinoEhPosterior(2, 1)).toBe(false);
});
