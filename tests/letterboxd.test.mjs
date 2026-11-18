// The swear filter for Letterboxd reviews: swears become {bleep:N}, ordinary words stay.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bleep } from "../tools/letterboxd.mjs";

test("swears are blanked, including stretched ones", () => {
  assert.equal(bleep("fuck, wtf was in the envelope FACKKK FUCKKK"), "{bleep:4}, {bleep:3} was in the envelope {bleep:6} {bleep:6}");
  assert.equal(bleep("holy shit this was bullshit"), "holy {bleep:4} this was {bleep:8}");
});

test("words that only contain a swear are left alone", () => {
  const clean = "Charles Dickens would pass, class act, assassin vibes, Scunthorpe, cant give it 5";
  assert.equal(bleep(clean), clean);
});
