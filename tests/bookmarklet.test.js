"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { JSDOM } = require("jsdom");

const source = fs.readFileSync(path.join(__dirname, "../bookmarklet/source.js"), "utf8");
const settle = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function sample(overrides = {}) {
  return {
    data: { userId: "99901", userName: "Test user", currentRate: 1500, maxRate: 1550 },
    stats: {
      wins: 1, losses: 1, total: 2, winRate: "50.0", startRate: 1500,
      endRate: 1500, dailyChange: 0,
      todayPoints: [{ x: 0, y: 1500 }, { x: 1, y: 1515 }, { x: 2, y: 1500 }],
      dateKey: "2026-09-28", baselineId: "12345", ...overrides,
    },
    baseline: { userId: "99901", seasonId: "30", dateKey: "2026-09-28", baselineId: "12345" },
    created: false,
  };
}

function mount(responses, url = "https://smashmate.net/user/99901/") {
  const dom = new JSDOM("<!doctype html><button id='prior'>Profile</button>", {
    url, runScripts: "dangerously",
  });
  const { window } = dom;
  const calls = [];
  const rendered = [];
  const opened = [];
  const downloaded = [];
  let config;
  let creations = 0;
  const context = new Proxy({
    fillText: (text) => rendered.push(text),
    createLinearGradient: () => ({ addColorStop() {} }),
  }, { get: (target, key) => target[key] || (() => {}) });
  window.HTMLCanvasElement.prototype.getContext = () => context;
  window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,AA==";
  window.HTMLAnchorElement.prototype.click = function () { downloaded.push(this.download); };
  window.open = (...args) => opened.push(args);
  window.SmashMateTracking = {
    createTracker(options) {
      config = options;
      creations++;
      return {
        refresh(options) {
          calls.push(options);
          const next = responses.shift();
          return typeof next === "function" ? next(options) : Promise.resolve(next);
        },
      };
    },
  };
  window.document.getElementById("prior").focus();
  window.eval(source);
  return {
    dom, window, calls, rendered, opened, downloaded,
    config: () => config, creations: () => creations,
    find: (selector) => window.document.querySelector(selector),
    button: (text) => [...window.document.querySelectorAll("button")].find((b) => b.textContent === text),
  };
}

test("zero rate change still renders both matches and exports the tracked date/basis", async (t) => {
  const ui = mount([sample()]);
  t.after(() => ui.dom.window.close());
  await settle();
  assert.equal(ui.find("#smc-results").hidden, false);
  assert.match(ui.find("#smc-scope").textContent, /第30期 \/ 2026-09-28（日本時間）/);
  assert.match(ui.find("#smc-basis").textContent, /No\.12345 の次から集計/);
  assert.match(ui.find("canvas").getAttribute("aria-label"), /1勝 1敗/);
  assert.ok(ui.rendered.includes("2026/09/28"));
  assert.ok(ui.rendered.includes("Smashmate Session Results"));
  ui.button("画像を保存").click();
  assert.deepEqual(ui.downloaded, ["smashmate_2026-09-28.png"]);
  ui.button("Xに投稿").click();
  const text = new URL(ui.opened[0][0]).searchParams.get("text");
  assert.match(text, /スマメイト戦績（計測開始以降）/);
  assert.match(text, /2026-09-28（日本時間） \/ No\.12345 の次から集計/);
  assert.doesNotMatch(text, /今日の/);
});

test("invalid manual ID hides stale cards but leaves repair controls usable", async (t) => {
  const ui = mount([sample(), () => Promise.reject(new Error("基準IDが見つかりません")), sample({ baselineId: "0" })]);
  t.after(() => ui.dom.window.close());
  await settle();
  ui.find("#smc-baseline-id").value = "999999";
  ui.find("form").dispatchEvent(new ui.window.Event("submit", { cancelable: true }));
  await settle();
  assert.equal(ui.calls[1].baselineId, "999999");
  assert.equal(ui.find("#smc-results").hidden, true);
  assert.match(ui.find("#smc-error").textContent, /基準IDが見つかりません/);
  assert.equal(ui.button("IDを変更").disabled, false);
  assert.equal(ui.button("更新").disabled, false);
  assert.equal(ui.button("現在から計測し直す").disabled, false);
  ui.find("#smc-baseline-id").value = "0";
  ui.find("form").dispatchEvent(new ui.window.Event("submit", { cancelable: true }));
  await settle();
  assert.equal(ui.calls[2].baselineId, "0");
  assert.equal(ui.find("#smc-basis").textContent, "シーズン最初から");
  assert.equal(ui.find("#smc-results").hidden, false);
});

