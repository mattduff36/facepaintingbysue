import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recordLogoTap } from "../lib/admin-logo-taps";

describe("admin logo taps", () => {
  it("does nothing for the first four taps inside the window", () => {
    let times: number[] = [];
    let unlocked = false;
    for (let i = 0; i < 4; i += 1) {
      const next = recordLogoTap(times, 1000 + i * 200);
      times = next.times;
      unlocked = next.unlocked;
    }
    assert.equal(unlocked, false);
    assert.equal(times.length, 4);
  });

  it("unlocks on the fifth tap within three seconds", () => {
    let times: number[] = [];
    let unlocked = false;
    for (let i = 0; i < 5; i += 1) {
      const next = recordLogoTap(times, 1000 + i * 500);
      times = next.times;
      unlocked = next.unlocked;
    }
    assert.equal(unlocked, true);
    assert.equal(times.length, 0);
  });

  it("does not unlock if taps are spread outside three seconds", () => {
    let times: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const next = recordLogoTap(times, 1000 + i * 800);
      times = next.times;
      assert.equal(next.unlocked, false);
    }
    assert.equal(times.length < 5, true);
  });
});
