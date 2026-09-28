const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
global.DOMParser = new JSDOM("").window.DOMParser;
const { createTracker, japanDate, normalizeId, parseSeason, parseUserPage, storageKey } = require("../tracking.js");

const USER = "https://smashmate.net/user/99901/";
const TODAY = "2026-09-28";
const NOW = new Date("2026-09-28T02:00:00Z");
const ranking = (season = 36) => `<p>第${season}期レーティングバトルのランキングです。</p>`;
const row = (id, result = "勝ち", delta = 15, opponent = "456") => ({ id: String(id), result, delta, opponent });

function page({ rows = [], wins = 0, losses = 0, rate = 1500, userId = "99901", pages = [], authenticated = true } = {}) {
  return `<!doctype html><html><body>
    ${authenticated ? '<a href="https://smashmate.net/php/logout/">ログアウト</a>' : ""}
    <div class="user-name">テストユーザー</div><div>MATE ID ${userId}</div>
    <h2>レーティング対戦</h2><div class="side">
      <div class="row"><div>現在レート</div><div><span class="rate_text">${rate}</span></div></div>
      <div class="row"><div>最高レート</div><div><span class="rate_text">${Math.max(rate, 1600)}</span></div></div>
      <div class="row"><div>対戦成績</div><div>${wins}勝 ${losses}敗<br>現在5連勝！</div></div>
    </div><h2>レーティング対戦履歴</h2><div class="smash-row">${rows.map((match) => `
      <div class="row row-battle">
        <div class="row-no"><a href="https://smashmate.net/rate/${match.id}/">${match.id.padStart(6, "0")}</a></div>
        <div class="col-xs-5"><a href="/user/${match.opponent}/">勝ち 負け ${match.opponent}</a></div>
        <div class="col-xs-2">${match.result}</div>
        <div class="col-xs-2"><span class="rate_text">${match.delta > 0 ? `＋${match.delta}` : String(match.delta).replace("-", "－")}</span></div>
      </div>`).join("")}</div>
    ${pages.map((number) => `<a href="/user/${userId}/?page=${number}">${number}</a>`).join("")}
  </body></html>`;
}

function setup(initial = {}) {
  const state = { pages: [page(initial)], season: 36, requests: [], store: new Map(), writes: [], now: NOW, ...initial.state };
  const fetchImpl = async (url, options) => {
    state.requests.push(url);
    assert.equal(options.credentials, "include");
    assert.equal(options.cache, "no-store");
    const target = new URL(url);
    const body = target.pathname === "/ranking/"
      ? ranking(typeof state.season === "function" ? state.season() : state.season)
      : state.pages[Number(target.searchParams.get("page") || 1) - 1];
    if (state.fetchHook) {
      const overridden = await state.fetchHook(url, body);
      if (overridden) return overridden;
    }
    return { ok: true, status: 200, url, text: async () => body };
  };
  const storage = {
    get: async (key) => state.store.get(key),
    set: async (key, value) => { state.writes.push([key, value]); state.store.set(key, value); },
  };
  const tracker = createTracker({ userUrl: USER, storage, fetchImpl, now: () => state.now });
  return { state, tracker, storage, fetchImpl };
}

test("IDs and Japanese date use canonical, timezone-independent forms", () => {
  assert.equal(normalizeId(" No. ００００１２ "), "12");
  assert.equal(normalizeId("000"), "0");
  assert.throws(() => normalizeId("12x"), { code: "INVALID_ID" });
  assert.throws(() => normalizeId("-12"), { code: "INVALID_ID" });
  assert.equal(normalizeId(0), "0");
  assert.equal(japanDate(new Date("2026-09-27T15:00:00Z")), TODAY);
  assert.equal(japanDate(new Date("2026-09-27T14:59:59Z")), "2026-09-27");
  assert.equal(parseSeason(ranking("３６")), "36");
  assert.throws(() => parseSeason("<p>ランキング</p>"), { code: "SEASON_UNKNOWN" });
});

