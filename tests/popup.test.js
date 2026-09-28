const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const { setImmediate } = require("node:timers/promises");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "popup.html"), "utf8");
const script = fs.readFileSync(path.join(root, "popup.js"), "utf8");

function result(baselineId = "12346", wins = 0, losses = 0) {
  return {
    data: { userName: "TestPlayer", currentRate: 1594 },
    stats: {
      wins, losses, total: wins + losses,
      winRate: wins + losses ? ((wins / (wins + losses)) * 100).toFixed(1) : "0.0",
      startRate: 1594, endRate: 1594, dailyChange: 0,
      dateKey: "2026-09-28", baselineId,
      todayPoints: [{ x: 0, y: 1594 }, { x: 1, y: 1579 }, { x: 2, y: 1594 }],
    },
    baseline: { baselineId, seasonId: "36", dateKey: "2026-09-28" },
    created: wins + losses === 0,
  };
}

async function setup(responses, url = "https://smashmate.net/user/99901/?page=2") {
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://extension.example/popup.html" });
  const w = dom.window;
  const messages = [];
  const canvasLabels = [];
  const copied = [];
  w.SmashMateTracking = { japanDate: () => "2026-09-28" };
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
    get(_target, key) {
      if (key === "createLinearGradient") return () => ({ addColorStop() {} });
      if (key === "fillText") return (text) => canvasLabels.push(text);
      return () => {};
    },
  });
  Object.defineProperty(w.navigator, "clipboard", { value: { writeText: async (text) => copied.push(text) } });
  w.chrome = {
    runtime: { lastError: null },
    tabs: {
      query(_query, callback) { callback([{ id: 7, url }]); },
      sendMessage(id, request, callback) {
        messages.push({ id, ...request });
        const next = responses.shift();
        if (typeof next === "function") next(callback);
        else callback(next);
      },
      create() { throw new Error("Unexpected external navigation"); },
    },
  };
  w.eval(script);
  await setImmediate();
  const doc = w.document;
  return {
    dom, w, doc, messages, canvasLabels, copied,
    click: (id) => doc.getElementById(id).click(),
    submit(value) {
      doc.getElementById("baseline-id").value = value;
      doc.getElementById("baseline-form").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    },
  };
}

test("initial measurement shows 0–0; update reuses the stored boundary and displays a net-zero interval", async (t) => {
  const ui = await setup([result(), result("12346", 1, 1)]);
  t.after(() => ui.dom.window.close());
  assert.equal(ui.doc.getElementById("today-record").textContent, "0勝 0敗");
  assert.equal(ui.doc.getElementById("baseline-id").value, "12346");
  ui.click("btn-refresh");
  await setImmediate();
  assert.equal(ui.doc.getElementById("today-record").textContent, "1勝 1敗");
  assert.equal(ui.doc.getElementById("content").classList.contains("hidden"), false);
  assert.deepEqual(ui.messages.map((message) => message.action), ["trackStats", "trackStats"]);
  assert.ok(ui.messages.every((message) => !("baselineId" in message) && !("reset" in message)));
  assert.ok(ui.canvasLabels.includes("2026/09/28"));
  assert.ok(ui.canvasLabels.includes("Smashmate Session Results"));
  assert.ok(ui.canvasLabels.includes("計測開始以降 / No.12346 の次から"));
});

test("invalid edits keep the saved basis visible and expose repair controls; reset is explicit", async (t) => {
  const ui = await setup([result("100", 2, 1), { error: "基準の対戦IDが履歴に見つかりませんでした。" }, result("12346")]);
  t.after(() => ui.dom.window.close());
  ui.submit("999999");
  await setImmediate();
  assert.equal(ui.messages[1].baselineId, "999999");
  assert.match(ui.doc.getElementById("tracking-baseline").textContent, /No\.100/);
  assert.equal(ui.doc.getElementById("content").classList.contains("hidden"), true);
  assert.equal(ui.doc.getElementById("tracking-controls").classList.contains("hidden"), false);
  assert.equal(ui.doc.getElementById("btn-reset").disabled, false);
  ui.click("btn-reset");
  await setImmediate();
  assert.equal(ui.messages[2].reset, true);
  assert.equal(ui.doc.getElementById("baseline-id").value, "12346");
});

test("ID changes cannot overlap an in-flight request; season-start edits use 0", async (t) => {
  let finish;
  const ui = await setup([result(), (callback) => { finish = callback; }]);
  t.after(() => ui.dom.window.close());
  ui.submit("0");
  assert.equal(ui.doc.getElementById("btn-baseline").disabled, true);
  assert.equal(ui.doc.getElementById("btn-demo").disabled, true);
  ui.submit("111");
  assert.equal(ui.messages.length, 2);
  finish(result("0", 25, 9));
  await setImmediate();
  assert.equal(ui.doc.getElementById("btn-baseline").disabled, false);
  assert.match(ui.doc.getElementById("tracking-baseline").textContent, /シーズン最初/);
  assert.ok(ui.canvasLabels.includes("計測開始以降 / シーズン最初から"));
});

test("copied text includes snapshot date and the exclusive baseline instead of claiming full-day results", async (t) => {
  const ui = await setup([result("12344", 1, 1)]);
  t.after(() => ui.dom.window.close());
  ui.click("btn-copy-text");
  await setImmediate();
  assert.match(ui.copied[0], /計測開始以降/);
  assert.match(ui.copied[0], /2026-09-28（日本時間） \/ No\.12344の次から/);
  assert.match(ui.copied[0], /1勝 1敗/);
  assert.doesNotMatch(ui.copied[0], /今日の/);
});

test("lookalike URLs do not receive extension requests", async (t) => {
  const ui = await setup([], "https://example.com/smashmate.net/user/99901/");
  t.after(() => ui.dom.window.close());
  assert.equal(ui.messages.length, 0);
  assert.equal(ui.doc.getElementById("error").classList.contains("hidden"), false);
  assert.equal(ui.doc.getElementById("tracking-controls").classList.contains("hidden"), true);
});
