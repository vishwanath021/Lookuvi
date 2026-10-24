// Local browse of the public salon. No login, no AI, no WhatsApp.
// Run: k6 run -e BASE=http://127.0.0.1:3000 scripts/k6/guest-browse.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1500"],
  },
};

const base = __ENV.BASE || "http://127.0.0.1:3000";

export default function guestBrowse() {
  const health = http.get(`${base}/api/health`);
  check(health, { "health 200": (response) => response.status === 200 });
  const welcome = http.get(`${base}/s/demo/welcome`);
  check(welcome, { "welcome 200": (response) => response.status === 200 });
  const board = http.get(`${base}/api/v1/queue?slug=demo`);
  check(board, { "board 200": (response) => response.status === 200 });
  sleep(1);
}