test("parser scopes explicit result to the result column, accepts full-width deltas and detects next page", () => {
  const parsed = parseUserPage(page({ rows: [row(20, "負け", -19), row(19, "勝ち", 0), row(18, "対戦中止", 0)], wins: 1, losses: 1, pages: [1, 2, 3] }), USER);
  assert.deepEqual(parsed.rows.map((item) => [item.id, item.result, item.delta]), [["20", "loss", -19], ["19", "win", 0], ["18", "cancelled", 0]]);
  assert.equal(parsed.nextPage, 2);
  assert.equal(parsed.data.totalWins, 1);
  assert.throws(() => parseUserPage(page({ rows: [row(1, "不明")], wins: 1 }), USER), { code: "HISTORY_INVALID" });
  assert.throws(() => parseUserPage(page({ rows: [row(1, "勝ち", -15)], wins: 1 }), USER), { code: "HISTORY_INVALID" });
  assert.throws(() => parseUserPage(page({ rows: [row(1, "負け", 15)], losses: 1 }), USER), { code: "HISTORY_INVALID" });
  assert.throws(() => parseUserPage(page({ rows: [row(1)], wins: 1, userId: "999" }), USER), { code: "USER_MISMATCH" });
  assert.throws(() => parseUserPage(page({ rows: [row(1)], wins: 1, pages: [3] }), USER), { code: "PAGINATION_INVALID" });
});

test("first refresh saves latest completed ID, reopening counts every result across a return to the same rate", async () => {
  const { tracker, state } = setup({ rows: [row(10)], wins: 1, rate: 1515 });
  const first = await tracker.refresh();
  assert.equal(first.created, true);
  assert.equal(first.baseline.baselineId, "10");
  assert.equal(first.stats.total, 0);
  assert.equal(state.writes.length, 1);
  state.pages = [page({ rows: [row(13, "勝ち", 15), row(12, "負け", -15), row(11, "勝ち", 15), row(10)], wins: 3, losses: 1, rate: 1530 })];
  const later = await tracker.refresh();
  assert.equal(later.created, false);
  assert.equal(later.stats.wins, 2);
  assert.equal(later.stats.losses, 1);
  assert.deepEqual(later.stats.todayPoints, [{ x: 0, y: 1515 }, { x: 1, y: 1530 }, { x: 2, y: 1515 }, { x: 3, y: 1530 }]);
  assert.equal(state.writes.length, 1);
});

test("returning to the starting rate and zero-delta wins still count; cancellations do not", async () => {
  const { tracker, state } = setup({ rows: [row(10)], wins: 1, rate: 1515 });
  await tracker.refresh();
  state.pages = [page({ rows: [row(14, "対戦中止", 0), row(13, "勝ち", 0), row(12, "負け", -15), row(11), row(10)], wins: 3, losses: 1, rate: 1515 })];
  const { stats } = await tracker.refresh();
  assert.equal(stats.dailyChange, 0);
  assert.equal(stats.wins, 2);
  assert.equal(stats.losses, 1);
  assert.equal(stats.rateHistory.length, 3);
  assert.equal(stats.todayPoints.length, 4);
});

test("manual ID is exclusive, saves only after validation, and invalid or missing ID never overwrites", async () => {
  const { tracker, state } = setup({ rows: [row(3), row(2), row(1)], wins: 3, rate: 1545 });
  const manual = await tracker.refresh({ baselineId: "No. 0001" });
  assert.equal(manual.created, false);
  assert.equal(manual.stats.wins, 2);
  assert.equal(manual.stats.startRate, 1515);
  const saved = state.store.get(storageKey("99901", "36", TODAY));
  await assert.rejects(tracker.refresh({ baselineId: "oops" }), { code: "INVALID_ID" });
  await assert.rejects(tracker.refresh({ baselineId: "999" }), { code: "BASELINE_NOT_FOUND" });
  assert.equal(state.writes.length, 1);
  assert.equal(state.store.get(storageKey("99901", "36", TODAY)), saved);
  const reset = await tracker.refresh({ reset: true });
  assert.equal(reset.created, true);
  assert.equal(reset.baseline.baselineId, "3");
  assert.equal(reset.stats.total, 0);
});

