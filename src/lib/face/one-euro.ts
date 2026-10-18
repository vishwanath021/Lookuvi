import type { Pt } from "@/lib/face/makeup-paint";

type Axis = { value: number; deriv: number };

function alpha(cutoff: number, dt: number) {
  const tau = 1 / (2 * Math.PI * Math.max(0.001, cutoff));
  return 1 / (1 + tau / Math.max(0.001, dt));
}

/**
 * One-euro filter for a landmark stream.
 * A still face stays put. A real move is followed. A one-frame spike is damped.
 */
export function createOneEuroFilter(minCutoff = 1.1, beta = 0.4, dCutoff = 1) {
  let time = 0;
  let axes: { x: Axis; y: Axis }[] = [];

  function step(axis: Axis, value: number, dt: number) {
    const deriv = (value - axis.value) / dt;
    const derivHat = axis.deriv + alpha(dCutoff, dt) * (deriv - axis.deriv);
    const next = axis.value + alpha(minCutoff + beta * Math.abs(derivHat), dt) * (value - axis.value);
    axis.value = next;
    axis.deriv = derivHat;
    return next;
  }

  return function filter(points: Pt[], nowMs: number): Pt[] {
    const t = nowMs / 1000;
    const dt = time ? Math.min(0.1, Math.max(1 / 120, t - time)) : 1 / 30;
    time = t;
    if (axes.length !== points.length) {
      axes = points.map((point) => ({ x: { value: point.x, deriv: 0 }, y: { value: point.y, deriv: 0 } }));
      return points.map((point) => ({ x: point.x, y: point.y }));
    }
    return points.map((point, index) => {
      const state = axes[index]!;
      return { x: step(state.x, point.x, dt), y: step(state.y, point.y, dt) };
    });
  };
}
