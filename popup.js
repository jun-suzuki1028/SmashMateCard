// IIFE でグローバルスコープ汚染を防止
(function () {
  "use strict";

  // 1日の最大試合数（検索範囲制限用）
  const MAX_DAILY_MATCHES = 100;

  // テーマ定義
  const THEMES = {
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

  let currentTheme = "dark";

  // hex色をrgba文字列に変換
  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // 戦績計算ロジック
  function calculateTodayStats(data) {
    const { currentRate, dailyChange, dataPoints } = data;

    if (dailyChange === null) {
      return { error: "今日の対戦データがありません" };
    }

    const startRate = currentRate - dailyChange;

    // 末尾から最大100試合分を遡り、startRateと一致する最初の地点を採用
    // 検索範囲を制限することで、過去の同一レートを誤って拾うことを防ぐ
    const searchLimit = Math.max(0, dataPoints.length - MAX_DAILY_MATCHES);
    let todayStartIndex = -1;
    for (let i = dataPoints.length - 1; i >= searchLimit; i--) {
      if (dataPoints[i].y === startRate) {
        todayStartIndex = i;
        // さらに手前に同じ値が連続していれば、その先頭まで遡る
        // （試合開始前のレート安定区間を含める）
        while (i - 1 >= searchLimit && dataPoints[i - 1].y === startRate) {
          todayStartIndex = i - 1;
          i--;
        }
        break;
      }
    }

    // 完全一致が見つからない場合、検索範囲内でstartRateに最も近い値で代替
    if (todayStartIndex === -1) {
      let minDiff = Infinity;
      for (let i = dataPoints.length - 1; i >= searchLimit; i--) {
        const diff = Math.abs(dataPoints[i].y - startRate);
        if (diff < minDiff) {
          minDiff = diff;
          todayStartIndex = i;
        }
      }
    }

    // 今日の試合データを抽出
    const todayPoints = dataPoints.slice(todayStartIndex);

    let wins = 0;
    let losses = 0;
    const rateHistory = [];

    for (let i = 1; i < todayPoints.length; i++) {
      const diff = todayPoints[i].y - todayPoints[i - 1].y;
      if (diff > 0) {
        wins++;
      } else if (diff < 0) {
        losses++;
      }
      rateHistory.push({
        from: todayPoints[i - 1].y,
        to: todayPoints[i].y,
        diff: diff,
      });
    }

    const total = wins + losses;
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

    return {
      wins,
      losses,
      total,
      winRate,
      startRate,
      endRate: currentRate,
      dailyChange,
      rateHistory,
      todayPoints,
    };
  }

  // 戦績カード画像を生成
  function renderCard(canvas, data, stats, theme) {
    const ctx = canvas.getContext("2d");
    const W = 600;
    const H = 400;
    canvas.width = W;
    canvas.height = H;

    // 背景グラデーション
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
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
    const today = new Date();
    const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;

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

    // 勝敗数（大きく表示）
    const recordY = 140;
    ctx.textAlign = "center";

    // 勝ち数
    ctx.fillStyle = theme.win;
    ctx.font = "bold 56px sans-serif";
    ctx.fillText(String(stats.wins), W / 2 - 80, recordY);
    ctx.fillStyle = theme.textMuted;
    ctx.font = "20px sans-serif";
    ctx.fillText("WIN", W / 2 - 80, recordY + 28);

    // ハイフン
    ctx.fillStyle = theme.textFaint;
    ctx.font = "bold 40px sans-serif";
    ctx.fillText("-", W / 2, recordY - 8);

    // 負け数
    ctx.fillStyle = theme.lose;
    ctx.font = "bold 56px sans-serif";
    ctx.fillText(String(stats.losses), W / 2 + 80, recordY);
    ctx.fillStyle = theme.textMuted;
    ctx.font = "20px sans-serif";
    ctx.fillText("LOSE", W / 2 + 80, recordY + 28);

    // 勝率
    ctx.fillStyle = theme.text;
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(`勝率 ${stats.winRate}%`, W / 2, recordY + 60);

    // レート変動
    const rateY = 250;
    ctx.textAlign = "center";
    ctx.fillStyle = theme.textSub;
    ctx.font = "16px sans-serif";
    ctx.fillText("Rating", W / 2, rateY);

    const changeColor =
      stats.dailyChange > 0
        ? theme.win
        : stats.dailyChange < 0
          ? theme.lose
          : theme.textDim;
    const changeSign = stats.dailyChange > 0 ? "+" : "";

    ctx.font = "bold 28px sans-serif";
    ctx.fillStyle = theme.text;
    ctx.fillText(`${stats.startRate}  →  ${stats.endRate}`, W / 2, rateY + 35);

    ctx.fillStyle = changeColor;
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(`(${changeSign}${stats.dailyChange})`, W / 2, rateY + 65);

    // ミニグラフ
    if (stats.todayPoints && stats.todayPoints.length > 1) {
      const graphX = 40;
      const graphY = 320;
      const graphW = W - 80;
      const graphH = 60;

      const rates = stats.todayPoints.map((p) => p.y);
      const minRate = Math.min(...rates);
      const maxRate = Math.max(...rates);
      const range = maxRate - minRate || 1;

      ctx.strokeStyle = hexToRgba(theme.accent, 0.6);
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let i = 0; i < rates.length; i++) {
        const x = graphX + (i / (rates.length - 1)) * graphW;
        const y = graphY + graphH - ((rates[i] - minRate) / range) * graphH;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // グラフの塗りつぶし
      const lastX = graphX + graphW;
      const lastY =
        graphY +
        graphH -
        ((rates[rates.length - 1] - minRate) / range) * graphH;
      ctx.lineTo(lastX, graphY + graphH);
      ctx.lineTo(graphX, graphY + graphH);
      ctx.closePath();

      const graphGrad = ctx.createLinearGradient(0, graphY, 0, graphY + graphH);
      graphGrad.addColorStop(0, hexToRgba(theme.accent, 0.2));
      graphGrad.addColorStop(1, hexToRgba(theme.accent, 0));
      ctx.fillStyle = graphGrad;
      ctx.fill();

      // レート数値ラベル
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

  // ツイートテキスト生成
  function buildTweetText(stats) {
    const changeSign = stats.dailyChange > 0 ? "+" : "";
    return [
      `今日のスマメイト戦績`,
      `${stats.wins}勝 ${stats.losses}敗 (勝率${stats.winRate}%)`,
      `レート: ${stats.startRate} → ${stats.endRate} (${changeSign}${stats.dailyChange})`,
      `#スマブラSP #スマメイト #SmashMateCard`,
    ].join("\n");
  }

  // デモ用モックデータ
  function createDemoData() {
    const points = [
      { x: 1, y: 1500 },
      { x: 2, y: 1520 },
      { x: 3, y: 1505 },
      { x: 4, y: 1535 },
      { x: 5, y: 1515 },
      { x: 6, y: 1550 },
      { x: 7, y: 1530 },
      { x: 8, y: 1565 },
      { x: 9, y: 1545 },
      { x: 10, y: 1570 },
      { x: 11, y: 1555 },
      { x: 12, y: 1580 },
    ];
    return {
      data: {
        userName: "DemoPlayer",
        currentRate: 1580,
        dailyChange: 80,
        dataPoints: points,
      },
      stats: {
        wins: 8,
        losses: 3,
        total: 11,
        winRate: "72.7",
        startRate: 1500,
        endRate: 1580,
        dailyChange: 80,
        rateHistory: [],
        todayPoints: points,
      },
    };
  }

  // カードUI初期化（本番・デモ共通）
  // 現在のデータ/statsを保持（イベントリスナーから参照）
  let activeData = null;
  let activeStats = null;
  let listenersAttached = false;

  function initCardUI(data, stats) {
    activeData = data;
    activeStats = stats;

    const loadingEl = document.getElementById("loading");
    const contentEl = document.getElementById("content");
    const errorEl = document.getElementById("error");

    document.getElementById("today-record").textContent =
      `${stats.wins}勝 ${stats.losses}敗`;
    document.getElementById("today-winrate").textContent = `${stats.winRate}%`;

    const theme = THEMES[currentTheme];
    const changeSign = stats.dailyChange > 0 ? "+" : "";
    const rateChangeEl = document.getElementById("rate-change");
    rateChangeEl.textContent = `${stats.startRate} → ${stats.endRate} (${changeSign}${stats.dailyChange})`;
    rateChangeEl.style.color =
      stats.dailyChange > 0
        ? theme.win
        : stats.dailyChange < 0
          ? theme.lose
          : theme.textDim;

    const canvas = document.getElementById("card-canvas");
    renderCard(canvas, data, stats, THEMES[currentTheme]);

    loadingEl.classList.add("hidden");
    errorEl.classList.add("hidden");
    contentEl.classList.remove("hidden");

    // イベントリスナーは一度だけ登録（activeData/activeStatsを参照するので再登録不要）
    if (listenersAttached) return;
    listenersAttached = true;

    // テーマ切替
    document.querySelectorAll(".theme-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentTheme = btn.dataset.theme;
        document
          .querySelectorAll(".theme-btn")
          .forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        const t = THEMES[currentTheme];
        renderCard(canvas, activeData, activeStats, t);
        // ポップアップUIのレート変動色もテーマに連動
        const rateEl = document.getElementById("rate-change");
        rateEl.style.color =
          activeStats.dailyChange > 0
            ? t.win
            : activeStats.dailyChange < 0
              ? t.lose
              : t.textDim;
      });
    });

    // ボタンイベント
    document.getElementById("btn-copy").addEventListener("click", () => {
      canvas.toBlob((blob) => {
        if (!blob) {
          alert("画像の生成に失敗しました。");
          return;
        }
        const item = new ClipboardItem({ "image/png": blob });
        navigator.clipboard
          .write([item])
          .then(() => {
            const btn = document.getElementById("btn-copy");
            btn.textContent = "コピー完了!";
            setTimeout(() => {
              btn.textContent = "画像をコピー";
            }, 2000);
          })
          .catch(() => {
            alert("クリップボードへのコピーに失敗しました。");
          });
      });
    });

    document.getElementById("btn-download").addEventListener("click", () => {
      const link = document.createElement("a");
      const d = new Date();
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      link.download = `smashmate_${dateStr}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    });

    document.getElementById("btn-copy-text").addEventListener("click", () => {
      const text = buildTweetText(activeStats);
      navigator.clipboard
        .writeText(text)
        .then(() => {
          const btn = document.getElementById("btn-copy-text");
          btn.textContent = "コピー完了!";
          setTimeout(() => {
            btn.textContent = "テキストをコピー";
          }, 2000);
        })
        .catch(() => {
          alert("テキストのコピーに失敗しました。");
        });
    });

    document.getElementById("btn-tweet").addEventListener("click", () => {
      const text = buildTweetText(activeStats);
      const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
      chrome.tabs.create({ url });
    });
  }

  // メイン処理
  document.addEventListener("DOMContentLoaded", () => {
    const loadingEl = document.getElementById("loading");
    const errorEl = document.getElementById("error");
    const errorMsg = document.getElementById("error-message");

    function showError(msg) {
      loadingEl.classList.add("hidden");
      errorEl.classList.remove("hidden");
      errorMsg.textContent = msg;
    }

    // デモボタン
    document.getElementById("btn-demo").addEventListener("click", () => {
      const { data, stats } = createDemoData();
      initCardUI(data, stats);
    });

    // アクティブタブのContent Scriptにメッセージを送信
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.url || !tab.url.includes("smashmate.net/user/")) {
        showError("smashmate.netのユーザーページを開いてください。");
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: "extractData" }, (response) => {
        if (chrome.runtime.lastError) {
          showError(
            "データの取得に失敗しました。ページをリロードしてもう一度お試しください。",
          );
          return;
        }

        if (!response) {
          showError("データを取得できませんでした。");
          return;
        }

        if (response.error) {
          showError(response.error);
          return;
        }

        if (response.dailyChange === 0) {
          showError("今日の対戦がまだありません（前日比: 0）。");
          return;
        }

        const stats = calculateTodayStats(response);

        if (stats.error) {
          showError(stats.error);
          return;
        }

        initCardUI(response, stats);
      });
    });
  });
})();