test("pagination deduplicates identical IDs and counts beyond page 1", async () => {
  const { tracker, state } = setup();
  state.pages = [
    page({ rows: [row(4), row(3, "負け", -15)], wins: 3, losses: 1, rate: 1530, pages: [1, 2] }),
    page({ rows: [row(3, "負け", -15), row(2), row(1)], wins: 3, losses: 1, rate: 1530, pages: [1, 2] }),
  ];
  const { stats } = await tracker.refresh({ baselineId: "1" });
  assert.equal(stats.wins, 2);
  assert.equal(stats.losses, 1);
  assert.ok(state.requests.includes(`${USER}?page=2`));
});

test("pagination rejects conflicting duplicates, repeated pages, changing totals and missing baseline", async () => {
  const { tracker, state } = setup();
  const one = page({ rows: [row(3), row(2)], wins: 3, rate: 1545, pages: [1, 2] });
  state.pages = [one, page({ rows: [row(2, "負け", -15), row(1)], wins: 3, rate: 1545, pages: [1, 2] })];
  await assert.rejects(tracker.refresh({ baselineId: "1" }), { code: "HISTORY_CONFLICT" });
  state.pages = [one, page({ rows: [row(3), row(2)], wins: 3, rate: 1545, pages: [1, 2] })];
  await assert.rejects(tracker.refresh({ baselineId: "1" }), { code: "PAGINATION_LOOP" });
  state.pages = [one, page({ rows: [row(1)], wins: 4, rate: 1545, pages: [1, 2] })];
  await assert.rejects(tracker.refresh({ baselineId: "1" }), { code: "SNAPSHOT_CHANGED" });
  state.pages = [page({ rows: [row(3)], wins: 1, rate: 1515 })];
  await assert.rejects(tracker.refresh({ baselineId: "1" }), { code: "BASELINE_NOT_FOUND" });
  assert.equal(state.writes.length, 0);
});

test("a verified empty season creates baseline 0 and includes the first-ever match", async () => {
  const { tracker, state } = setup();
  assert.equal((await tracker.refresh()).baseline.baselineId, "0");
  assert.equal((await tracker.refresh()).stats.total, 0);
  state.pages = [page({ rows: [row(1)], wins: 1, rate: 1515 })];
  const later = await tracker.refresh();
  assert.equal(later.stats.wins, 1);
  assert.equal(later.stats.startRate, 1500);
});

test("explicit 0 collects the entire season and rejects incomplete totals", async () => {
  const { tracker, state } = setup({ rows: [row(2, "負け", -15), row(1)], wins: 1, losses: 1 });
  assert.equal((await tracker.refresh({ baselineId: "0" })).stats.total, 2);
  state.pages = [page({ rows: [row(2, "負け", -15)], wins: 1, losses: 1 })];
  await assert.rejects(tracker.refresh({ baselineId: "0" }), { code: "HISTORY_INCONSISTENT" });
  assert.equal(state.writes.length, 1);
});

test("day, season and tracked user each isolate their saved baseline", async () => {
  const { tracker, state, storage, fetchImpl } = setup({ rows: [row(10)], wins: 1, rate: 1515 });
  await tracker.refresh();
  state.now = new Date("2026-09-29T01:00:00Z");
  assert.equal((await tracker.refresh()).created, true);
  state.season = 37;
  state.pages = [page()];
  assert.equal((await tracker.refresh()).created, true);
  state.pages = [page({ userId: "999" })];
  const other = createTracker({ userUrl: "https://smashmate.net/user/999/?page=5", storage, fetchImpl, now: () => state.now });
  assert.equal((await other.refresh()).created, true);
  assert.deepEqual([...state.store.keys()], ["smc:v2:99901:36:2026-09-28", "smc:v2:99901:36:2026-09-29", "smc:v2:99901:37:2026-09-29", "smc:v2:999:37:2026-09-29"]);
});