test("immediate modal prevents duplicate invocation; closing suppresses late rendering", async (t) => {
  const pending = deferred();
  const ui = mount([() => pending.promise]);
  t.after(() => ui.dom.window.close());
  assert.ok(ui.find("#smc-overlay"));
  assert.equal(ui.button("更新").disabled, true);
  assert.equal(ui.find("#smc-baseline-id").disabled, true);
  ui.window.eval(source);
  assert.equal(ui.creations(), 1);
  assert.equal(ui.calls.length, 1);
  ui.find("[data-smc-close]").click();
  assert.equal(ui.find("#smc-overlay"), null);
  assert.equal(ui.window.document.activeElement.id, "prior");
  pending.resolve(sample());
  await settle();
  assert.equal(ui.find("#smc-overlay"), null);
  assert.deepEqual(ui.rendered, []);
});

test("reset explicitly selects latest; refresh keeps the stored baseline", async (t) => {
  const pending = deferred();
  const ui = mount([sample(), () => pending.promise, sample()]);
  t.after(() => ui.dom.window.close());
  await settle();
  ui.button("現在から計測し直す").click();
  assert.equal(ui.calls[1].reset, true);
  assert.equal(ui.button("現在から計測し直す").disabled, true);
  assert.equal(ui.button("Xに投稿").disabled, true);
  pending.resolve(sample());
  await settle();
  ui.button("更新").click();
  await settle();
  assert.deepEqual(Object.keys(ui.calls[2]), []);
});

test("storage corruption is reported and does not erase or silently replace data", async (t) => {
  const ui = mount([sample()]);
  t.after(() => ui.dom.window.close());
  await settle();
  const storage = ui.config().storage;
  const key = "smc:v2:99901:30:2026-09-28";
  assert.equal(await storage.get(key), undefined);
  await storage.set(key, { baselineId: "12345" });
  assert.equal((await storage.get(key)).baselineId, "12345");
  ui.window.localStorage.setItem(key, "broken JSON");
  await assert.rejects(storage.get(key), /計測基準を読み込めませんでした/);
  assert.equal(ui.window.localStorage.getItem(key), "broken JSON");
  await assert.rejects(storage.set("other:key", {}), /保存キーが不正/);
});

test("strict user URL validation reports an accessible inline error without requests", async (t) => {
  const ui = mount([], "https://example.com/?target=smashmate.net/user/99901/");
  t.after(() => ui.dom.window.close());
  assert.equal(ui.creations(), 0);
  assert.match(ui.find('[role="alert"]').textContent, /ユーザーページで実行してください/);
  assert.equal(ui.find("#smc-results").hidden, true);
  assert.equal(ui.find("[data-smc-close]").disabled, false);
});

test("clipboard work disables async controls and copies the explicit session scope", async (t) => {
  const ui = mount([sample()]);
  t.after(() => ui.dom.window.close());
  await settle();
  const pending = deferred();
  let copied;
  Object.defineProperty(ui.window.navigator, "clipboard", {
    value: { writeText(text) { copied = text; return pending.promise; } },
  });
  ui.button("テキストをコピー").click();
  assert.equal(ui.button("更新").disabled, true);
  assert.equal(ui.button("テキストをコピー").disabled, true);
  assert.match(copied, /2026-09-28（日本時間） \/ No\.12345/);
  pending.resolve();
  await settle();
  assert.equal(ui.button("更新").disabled, false);
  assert.match(ui.find("#smc-status").textContent, /コピーしました/);
});

test("generated bookmarklet keeps the shared tracker out of the host page global scope", (t) => {
  const dom = new JSDOM("<!doctype html><body></body>", {
    url: "https://example.com/", runScripts: "dangerously",
  });
  t.after(() => dom.window.close());
  const bundle = fs.readFileSync(path.join(__dirname, "../bookmarklet/smashmate-card.js"), "utf8");
  dom.window.eval(bundle);
  assert.equal(dom.window.SmashMateTracking, undefined);
  assert.ok(dom.window.document.getElementById("smc-overlay"));
  assert.match(dom.window.document.getElementById("smc-error").textContent, /ユーザーページ/);
});
