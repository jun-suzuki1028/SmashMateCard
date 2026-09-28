(function () {
  "use strict";

  // Mount synchronously so another invocation cannot start a second request.
  var existing = document.getElementById("smc-overlay");
  if (existing) {
    var existingClose = existing.querySelector("[data-smc-close]");
    if (existingClose) existingClose.focus();
    return;
  }

  var THEMES = {
    dark: {
      name: "Dark",
      bg: ["#0f0c29", "#302b63", "#24243e"],
      accent: "#00d4ff",
      win: "#4CAF50",
      lose: "#f44336",
      text: "#fff",
      textSub: "#ccc",
      textMuted: "#aaa",
      textDim: "#888",
      textFaint: "#666",
      footer: "#555",
    },
    ocean: {
      name: "Ocean",
      bg: ["#0a1628", "#1a3a5c", "#0f2744"],
      accent: "#00e5a0",
      win: "#4CAF50",
      lose: "#f44336",
      text: "#fff",
      textSub: "#ccc",
      textMuted: "#aaa",
      textDim: "#888",
      textFaint: "#666",
      footer: "#555",
    },
    crimson: {
      name: "Crimson",
      bg: ["#1a0a0a", "#3d1c1c", "#2a1212"],
      accent: "#ff8c42",
      win: "#4CAF50",
      lose: "#f44336",
      text: "#fff",
      textSub: "#ccc",
      textMuted: "#aaa",
      textDim: "#888",
      textFaint: "#666",
      footer: "#555",
    },
    light: {
      name: "Light",
      bg: ["#f5f5f5", "#e8e8ec", "#f0f0f4"],
      accent: "#3b82f6",
      win: "#16a34a",
      lose: "#dc2626",
      text: "#1a1a1a",
      textSub: "#333",
      textMuted: "#555",
      textDim: "#777",
      textFaint: "#999",
      footer: "#aaa",
    },
  };

  var currentTheme = "dark";

  // ========== ユーティリティ ==========

  function hexToRgba(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
  }

  function renderCard(canvas, data, stats, theme) {
    var ctx = canvas.getContext("2d");
    var W = 600;
    var H = 400;
    canvas.width = W;
    canvas.height = H;

    // 背景
    var bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, theme.bg[0]);
    bgGrad.addColorStop(0.5, theme.bg[1]);
    bgGrad.addColorStop(1, theme.bg[2]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 装飾ライン
    ctx.strokeStyle = hexToRgba(theme.accent, 0.3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 60);
    ctx.lineTo(W, 60);
    ctx.stroke();

    // 日付
    var dateStr = stats.dateKey.replace(/-/g, "/");

    ctx.fillStyle = theme.textDim;
    ctx.font = "14px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(dateStr, W - 20, 35);

    // タイトル
    ctx.fillStyle = theme.accent;
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Smashmate Session Results", 20, 40);

    // ユーザー名
    if (data.userName) {
      ctx.fillStyle = theme.textSub;
      ctx.font = "14px sans-serif";
      ctx.fillText(data.userName, 20, 90);
    }

    // 勝敗数
    var recordY = 140;
    ctx.textAlign = "center";

    ctx.fillStyle = theme.win;
    ctx.font = "bold 56px sans-serif";
    ctx.fillText(String(stats.wins), W / 2 - 80, recordY);
    ctx.fillStyle = theme.textMuted;
    ctx.font = "20px sans-serif";
    ctx.fillText("WIN", W / 2 - 80, recordY + 28);

    ctx.fillStyle = theme.textFaint;
    ctx.font = "bold 40px sans-serif";
    ctx.fillText("-", W / 2, recordY - 8);

    ctx.fillStyle = theme.lose;
    ctx.font = "bold 56px sans-serif";
    ctx.fillText(String(stats.losses), W / 2 + 80, recordY);
    ctx.fillStyle = theme.textMuted;
    ctx.font = "20px sans-serif";
    ctx.fillText("LOSE", W / 2 + 80, recordY + 28);

    // 勝率
    ctx.fillStyle = theme.text;
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("勝率 " + stats.winRate + "%", W / 2, recordY + 60);

    // レート変動
    var rateY = 250;
    ctx.textAlign = "center";
    ctx.fillStyle = theme.textSub;
    ctx.font = "16px sans-serif";
    ctx.fillText("Rating", W / 2, rateY);

    var changeColor =
      stats.dailyChange > 0
        ? theme.win
        : stats.dailyChange < 0
          ? theme.lose
          : theme.textDim;
    var changeSign = stats.dailyChange > 0 ? "+" : "";

    ctx.font = "bold 28px sans-serif";
    ctx.fillStyle = theme.text;
    ctx.fillText(stats.startRate + "  →  " + stats.endRate, W / 2, rateY + 35);

    ctx.fillStyle = changeColor;
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("(" + changeSign + stats.dailyChange + ")", W / 2, rateY + 65);

    // ミニグラフ
    if (stats.todayPoints && stats.todayPoints.length > 1) {
      var graphX = 40;
      var graphY = 320;
      var graphW = W - 80;
      var graphH = 60;

      var rates = stats.todayPoints.map(function (p) {
        return p.y;
      });
      var minRate = Math.min.apply(null, rates);
      var maxRate = Math.max.apply(null, rates);
      var range = maxRate - minRate || 1;

      ctx.strokeStyle = hexToRgba(theme.accent, 0.6);
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (var i = 0; i < rates.length; i++) {
        var x = graphX + (i / (rates.length - 1)) * graphW;
        var y = graphY + graphH - ((rates[i] - minRate) / range) * graphH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.lineTo(graphX + graphW, graphY + graphH);
      ctx.lineTo(graphX, graphY + graphH);
      ctx.closePath();

      var graphGrad = ctx.createLinearGradient(0, graphY, 0, graphY + graphH);
      graphGrad.addColorStop(0, hexToRgba(theme.accent, 0.2));
      graphGrad.addColorStop(1, hexToRgba(theme.accent, 0));
      ctx.fillStyle = graphGrad;
      ctx.fill();

      ctx.fillStyle = theme.textFaint;
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(String(maxRate), graphX, graphY - 4);
      ctx.fillText(String(minRate), graphX, graphY + graphH + 14);
    }

    // フッター
    ctx.fillStyle = theme.footer;
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("計測開始以降 / " + (stats.baselineId === "0" ? "シーズン最初から" : "No." + stats.baselineId + " の次から"), W - 20, H - 10);
  }


  function basisText(id) {
    return id === "0" ? "シーズン最初から" : "No." + id + " の次から集計";
  }

  function buildTweetText(stats) {
    var changeSign = stats.dailyChange > 0 ? "+" : "";
    return [
      "スマメイト戦績（計測開始以降）",
      stats.dateKey + "（日本時間） / " + basisText(stats.baselineId),
      stats.wins + "勝 " + stats.losses + "敗 (勝率" + stats.winRate + "%)",
      "レート: " + stats.startRate + " → " + stats.endRate +
        " (" + changeSign + stats.dailyChange + ")",
      "#スマブラSP #スマメイト #SmashMateCard",
    ].join("\n");
  }

  var closed = false;
  var busy = false;
  var result = null;
  var tracker = null;
  var previousFocus = document.activeElement;
  var overlay = document.createElement("div");
  overlay.id = "smc-overlay";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.85);" +
    "display:flex;align-items:center;justify-content:center;font-family:sans-serif;";
  var container = document.createElement("div");
  container.setAttribute("role", "dialog");
  container.setAttribute("aria-modal", "true");
  container.setAttribute("aria-labelledby", "smc-title");
  container.style.cssText =
    "box-sizing:border-box;background:#1a1a2e;border-radius:12px;padding:16px;" +
    "max-width:480px;width:94%;max-height:94vh;overflow-y:auto;color:#e0e0e0;";
  var header = document.createElement("div");
  header.style.cssText =
    "display:flex;justify-content:space-between;align-items:center;gap:12px;";
  var title = document.createElement("h2");
  title.id = "smc-title";
  title.textContent = "SmashMateCard";
  title.style.cssText = "margin:0;font-size:18px;color:#00d4ff;";
  var closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "✕";
  closeButton.setAttribute("aria-label", "閉じる");
  closeButton.setAttribute("data-smc-close", "");
  closeButton.style.cssText =
    "padding:8px 12px;border:0;background:transparent;color:#ddd;font-size:20px;cursor:pointer;";
  header.append(title, closeButton);
  container.appendChild(header);

  var subtitle = document.createElement("p");
  subtitle.textContent = "計測開始以降の戦績";
  subtitle.style.cssText = "margin:8px 0;font-weight:bold;";
  var scope = document.createElement("p");
  scope.id = "smc-scope";
  scope.style.cssText = "margin:8px 0;font-size:13px;line-height:1.5;";
  scope.textContent = "シーズンと基準IDを確認しています。";
  var basis = document.createElement("p");
  basis.id = "smc-basis";
  basis.style.cssText = "margin:8px 0;font-size:14px;";
  var help = document.createElement("p");
  help.id = "smc-help";
  help.style.cssText = "font-size:12px;line-height:1.6;color:#bbb;";
  help.textContent =
    "日本時間でその日初めて開くと、最新の終了済み対戦を基準に0勝0敗から計測します。" +
    "指定したIDの対戦は含みません。対戦後に開いた場合はIDを変更してください。" +
    "0を指定するとシーズン最初から集計し、前日以前の対戦も含みます。";
  container.append(subtitle, scope, basis, help);

  var controls = document.createElement("form");
  controls.style.cssText = "margin:12px 0;";
  var label = document.createElement("label");
  label.htmlFor = "smc-baseline-id";
  label.textContent = "基準の対戦ID";
  label.style.cssText = "display:block;margin-bottom:6px;font-size:13px;";
  var input = document.createElement("input");
  input.id = "smc-baseline-id";
  input.type = "text";
  input.inputMode = "numeric";
  input.pattern = "[0-9]+";
  input.autocomplete = "off";
  input.setAttribute("aria-describedby", "smc-help");
  input.placeholder = "例: 012345";
  input.style.cssText =
    "box-sizing:border-box;width:100%;padding:10px;border:1px solid #777;" +
    "border-radius:6px;font-size:16px;background:#fff;color:#111;";
  controls.append(label, input);
  var controlRow = document.createElement("div");
  controlRow.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;";
  var controlButtons = [];
  var actionButtons = [];
  var themeButtons = [];

  function makeButton(text, background, color, onClick) {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.style.cssText =
      "flex:1;min-width:110px;padding:11px 8px;border:0;border-radius:6px;" +
      "font-size:13px;font-weight:bold;cursor:pointer;background:" + background +
      ";color:" + color + ";";
    if (onClick) button.addEventListener("click", onClick);
    return button;
  }

  var changeButton = makeButton("IDを変更", "#00d4ff", "#000");
  changeButton.type = "submit";
  var refreshButton = makeButton("更新", "#444", "#fff", function () {
    refresh();
  });
  var resetButton = makeButton("現在から計測し直す", "#444", "#fff", function () {
    refresh({ reset: true });
  });
  resetButton.style.minWidth = "170px";
  controlButtons.push(changeButton, refreshButton, resetButton);
  controlRow.append(changeButton, refreshButton, resetButton);
  controls.appendChild(controlRow);
  container.appendChild(controls);
  controls.addEventListener("submit", function (event) {
    event.preventDefault();
    refresh({ baselineId: input.value.trim() });
  });

  var status = document.createElement("p");
  status.id = "smc-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.style.cssText = "font-size:13px;line-height:1.5;color:#bbb;";
  var error = document.createElement("p");
  error.id = "smc-error";
  error.setAttribute("role", "alert");
  error.style.cssText = "font-size:13px;line-height:1.6;color:#ffb8b8;white-space:pre-wrap;";
  container.append(status, error);

  var results = document.createElement("div");
  results.id = "smc-results";
  results.hidden = true;
  var themeRow = document.createElement("div");
  themeRow.style.cssText =
    "display:flex;justify-content:center;gap:10px;margin:12px 0;";
  var themeKeys = ["dark", "ocean", "crimson", "light"];
  var themeColors = ["#00d4ff", "#00e5a0", "#ff8c42", "#fff"];
  themeKeys.forEach(function (key, index) {
    var button = document.createElement("button");
    button.type = "button";
    button.title = THEMES[key].name;
    button.setAttribute("aria-label", THEMES[key].name + " テーマ");
    button.setAttribute("aria-pressed", String(key === currentTheme));
    button.style.cssText =
      "width:32px;height:32px;border-radius:50%;border:2px solid " +
      (key === currentTheme ? "#fff" : "transparent") +
      ";cursor:pointer;background:" + themeColors[index] + ";";
    button.addEventListener("click", function () {
      if (!result || busy || closed) return;
      currentTheme = key;
      renderCard(canvas, result.data, result.stats, THEMES[currentTheme]);
      themeButtons.forEach(function (item, i) {
        var selected = themeKeys[i] === key;
        item.style.borderColor = selected ? "#fff" : "transparent";
        item.setAttribute("aria-pressed", String(selected));
      });
    });
    themeButtons.push(button);
    themeRow.appendChild(button);
  });
  var canvas = document.createElement("canvas");
  canvas.style.cssText =
    "display:block;width:100%;border-radius:8px;margin-bottom:12px;border:1px solid #333;";
  canvas.setAttribute("role", "img");
  var actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
  var saveButton = makeButton("画像を保存", "#00d4ff", "#000", function () {
    if (!result || busy || closed) return;
    try {
      var link = document.createElement("a");
      link.download = "smashmate_" + result.stats.dateKey + ".png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (cause) {
      error.textContent = "画像を保存できませんでした: " + cause.message;
    }
  });
  var shareButton = makeButton("Xに投稿", "#1da1f2", "#fff", function () {
    if (!result || busy || closed) return;
    window.open("https://x.com/intent/tweet?text=" +
      encodeURIComponent(buildTweetText(result.stats)), "_blank", "noopener,noreferrer");
  });
  var copyButton = makeButton("テキストをコピー", "#555", "#fff", async function () {
    if (!result || busy || closed) return;
    var text = buildTweetText(result.stats);
    setBusy(true);
    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(text);
      if (!closed) status.textContent = "テキストをコピーしました。";
    } catch (cause) {
      if (!closed) window.prompt("コピーしてください:", text);
    } finally {
      if (!closed) setBusy(false);
    }
  });
  actionButtons.push(saveButton, shareButton, copyButton);
  actions.append(saveButton, shareButton, copyButton);
  results.append(themeRow, canvas, actions);
  container.appendChild(results);
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  function close() {
    if (closed) return;
    closed = true;
    overlay.remove();
    document.removeEventListener("keydown", onKeydown, true);
    if (previousFocus && previousFocus.isConnected && previousFocus.focus) {
      previousFocus.focus();
    }
  }

  function onKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      var focusable = Array.from(container.querySelectorAll("button, input"))
        .filter(function (element) {
          return !element.disabled && !element.closest("[hidden]");
        });
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  closeButton.addEventListener("click", close);
  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", onKeydown, true);
  closeButton.focus();

  function setBusy(value) {
    busy = value;
    container.setAttribute("aria-busy", String(value));
    input.disabled = value || !tracker;
    controlButtons.forEach(function (button) { button.disabled = value || !tracker; });
    actionButtons.concat(themeButtons).forEach(function (button) {
      button.disabled = value || !result;
    });
  }

  async function refresh(options) {
    if (busy || closed || !tracker) return;
    result = null;
    results.hidden = true;
    error.textContent = "";
    status.textContent = "対戦履歴を取得しています…";
    setBusy(true);
    try {
      var next = await tracker.refresh(options || {});
      if (closed) return;
      renderCard(canvas, next.data, next.stats, THEMES[currentTheme]);
      result = next;
      scope.textContent = "第" + next.baseline.seasonId + "期 / " +
        next.stats.dateKey + "（日本時間）";
      basis.textContent = basisText(next.stats.baselineId);
      input.value = next.stats.baselineId;
      canvas.setAttribute("aria-label", "計測開始以降 " + next.stats.wins + "勝 " +
        next.stats.losses + "敗、勝率" + next.stats.winRate + "%、レート" +
        next.stats.startRate + "から" + next.stats.endRate);
      results.hidden = false;
      status.textContent = next.created
        ? "最新の終了済み対戦を基準に保存しました。ここから計測します。"
        : "保存した基準からの戦績を更新しました。";
    } catch (cause) {
      if (closed) return;
      scope.textContent = "取得できませんでした。基準IDの変更または更新で再試行できます。";
      basis.textContent = "";
      status.textContent = "";
      error.textContent = cause && cause.message ? cause.message : String(cause);
    } finally {
      if (!closed) setBusy(false);
    }
  }

  try {
    var pageUrl = new URL(location.href);
    if (pageUrl.origin !== "https://smashmate.net" ||
        !/^\/user\/\d+\/?$/.test(pageUrl.pathname)) {
      throw new Error("https://smashmate.net/user/数字/ のユーザーページで実行してください。");
    }
    tracker = SmashMateTracking.createTracker({
      userUrl: pageUrl.href,
      storage: {
        get: async function (key) {
          if (!key.startsWith("smc:v2:")) throw new Error("保存キーが不正です。");
          try {
            var value = localStorage.getItem(key);
            return value === null ? undefined : JSON.parse(value);
          } catch (cause) {
            throw new Error("計測基準を読み込めませんでした。ブラウザの保存設定と保存データを確認してください。");
          }
        },
        set: async function (key, value) {
          if (!key.startsWith("smc:v2:")) throw new Error("保存キーが不正です。");
          try {
            localStorage.setItem(key, JSON.stringify(value));
          } catch (cause) {
            throw new Error("計測基準を保存できませんでした。ブラウザの保存設定と空き容量を確認してください。");
          }
        },
      },
    });
    refresh();
  } catch (cause) {
    scope.textContent = "";
    error.textContent = cause && cause.message ? cause.message : String(cause);
    setBusy(false);
  }
})();