test("pending matches cannot be baselines; newest cancellation can be one", async () => {
  const { tracker, state } = setup({ rows: [row(3, "対戦中", ""), row(2, "対戦中止", 0), row(1)], wins: 1, rate: 1515 });
  assert.equal((await tracker.refresh()).baseline.baselineId, "2");
  await assert.rejects(tracker.refresh({ baselineId: "3" }), { code: "BASELINE_PENDING" });
  assert.equal(state.writes.length, 1);
});

test("a season with only a pending match can start at 0; corrupted saved state is not silently reset", async () => {
  const { tracker, state } = setup({ rows: [row(1, "対戦中", "")] });
  assert.equal((await tracker.refresh()).baseline.baselineId, "0");
  state.store.set(storageKey("99901", "36", TODAY), false);
  await assert.rejects(tracker.refresh(), { code: "BASELINE_INVALID" });
  assert.equal(state.writes.length, 1);
});

test("conflicting duplicate IDs below the selected boundary still invalidate a fetched page", async () => {
  const { tracker, state } = setup({ rows: [row(3), row(2), row(2, "負け", -15)], wins: 2, rate: 1530 });
  await assert.rejects(tracker.refresh(), { code: "HISTORY_CONFLICT" });
  assert.equal(state.writes.length, 0);
});

test("the pagination limit is an error and never returns a partial result", async () => {
  const { tracker, state } = setup();
  state.pages = Array.from({ length: 201 }, (_, index) => page({ rows: [row(201 - index)], wins: 201, rate: 4515, pages: [index + 1, index + 2] }));
  await assert.rejects(tracker.refresh({ baselineId: "0" }), { code: "HISTORY_LIMIT" });
  assert.equal(state.requests.filter((url) => url.includes("?page=")).length, 199);
  assert.equal(state.writes.length, 0);
});

test("saved boundary fingerprint, rate and cumulative counts detect edited or deleted history", async () => {
  const { tracker, state } = setup({ rows: [row(10)], wins: 1, rate: 1515 });
  await tracker.refresh();
  state.pages = [page({ rows: [row(10, "勝ち", 14)], wins: 1, rate: 1515 })];
  await assert.rejects(tracker.refresh(), { code: "BASELINE_CHANGED" });
  state.pages = [page({ rows: [row(10)], wins: 1, rate: 1516 })];
  await assert.rejects(tracker.refresh(), { code: "BASELINE_CHANGED" });
  state.pages = [page({ rows: [row(10)], wins: 2, rate: 1515 })];
  await assert.rejects(tracker.refresh(), { code: "BASELINE_CHANGED" });
  state.pages = [page({ rows: [row(11)], wins: 1, rate: 1515 })];
  await assert.rejects(tracker.refresh(), { code: "BASELINE_NOT_FOUND" });
  assert.equal(state.writes.length, 1);
});

test("anonymous or missing history errors never create a baseline", async () => {
  const { tracker, state } = setup({ authenticated: false });
  await assert.rejects(tracker.refresh(), { code: "LOGIN_REQUIRED" });
  state.pages = [page({ wins: 1 })];
  await assert.rejects(tracker.refresh(), { code: "HISTORY_UNAVAILABLE" });
  assert.equal(state.writes.length, 0);
});

