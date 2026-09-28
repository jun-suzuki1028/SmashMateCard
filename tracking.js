/* Shared by the extension and the generated bookmarklet. */
var SmashMateTracking = (() => {
  "use strict";

  const ORIGIN = "https://smashmate.net";
  const MAX_PAGES = 200;
  const activeUsers = new Set();

  function failure(code, message) {
    const error = new Error(message);
    error.name = "SmashMateTrackingError";
    error.code = code;
    return error;
  }

  function normalized(value) {
    return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  }

  function japanDate(date = new Date()) {
    const timestamp = new Date(date).getTime();
    if (!Number.isFinite(timestamp)) throw failure("INVALID_DATE", "現在の日付を確認できませんでした。");
    return new Date(timestamp + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  function normalizeId(value) {
    const match = normalized(value).match(/^(?:No\.?\s*)?(\d+)$/i);
    if (!match) throw failure("INVALID_ID", "対戦IDは数字で入力してください。シーズン開始から集計する場合は 0 を入力します。");
    return match[1].replace(/^0+(?=\d)/, "");
  }

  function parseDocument(html) {
    return new DOMParser().parseFromString(html, "text/html");
  }

  function parseSeason(html) {
    const text = normalized(parseDocument(html).body.textContent);
    const matches = [...text.matchAll(/第\s*(\d+)\s*期レーティングバトルのランキングです/g)];
    const seasons = new Set(matches.map((match) => normalizeId(match[1])));
    if (seasons.size !== 1 || seasons.has("0")) {
      throw failure("SEASON_UNKNOWN", "現在のシーズンを確認できませんでした。ランキングページを確認してから再試行してください。");
    }
    return [...seasons][0];
  }

  function profileUrl(value) {
    let url;
    try { url = new URL(value); } catch (_) { /* Report a useful error below. */ }
    if (!url || url.origin !== ORIGIN || !/^\/user\/\d+\/$/.test(url.pathname)) {
      throw failure("INVALID_USER_URL", "スマメイトのユーザーページURLを指定してください。");
    }
    return new URL(`/user/${normalizeId(url.pathname.split("/")[2])}/`, ORIGIN);
  }

  function fingerprint(row) {
    return JSON.stringify([row.id, row.result, row.delta, row.opponentId]);
  }

  function parseUserPage(html, userUrl, page = 1) {
    const url = profileUrl(userUrl);
    const userId = url.pathname.split("/")[2];
    const doc = parseDocument(html);
    const authenticated = [...doc.querySelectorAll("a[href]")].some((link) => {
      try {
        const target = new URL(link.getAttribute("href"), ORIGIN);
        return target.origin === ORIGIN && target.pathname === "/php/logout/";
      } catch (_) { return false; }
    });
    if (!authenticated) throw failure("LOGIN_REQUIRED", "スマメイトにログインしてから再試行してください。対戦履歴の取得にはログインが必要です。");

    const identity = normalized(doc.body.textContent).match(/MATE\s*ID\s*[:：]?\s*(\d+)/i);
    if (!identity || normalizeId(identity[1]) !== userId) {
      throw failure("USER_MISMATCH", "取得したページのユーザーを確認できませんでした。ユーザーページを開き直してください。");
    }
    const headings = [...doc.querySelectorAll("h2")];
    const ratingHeading = headings.find((heading) => normalized(heading.textContent) === "レーティング対戦");
    const ratingSection = ratingHeading && ratingHeading.nextElementSibling;
    const ratingText = normalized(ratingSection && ratingSection.textContent);
    const currentMatch = ratingText.match(/現在レート\s*(\d+)/);
    const maxMatch = ratingText.match(/最高レート\s*(\d+)/);
    const totalMatch = ratingText.match(/対戦成績\s*(\d+)\s*勝\s*(\d+)\s*敗/);
    const userName = normalized(doc.querySelector(".user-name")?.textContent);
    if (!currentMatch || !maxMatch || !totalMatch || !userName) {
      throw failure("PROFILE_INVALID", "現在レート・累計勝敗を取得できませんでした。ページの表示を確認してから再試行してください。");
    }
    const data = {
      userId,
      userName,
      currentRate: Number(currentMatch[1]),
      maxRate: Number(maxMatch[1]),
      totalWins: Number(totalMatch[1]),
      totalLosses: Number(totalMatch[2]),
    };
    if (![data.currentRate, data.maxRate, data.totalWins, data.totalLosses].every(Number.isSafeInteger)) {
      throw failure("PROFILE_INVALID", "レートまたは累計勝敗の形式を確認できませんでした。");
    }
    const historyHeading = headings.find((heading) => normalized(heading.textContent) === "レーティング対戦履歴");
    const historySection = historyHeading && historyHeading.nextElementSibling;
    const elements = historySection?.classList.contains("smash-row")
      ? [...historySection.querySelectorAll(".row-battle")]
      : [];
    if ((!historyHeading || !elements.length) && (data.totalWins || data.totalLosses)) {
      throw failure("HISTORY_UNAVAILABLE", "対戦履歴を取得できませんでした。ログイン状態と履歴ページを確認してください。");
    }

    const rows = elements.map((element) => {
      const children = [...element.children];
      const idLink = children[0]?.querySelector("a[href]");
      let idUrl;
      try { idUrl = new URL(idLink?.getAttribute("href"), ORIGIN); } catch (_) { /* Validated below. */ }
      const idMatch = idUrl?.pathname.match(/^\/rate\/(\d+)\/$/);
      if (!idMatch || idUrl.origin !== ORIGIN || !children[0].classList.contains("row-no") || children.length !== 4) {
        throw failure("HISTORY_INVALID", "対戦履歴の形式が変わったため集計できませんでした。");
      }
      const id = normalizeId(idMatch[1]);
      if (id === "0" || normalizeId(idLink.textContent) !== id) {
        throw failure("HISTORY_INVALID", "対戦履歴のIDが一致しませんでした。");
      }
      const opponents = [...children[1].querySelectorAll("a[href]")].map((link) => {
        try {
          const target = new URL(link.getAttribute("href"), ORIGIN);
          const match = target.pathname.match(/^\/user\/(\d+)\/$/);
          return target.origin === ORIGIN && match ? normalizeId(match[1]) : null;
        } catch (_) { return null; }
      }).filter(Boolean);
      const opponentId = opponents[0] || null;
      const resultText = normalized(children[2].textContent);
      const results = { "勝ち": "win", "負け": "loss", "対戦中止": "cancelled" };
      const pending = ["対戦中", "対戦待ち", "結果待ち", "対戦結果待ち", "未確定"].includes(resultText);
      const result = pending ? "pending" : results[resultText];
      if (!result) throw failure("HISTORY_INVALID", `対戦 No.${id} の勝敗を確認できませんでした。`);
      const deltaText = normalized(children[3].querySelector(".rate_text")?.textContent).replace(/\u2212/g, "-");
      if (!pending && !/^[+-]?\d+$/.test(deltaText)) {
        throw failure("HISTORY_INVALID", `対戦 No.${id} のレート増減を確認できませんでした。`);
      }
      const delta = pending ? null : Number(deltaText);
      if ((!pending && !Number.isSafeInteger(delta)) || (result === "cancelled" && delta !== 0) ||
          (result === "win" && delta < 0) || (result === "loss" && delta > 0)) {
        throw failure("HISTORY_INVALID", `対戦 No.${id} のレート増減が不正です。`);
      }
      return { id, result, delta, opponentId };
    });

    const pageNumbers = new Set();
    for (const link of doc.querySelectorAll("a[href]")) {
      let target;
      try { target = new URL(link.getAttribute("href"), url); } catch (_) { continue; }
      if (target.origin !== ORIGIN || target.pathname !== url.pathname) continue;
      const pageValue = target.searchParams.get("page");
      if (pageValue && /^\d+$/.test(pageValue)) pageNumbers.add(Number(pageValue));
    }
    const nextPage = pageNumbers.has(page + 1) ? page + 1 : null;
    if (!nextPage && [...pageNumbers].some((number) => number > page)) {
      throw failure("PAGINATION_INVALID", "対戦履歴の次ページを特定できませんでした。再試行してください。");
    }
    if (!rows.length && nextPage) throw failure("HISTORY_INVALID", "対戦履歴が途中で空になりました。再試行してください。");
    return { data, rows, nextPage };
  }

  function calculateStats(data, newestFirstRows, dateKey, baselineId) {
    const matches = newestFirstRows.filter((row) => row.result === "win" || row.result === "loss").slice().reverse();
    const wins = matches.filter((row) => row.result === "win").length;
    const losses = matches.length - wins;
    const dailyChange = matches.reduce((sum, row) => sum + row.delta, 0);
    const startRate = data.currentRate - dailyChange;
    const todayPoints = [{ x: 0, y: startRate }];
    const rateHistory = matches.map((row, index) => {
      const from = todayPoints[index].y;
      const to = from + row.delta;
      todayPoints.push({ x: index + 1, y: to });
      return { id: row.id, result: row.result, from, to, diff: row.delta };
    });
    return {
      wins, losses, total: matches.length,
      winRate: matches.length ? ((wins / matches.length) * 100).toFixed(1) : "0.0",
      startRate, endRate: data.currentRate, dailyChange, rateHistory, todayPoints, dateKey, baselineId,
    };
  }

  function storageKey(userId, seasonId, dateKey) {
    return `smc:v2:${userId}:${seasonId}:${dateKey}`;
  }

  function sameTotals(left, right) {
    return ["userId", "currentRate", "totalWins", "totalLosses"].every((key) => left[key] === right[key]);
  }

  function snapshot(page) {
    return JSON.stringify([page.data.userId, page.data.currentRate, page.data.totalWins, page.data.totalLosses, page.rows.map(fingerprint), page.nextPage]);
  }

  function validateBaseline(baseline, userId, seasonId, dateKey) {
    if (!baseline || baseline.version !== 2 || baseline.userId !== userId || baseline.seasonId !== seasonId || baseline.dateKey !== dateKey ||
        typeof baseline.baselineId !== "string" || normalizeId(baseline.baselineId) !== baseline.baselineId ||
        ![baseline.baselineRate, baseline.totalWins, baseline.totalLosses].every((value) => Number.isSafeInteger(value) && value >= 0) ||
        (baseline.baselineId === "0" ? baseline.fingerprint !== null : typeof baseline.fingerprint !== "string")) {
      throw failure("BASELINE_INVALID", "保存した計測基準を確認できませんでした。対戦IDを指定するか、今から計測し直してください。");
    }
  }

  function createTracker({ userUrl, storage, fetchImpl = fetch, now = () => new Date() }) {
    const url = profileUrl(userUrl);
    const userId = url.pathname.split("/")[2];
    if (!storage || typeof storage.get !== "function" || typeof storage.set !== "function") {
      throw failure("STORAGE_UNAVAILABLE", "計測基準を保存する機能を利用できませんでした。");
    }

    async function fetchHtml(target) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetchImpl(target.href, { credentials: "include", cache: "no-store", signal: controller.signal });
        if (!response.ok) throw failure("NETWORK_ERROR", `ページを取得できませんでした（HTTP ${response.status}）。再試行してください。`);
        let actual;
        try { actual = new URL(response.url); } catch (_) { /* Validated below. */ }
        if (!actual || actual.origin !== ORIGIN || actual.pathname !== target.pathname || actual.searchParams.get("page") !== target.searchParams.get("page")) {
          throw failure("UNEXPECTED_REDIRECT", "別のページに移動したため集計を中止しました。ログイン状態を確認してください。");
        }
        return await response.text();
      } catch (error) {
        if (error.name === "SmashMateTrackingError") throw error;
        if (controller.signal.aborted) throw failure("NETWORK_TIMEOUT", "ページの取得がタイムアウトしました。再試行してください。");
        throw failure("NETWORK_ERROR", "ページを取得できませんでした。通信状態とログイン状態を確認してください。");
      } finally { clearTimeout(timer); }
    }

    async function fetchPage(page) {
      const target = new URL(url);
      if (page !== 1) target.searchParams.set("page", String(page));
      return parseUserPage(await fetchHtml(target), url.href, page);
    }

    async function run(options) {
      const dateKey = japanDate(now());
      const hasManualId = Object.prototype.hasOwnProperty.call(options, "baselineId");
      const requestedId = hasManualId ? normalizeId(options.baselineId) : null;
      if (hasManualId && options.reset) throw failure("INVALID_OPTIONS", "対戦IDの変更と計測のリセットは同時に指定できません。");
      const seasonId = parseSeason(await fetchHtml(new URL("/ranking/", ORIGIN)));
      const first = await fetchPage(1);
      const key = storageKey(userId, seasonId, dateKey);
      let saved;
      if (!hasManualId && !options.reset) {
        try { saved = await storage.get(key); } catch (_) {
          throw failure("STORAGE_READ_FAILED", "保存した計測基準を読み込めませんでした。IDを指定するか、現在から計測し直してください。");
        }
      }
      const created = Boolean(options.reset || (!hasManualId && (saved === undefined || saved === null)));
      const reuse = !created && !hasManualId;
      if (reuse) validateBaseline(saved, userId, seasonId, dateKey);
      let baselineId = created ? null : hasManualId ? requestedId : saved.baselineId;
      const selected = [];
      const seen = new Map();
      const pageSignatures = new Set();
      let boundary = null;
      let page = first;
      let pageNumber = 1;
      let found = false;

      while (true) {
        if (!sameTotals(first.data, page.data)) throw failure("SNAPSHOT_CHANGED", "取得中に戦績が更新されました。もう一度集計してください。");
        const signature = JSON.stringify(page.rows.map(fingerprint));
        if (pageSignatures.has(signature)) throw failure("PAGINATION_LOOP", "同じ履歴ページが繰り返されたため集計を中止しました。");
        pageSignatures.add(signature);
        const uniqueRows = [];
        for (const row of page.rows) {
          const previous = seen.get(row.id);
          if (previous) {
            if (fingerprint(previous) !== fingerprint(row)) throw failure("HISTORY_CONFLICT", "同じ対戦IDに異なる結果がありました。再試行してください。");
            continue;
          }
          seen.set(row.id, row);
          uniqueRows.push(row);
        }
        for (const row of uniqueRows) {
          if (created && row.result !== "pending") baselineId = row.id;
          if (row.id === baselineId) {
            if (row.result === "pending") throw failure("BASELINE_PENDING", "未確定の対戦は基準にできません。終了済みの対戦IDを指定してください。");
            boundary = row;
            found = true;
            break;
          }
          selected.push(row);
        }
        if (found) break;
        if (!page.nextPage) {
          if (created && !first.data.totalWins && !first.data.totalLosses) baselineId = "0";
          if (baselineId === "0") { found = true; break; }
          throw failure("BASELINE_NOT_FOUND", "基準の対戦IDが履歴に見つかりませんでした。現在のシーズンのIDを指定するか、今から計測し直してください。");
        }
        if (pageNumber >= MAX_PAGES) throw failure("HISTORY_LIMIT", "履歴が200ページを超えました。より新しい対戦IDを基準に指定してください。");
        pageNumber = page.nextPage;
        page = await fetchPage(pageNumber);
      }

      const stats = calculateStats(first.data, selected, dateKey, baselineId);
      const baseline = {
        version: 2, userId, seasonId, dateKey, baselineId,
        fingerprint: boundary ? fingerprint(boundary) : null,
        baselineRate: stats.startRate,
        totalWins: first.data.totalWins - stats.wins,
        totalLosses: first.data.totalLosses - stats.losses,
      };
      if (baseline.totalWins < 0 || baseline.totalLosses < 0 || baseline.baselineRate < 0 ||
          (baselineId === "0" && (baseline.totalWins || baseline.totalLosses))) {
        throw failure("HISTORY_INCONSISTENT", "対戦履歴と累計勝敗が一致しませんでした。再試行してください。");
      }
      if (reuse && ["fingerprint", "baselineRate", "totalWins", "totalLosses"].some((field) => saved[field] !== baseline[field])) {
        throw failure("BASELINE_CHANGED", "保存後に対戦履歴または累計戦績が変わりました。基準IDを確認し、再設定してください。");
      }
      const verified = await fetchPage(1);
      if (snapshot(first) !== snapshot(verified)) throw failure("SNAPSHOT_CHANGED", "取得中に戦績が更新されました。もう一度集計してください。");
      const verifiedSeason = parseSeason(await fetchHtml(new URL("/ranking/", ORIGIN)));
      if (seasonId !== verifiedSeason) throw failure("SEASON_CHANGED", "取得中にシーズンが切り替わりました。もう一度集計してください。");
      if (dateKey !== japanDate(now())) throw failure("DATE_CHANGED", "取得中に日付が変わりました。もう一度集計してください。");
      if (created || hasManualId) {
        try { await storage.set(key, baseline); } catch (_) { throw failure("STORAGE_WRITE_FAILED", "計測基準を保存できませんでした。保存設定を確認してから再試行してください。"); }
      }
      return { data: first.data, stats, baseline: reuse ? saved : baseline, created };
    }

    return {
      async refresh(options = {}) {
        if (activeUsers.has(userId)) throw failure("BUSY", "集計中です。完了してから再試行してください。");
        activeUsers.add(userId);
        try {
          if (typeof navigator !== "undefined" && navigator.locks?.request) {
            return await navigator.locks.request(`smc-tracking:${userId}`, { ifAvailable: true }, async (lock) => {
              if (!lock) throw failure("BUSY", "別の画面で集計中です。完了してから再試行してください。");
              return run(options);
            });
          }
          return await run(options);
        } finally { activeUsers.delete(userId); }
      },
    };
  }

  return { createTracker, japanDate, normalizeId, parseUserPage, parseSeason, calculateStats, storageKey };
})();

if (typeof module !== "undefined" && module.exports) module.exports = SmashMateTracking;
