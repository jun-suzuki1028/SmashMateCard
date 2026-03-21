(function () {
  "use strict";

  // 二重実行防止
  if (document.getElementById("smc-overlay")) {
    document.getElementById("smc-overlay").remove();
    return;
  }

  // スマメイトのユーザーページか確認
  if (!location.href.includes("smashmate.net/user/")) {
    alert("smashmate.net のユーザーページで実行してください。");
    return;
  }

  // ========== 定数 ==========

  var MAX_DAILY_MATCHES = 100;

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

  // ========== データ抽出（content.js相当） ==========

  function extractData() {
    var data = {
      currentRate: null,
      maxRate: null,
      dailyChange: null,
      dataPoints: [],
      userName: null,
      error: null,
    };

    try {
      // ユーザー名
      var nameEl = document.querySelector("h2.user-name, .user-name");
      if (nameEl) {
        data.userName = nameEl.textContent.trim();
      }

      var bodyText = document.body.innerText;

      // テーブルからレート情報を抽出
      var tables = document.querySelectorAll("table");
      for (var t = 0; t < tables.length; t++) {
        var rows = tables[t].querySelectorAll("tr");
        for (var r = 0; r < rows.length; r++) {
          var cells = rows[r].querySelectorAll("th, td");
          if (cells.length >= 2) {
            var label = cells[0].textContent.trim();
            var value = cells[1].textContent.trim();

            if (
              label.indexOf("レート") !== -1 &&
              label.indexOf("最高") === -1 &&
              label.indexOf("前日比") === -1
            ) {
              var m = value.match(/(\d+)/);
              if (m) data.currentRate = parseInt(m[1]);
            }
            if (
              label.indexOf("最高レート") !== -1 ||
              label.indexOf("最高") !== -1
            ) {
              var m2 = value.match(/(\d+)/);
              if (m2) data.maxRate = parseInt(m2[1]);
            }
            if (label.indexOf("前日比") !== -1) {
              var m3 = value.match(/([+-]?\d+)/);
              if (m3) data.dailyChange = parseInt(m3[1]);
            }
          }
        }
      }

      // フォールバック
      if (data.currentRate === null) {
        var crm = bodyText.match(/現在レート\s*(\d+)/);
        if (crm) data.currentRate = parseInt(crm[1]);
      }
      if (data.maxRate === null) {
        var mrm = bodyText.match(/最高レート\s*(\d+)/);
        if (mrm) data.maxRate = parseInt(mrm[1]);
      }
      if (data.dailyChange === null) {
        var dm = bodyText.match(/前日比[：:]\s*([+-]?\d+)/);
        if (dm) data.dailyChange = parseInt(dm[1]);
      }

      // dataPoints抽出
      var scripts = document.querySelectorAll("script");
      for (var s = 0; s < scripts.length; s++) {
        var text = scripts[s].textContent;
        var pushPattern =
          /dataPoints\.push\(\{\s*x\s*:\s*(\d+)\s*,\s*y\s*:\s*(\d+)\s*\}\)/g;
        var pm;
        while ((pm = pushPattern.exec(text)) !== null) {
          data.dataPoints.push({ x: parseInt(pm[1]), y: parseInt(pm[2]) });
        }

        if (data.dataPoints.length === 0) {
          var dpMatch = text.match(/dataPoints\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
          if (dpMatch) {
            try {
              var cleaned = dpMatch[1]
                .replace(/(\w+)\s*:/g, '"$1":')
                .replace(/'/g, '"')
                .replace(/,\s*([}\]])/g, "$1");
              data.dataPoints = JSON.parse(cleaned);
            } catch (e) {
              // 無視
            }
          }
        }
      }

      if (data.dailyChange === null) {
        data.error =
          "前日比が取得できませんでした。ログインしていることを確認してください。";
      }
    } catch (e) {
      data.error = "データ抽出中にエラーが発生しました: " + e.message;
    }

    return data;
  }

  // ========== 戦績計算（popup.js相当） ==========

  function calculateTodayStats(data) {
    var currentRate = data.currentRate;
    var dailyChange = data.dailyChange;
    var dataPoints = data.dataPoints;

    if (dailyChange === null || dailyChange === 0) {
      return { error: "今日の対戦データがありません" };
    }

    var startRate = currentRate - dailyChange;
    var searchLimit = Math.max(0, dataPoints.length - MAX_DAILY_MATCHES);
    var todayStartIndex = -1;

    for (var i = dataPoints.length - 1; i >= searchLimit; i--) {
      if (dataPoints[i].y === startRate) {
        todayStartIndex = i;
        while (i - 1 >= searchLimit && dataPoints[i - 1].y === startRate) {
          todayStartIndex = i - 1;
          i--;
        }
        break;
      }
    }

    if (todayStartIndex === -1) {
      var minDiff = Infinity;
      for (var j = dataPoints.length - 1; j >= searchLimit; j--) {
        var diff = Math.abs(dataPoints[j].y - startRate);
        if (diff < minDiff) {
          minDiff = diff;
          todayStartIndex = j;
        }
      }
    }

    var todayPoints = dataPoints.slice(todayStartIndex);
    var wins = 0;
    var losses = 0;

    for (var k = 1; k < todayPoints.length; k++) {
      var d = todayPoints[k].y - todayPoints[k - 1].y;
      if (d > 0) wins++;
      else if (d < 0) losses++;
    }

    var total = wins + losses;
    var winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

    return {
      wins: wins,
      losses: losses,
      total: total,
      winRate: winRate,
      startRate: startRate,
      endRate: currentRate,
      dailyChange: dailyChange,
      todayPoints: todayPoints,
    };
  }

  // ========== カード描画（popup.js相当） ==========

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
    var today = new Date();
    var dateStr =
      today.getFullYear() +
      "/" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "/" +
      String(today.getDate()).padStart(2, "0");

    ctx.fillStyle = theme.textDim;
    ctx.font = "14px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(dateStr, W - 20, 35);

    // タイトル
    ctx.fillStyle = theme.accent;
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Today's Smashmate Results", 20, 40);

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
    ctx.fillText("smashmate.net", W - 20, H - 10);
  }

  // ========== ツイートテキスト ==========

  function buildTweetText(stats) {
    var changeSign = stats.dailyChange > 0 ? "+" : "";
    return [
      "今日のスマメイト戦績",
      stats.wins + "勝 " + stats.losses + "敗 (勝率" + stats.winRate + "%)",
      "レート: " +
        stats.startRate +
        " → " +
        stats.endRate +
        " (" +
        changeSign +
        stats.dailyChange +
        ")",
      "#スマブラSP #スマメイト #SmashMateCard",
    ].join("\n");
  }

  // ========== UI構築 ==========

  function buildOverlay(data, stats) {
    // オーバーレイ
    var overlay = document.createElement("div");
    overlay.id = "smc-overlay";
    overlay.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;z-index:999999;" +
      "background:rgba(0,0,0,0.85);display:flex;align-items:center;" +
      "justify-content:center;font-family:sans-serif;";

    // コンテナ
    var container = document.createElement("div");
    container.style.cssText =
      "background:#1a1a2e;border-radius:12px;padding:16px;max-width:420px;" +
      "width:90%;max-height:90vh;overflow-y:auto;color:#e0e0e0;";

    // ヘッダー（タイトル + 閉じるボタン）
    var header = document.createElement("div");
    header.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;" +
      "margin-bottom:12px;";

    var title = document.createElement("h2");
    title.textContent = "SmashMateCard";
    title.style.cssText = "margin:0;font-size:16px;color:#00d4ff;";

    var closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText =
      "background:none;border:none;color:#888;font-size:20px;cursor:pointer;" +
      "padding:4px 8px;line-height:1;";
    closeBtn.onclick = function () {
      overlay.remove();
    };

    header.appendChild(title);
    header.appendChild(closeBtn);
    container.appendChild(header);

    // テーマセレクター
    var themeRow = document.createElement("div");
    themeRow.style.cssText =
      "display:flex;justify-content:center;gap:10px;margin-bottom:12px;";

    var themeKeys = ["dark", "ocean", "crimson", "light"];
    var themeColors = ["#00d4ff", "#00e5a0", "#ff8c42", "#fff"];
    var themeBtns = [];

    themeKeys.forEach(function (key, idx) {
      var btn = document.createElement("button");
      btn.style.cssText =
        "width:32px;height:32px;border-radius:50%;border:2px solid " +
        (key === currentTheme ? "#fff" : "transparent") +
        ";cursor:pointer;background:" +
        themeColors[idx] +
        ";transition:border-color 0.2s;";
      btn.title = THEMES[key].name;
      btn.onclick = function () {
        currentTheme = key;
        renderCard(canvas, data, stats, THEMES[currentTheme]);
        themeBtns.forEach(function (b, i) {
          b.style.borderColor = themeKeys[i] === key ? "#fff" : "transparent";
        });
      };
      themeBtns.push(btn);
      themeRow.appendChild(btn);
    });

    container.appendChild(themeRow);

    // Canvas
    var canvas = document.createElement("canvas");
    canvas.style.cssText =
      "display:block;width:100%;border-radius:8px;margin-bottom:12px;" +
      "border:1px solid #333;";
    container.appendChild(canvas);

    renderCard(canvas, data, stats, THEMES[currentTheme]);

    // アクションボタン
    var actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";

    function createBtn(text, bg, color, onClick) {
      var btn = document.createElement("button");
      btn.textContent = text;
      btn.style.cssText =
        "flex:1;min-width:120px;padding:12px 8px;border:none;border-radius:6px;" +
        "font-size:13px;font-weight:bold;cursor:pointer;background:" +
        bg +
        ";color:" +
        color +
        ";";
      btn.onclick = onClick;
      return btn;
    }

    // 画像ダウンロード
    actions.appendChild(
      createBtn("画像を保存", "#00d4ff", "#000", function () {
        var d = new Date();
        var dateStr =
          d.getFullYear() +
          "-" +
          String(d.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(d.getDate()).padStart(2, "0");
        var link = document.createElement("a");
        link.download = "smashmate_" + dateStr + ".png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      }),
    );

    // Xに投稿
    actions.appendChild(
      createBtn("Xに投稿", "#1da1f2", "#fff", function () {
        var text = buildTweetText(stats);
        window.open(
          "https://x.com/intent/tweet?text=" + encodeURIComponent(text),
          "_blank",
        );
      }),
    );

    // テキストコピー
    var copyTextBtn = createBtn(
      "テキストをコピー",
      "#555",
      "#fff",
      function () {
        var text = buildTweetText(stats);
        navigator.clipboard
          .writeText(text)
          .then(function () {
            copyTextBtn.textContent = "コピー完了!";
            setTimeout(function () {
              copyTextBtn.textContent = "テキストをコピー";
            }, 2000);
          })
          .catch(function () {
            prompt("コピーしてください:", text);
          });
      },
    );
    actions.appendChild(copyTextBtn);

    container.appendChild(actions);

    // 背景クリックで閉じる
    overlay.onclick = function (e) {
      if (e.target === overlay) overlay.remove();
    };

    overlay.appendChild(container);
    document.body.appendChild(overlay);
  }

  // ========== メイン処理 ==========

  var data = extractData();

  if (data.error) {
    alert("SmashMateCard: " + data.error);
    return;
  }

  if (data.dailyChange === 0) {
    alert("SmashMateCard: 今日の対戦がまだありません（前日比: 0）。");
    return;
  }

  var stats = calculateTodayStats(data);

  if (stats.error) {
    alert("SmashMateCard: " + stats.error);
    return;
  }

  buildOverlay(data, stats);
})();