test("network errors and unexpected redirects fail explicitly", async () => {
  const { tracker, state } = setup();
  state.fetchHook = async () => { throw new TypeError("Network unavailable"); };
  await assert.rejects(tracker.refresh(), { code: "NETWORK_ERROR" });
  state.fetchHook = async () => { throw Object.assign(new Error("Connection reset"), { code: "ECONNRESET" }); };
  await assert.rejects(tracker.refresh(), { code: "NETWORK_ERROR" });
  state.fetchHook = async () => ({ ok: false, status: 503 });
  await assert.rejects(tracker.refresh(), { code: "NETWORK_ERROR" });
  state.fetchHook = async () => ({ ok: true, url: "https://smashmate.net/login/", text: async () => "" });
  await assert.rejects(tracker.refresh(), { code: "UNEXPECTED_REDIRECT" });
  assert.equal(state.writes.length, 0);
});

test("changed first-page snapshot, season or Japan date prevents saving", async () => {
  const { tracker, state } = setup({ rows: [row(1)], wins: 1, rate: 1515 });
  let profileRequests = 0;
  state.fetchHook = async (url) => {
    if (url === USER && ++profileRequests === 2) return { ok: true, url, text: async () => page({ rows: [row(2), row(1)], wins: 2, rate: 1530 }) };
  };
  await assert.rejects(tracker.refresh(), { code: "SNAPSHOT_CHANGED" });
  state.fetchHook = undefined;
  let seasonRequests = 0;
  state.season = () => ++seasonRequests === 1 ? 36 : 37;
  await assert.rejects(tracker.refresh(), { code: "SEASON_CHANGED" });
  state.season = 36;
  state.fetchHook = async (url) => { if (url === USER) state.now = new Date("2026-09-28T15:00:00Z"); };
  await assert.rejects(tracker.refresh(), { code: "DATE_CHANGED" });
  assert.equal(state.writes.length, 0);
});

test("storage failures reject, and simultaneous refreshes cannot overwrite each other", async () => {
  const { tracker, state, storage } = setup();
  storage.get = async () => { throw new Error("blocked"); };
  await assert.rejects(tracker.refresh(), { code: "STORAGE_READ_FAILED" });
  storage.get = async () => undefined;
  storage.set = async () => { throw new Error("quota"); };
  await assert.rejects(tracker.refresh(), { code: "STORAGE_WRITE_FAILED" });
  let release;
  state.fetchHook = () => new Promise((resolve) => { release = resolve; });
  const running = tracker.refresh();
  await assert.rejects(tracker.refresh(), { code: "BUSY" });
  state.fetchHook = undefined;
  release();
  await assert.rejects(running, { code: "STORAGE_WRITE_FAILED" });
});

test("explicit manual ID and reset repair unreadable saved state after validating fresh history", async () => {
  const { tracker, state, storage } = setup({ rows: [row(3), row(2), row(1)], wins: 3, rate: 1545 });
  let reads = 0;
  storage.get = async () => { reads++; throw new Error("Corrupted JSON"); };
  await assert.rejects(tracker.refresh(), { code: "STORAGE_READ_FAILED" });
  assert.equal(reads, 1);
  assert.equal(state.writes.length, 0);
  await assert.rejects(tracker.refresh({ baselineId: "invalid" }), { code: "INVALID_ID" });
  await assert.rejects(tracker.refresh({ baselineId: "999" }), { code: "BASELINE_NOT_FOUND" });
  assert.equal(reads, 1);
  assert.equal(state.writes.length, 0);
  const manual = await tracker.refresh({ baselineId: "1" });
  assert.equal(manual.stats.wins, 2);
  assert.equal(manual.baseline.baselineId, "1");
  const reset = await tracker.refresh({ reset: true });
  assert.equal(reset.stats.total, 0);
  assert.equal(reset.baseline.baselineId, "3");
  assert.equal(reads, 1);
  assert.equal(state.writes.length, 2);
  state.pages = [page({ authenticated: false })];
  await assert.rejects(tracker.refresh({ reset: true }), { code: "LOGIN_REQUIRED" });
  assert.equal(state.writes.length, 2);
});
