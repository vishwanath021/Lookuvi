import { describe, expect, it } from "vitest";
import { LIVE_FACE_DELEGATE, LIVE_FACE_MODE, nextVideoStamp } from "@/lib/face/live-vision";
import { LIVE_FULL_EDGE } from "@/lib/face/live-budget";
import { createOneEuroFilter } from "@/lib/face/one-euro";

describe("live face tracking", () => {
  it("uses the GPU video landmarker and tracks at 480p", () => {
    expect(LIVE_FACE_MODE).toBe("VIDEO");
    expect(LIVE_FACE_DELEGATE).toBe("GPU");
    expect(LIVE_FULL_EDGE).toBe(480);
  });

  it("keeps video timestamps moving forward", () => {
    const first = nextVideoStamp(10);
    const second = nextVideoStamp(10);
    const third = nextVideoStamp(40);
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
  });

  it("damps a one-frame spike and follows a held move", () => {
    const filter = createOneEuroFilter();
    const still = { x: 0.4, y: 0.5 };
    filter([still], 0);
    const spiked = filter([{ x: 0.9, y: 0.5 }], 33);
    expect(spiked[0]!.x).toBeGreaterThan(0.4);
    expect(spiked[0]!.x).toBeLessThan(0.7);
    let point = spiked[0]!;
    for (let step = 2; step < 20; step += 1) {
      point = filter([{ x: 0.9, y: 0.5 }], step * 33)[0]!;
    }
    expect(point.x).toBeGreaterThan(0.8);
  });
});
