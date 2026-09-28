// IIFE でグローバルスコープ汚染を防止
(function () {
  "use strict";

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
    const dateStr = stats.dateKey.replaceAll("-", "/");

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
    const basis = stats.baselineId === "0" ? "シーズン最初から" : `No.${stats.baselineId} の次から`;
    ctx.fillText(`計測開始以降 / ${basis}`, W - 20, H - 10);
  }

  // ツイートテキスト生成
  function buildTweetText(stats) {
    const changeSign = stats.dailyChange > 0 ? "+" : "";
    return [
      `スマメイト戦績（計測開始以降）`,
      `${stats.dateKey}（日本時間） / ${stats.baselineId === "0" ? "シーズン最初から" : `No.${stats.baselineId}の次から`}`,
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
        wins: 6,
        losses: 5,
        total: 11,
        winRate: "54.5",
        dateKey: SmashMateTracking.japanDate(),
        baselineId: "0",
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
      const dateStr = activeStats.dateKey;
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

  // 計測設定は、取得エラー時にも修正できるようカードとは分離する。
  document.addEventListener("DOMContentLoaded", async () => {
    const loadingEl = document.getElementById("loading");
    const contentEl = document.getElementById("content");
    const errorEl = document.getElementById("error");
    const errorMsg = document.getElementById("error-message");
    const controls = document.getElementById("tracking-controls");
    const status = document.getElementById("tracking-status");
    const input = document.getElementById("baseline-id");
    const demo = document.getElementById("btn-demo");
    let tabId = null;
    let busy = false;

    function showError(message) {
      loadingEl.classList.add("hidden");
      contentEl.classList.add("hidden");
      errorEl.classList.remove("hidden");
      errorMsg.textContent = message;
    }

    function setBusy(value) {
      busy = value;
      controls.querySelectorAll("button, input").forEach((el) => { el.disabled = value; });
      demo.disabled = value;
      controls.setAttribute("aria-busy", String(value));
    }

    async function refresh(options = {}) {
      if (busy || tabId === null) return;
      setBusy(true);
      loadingEl.classList.remove("hidden");
      contentEl.classList.add("hidden");
      errorEl.classList.add("hidden");
      status.textContent = "";
      try {
        const result = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tabId, { action: "trackStats", ...options }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error("データを取得できませんでした。拡張機能を更新した場合は、スマメイトのページを再読み込みしてください。"));
            } else if (!response) {
              reject(new Error("データを取得できませんでした。もう一度更新してください。"));
            } else if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          });
        });
        const { data, stats, baseline, created } = result;
        document.getElementById("tracking-period").textContent =
          `第${baseline.seasonId}期 / ${stats.dateKey}（日本時間）`;
        document.getElementById("tracking-baseline").textContent = stats.baselineId === "0"
          ? "基準：シーズン最初から集計"
          : `基準：No.${stats.baselineId} の次から集計`;
        input.value = stats.baselineId;
        status.textContent = created
          ? "基準を保存しました。この後に終了した対戦を集計します。"
          : Object.hasOwn(options, "baselineId")
            ? "基準IDを変更して再集計しました。"
            : "最新の履歴で集計しました。";
        initCardUI(data, stats);
      } catch (error) {
        showError(error.message);
      } finally {
        setBusy(false);
      }
    }

    demo.addEventListener("click", () => {
      const { data, stats } = createDemoData();
      status.textContent = "デモを表示中です。保存済みの基準は変更していません。";
      initCardUI(data, stats);
    });
    document.getElementById("baseline-form").addEventListener("submit", (event) => {
      event.preventDefault();
      void refresh({ baselineId: input.value });
    });
    document.getElementById("btn-refresh").addEventListener("click", () => { void refresh(); });
    document.getElementById("btn-reset").addEventListener("click", () => { void refresh({ reset: true }); });

    try {
      const tabs = await new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (found) => {
          if (chrome.runtime.lastError) reject(new Error("タブを取得できませんでした。"));
          else resolve(found);
        });
      });
      const tab = tabs[0];
      const url = tab?.url ? new URL(tab.url) : null;
      if (!url || url.origin !== "https://smashmate.net" || !/^\/user\/\d+\/$/.test(url.pathname)) {
        showError("smashmate.netのユーザーページを開いてください。");
        return;
      }
      tabId = tab.id;
      controls.classList.remove("hidden");
      await refresh();
    } catch (error) {
      showError(error.message);
    }
  });
})();
