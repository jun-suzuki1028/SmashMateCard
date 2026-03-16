// 戦績計算ロジック
function calculateTodayStats(data) {
  const { currentRate, dailyChange, dataPoints } = data;

  if (dailyChange === 0 || dailyChange === null) {
    return { error: "今日の対戦データがありません" };
  }

  const startRate = currentRate - dailyChange;

  // dataPointsを末尾から遡り、開始レートと一致する最後の地点を探す
  let todayStartIndex = -1;
  for (let i = dataPoints.length - 1; i >= 0; i--) {
    if (dataPoints[i].y === startRate) {
      todayStartIndex = i;
      break;
    }
  }

  // 完全一致が見つからない場合、最も近い値を探す
  if (todayStartIndex === -1) {
    let minDiff = Infinity;
    for (let i = dataPoints.length - 1; i >= 0; i--) {
      const diff = Math.abs(dataPoints[i].y - startRate);
      if (diff < minDiff) {
        minDiff = diff;
        todayStartIndex = i;
      }
      if (diff === 0) break;
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
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : 0;

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
function renderCard(canvas, data, stats) {
  const ctx = canvas.getContext("2d");
  const W = 600;
  const H = 400;
  canvas.width = W;
  canvas.height = H;

  // 背景グラデーション
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "#0f0c29");
  bgGrad.addColorStop(0.5, "#302b63");
  bgGrad.addColorStop(1, "#24243e");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 装飾ライン
  ctx.strokeStyle = "rgba(0, 212, 255, 0.3)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 60);
  ctx.lineTo(W, 60);
  ctx.stroke();

  // 日付
  const today = new Date();
  const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;

  ctx.fillStyle = "#888";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(dateStr, W - 20, 35);

  // タイトル
  ctx.fillStyle = "#00d4ff";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Today's Smashmate Results", 20, 40);

  // ユーザー名
  if (data.userName) {
    ctx.fillStyle = "#ccc";
    ctx.font = "14px sans-serif";
    ctx.fillText(data.userName, 20, 90);
  }

  // 勝敗数（大きく表示）
  const recordY = 140;
  ctx.textAlign = "center";

  // 勝ち数
  ctx.fillStyle = "#4CAF50";
  ctx.font = "bold 56px sans-serif";
  ctx.fillText(String(stats.wins), W / 2 - 80, recordY);
  ctx.fillStyle = "#aaa";
  ctx.font = "20px sans-serif";
  ctx.fillText("WIN", W / 2 - 80, recordY + 28);

  // ハイフン
  ctx.fillStyle = "#666";
  ctx.font = "bold 40px sans-serif";
  ctx.fillText("-", W / 2, recordY - 8);

  // 負け数
  ctx.fillStyle = "#f44336";
  ctx.font = "bold 56px sans-serif";
  ctx.fillText(String(stats.losses), W / 2 + 80, recordY);
  ctx.fillStyle = "#aaa";
  ctx.font = "20px sans-serif";
  ctx.fillText("LOSE", W / 2 + 80, recordY + 28);

  // 勝率
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(`勝率 ${stats.winRate}%`, W / 2, recordY + 60);

  // レート変動
  const rateY = 250;
  ctx.textAlign = "center";
  ctx.fillStyle = "#ccc";
  ctx.font = "16px sans-serif";
  ctx.fillText("Rating", W / 2, rateY);

  const changeColor =
    stats.dailyChange > 0
      ? "#4CAF50"
      : stats.dailyChange < 0
        ? "#f44336"
        : "#888";
  const changeSign = stats.dailyChange > 0 ? "+" : "";

  ctx.font = "bold 28px sans-serif";
  ctx.fillStyle = "#fff";
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

    ctx.strokeStyle = "rgba(0, 212, 255, 0.6)";
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
      graphY + graphH - ((rates[rates.length - 1] - minRate) / range) * graphH;
    ctx.lineTo(lastX, graphY + graphH);
    ctx.lineTo(graphX, graphY + graphH);
    ctx.closePath();

    const graphGrad = ctx.createLinearGradient(0, graphY, 0, graphY + graphH);
    graphGrad.addColorStop(0, "rgba(0, 212, 255, 0.2)");
    graphGrad.addColorStop(1, "rgba(0, 212, 255, 0)");
    ctx.fillStyle = graphGrad;
    ctx.fill();

    // レート数値ラベル
    ctx.fillStyle = "#666";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(String(maxRate), graphX, graphY - 4);
    ctx.fillText(String(minRate), graphX, graphY + graphH + 14);
  }

  // フッター
  ctx.fillStyle = "#555";
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
    `#スマブラSP #スマメイト`,
  ].join("\n");
}

// メイン処理
document.addEventListener("DOMContentLoaded", () => {
  const loadingEl = document.getElementById("loading");
  const contentEl = document.getElementById("content");
  const errorEl = document.getElementById("error");
  const errorMsg = document.getElementById("error-message");

  function showError(msg) {
    loadingEl.classList.add("hidden");
    errorEl.classList.remove("hidden");
    errorMsg.textContent = msg;
  }

  function showContent() {
    loadingEl.classList.add("hidden");
    contentEl.classList.remove("hidden");
  }

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

      if (response.error && response.dailyChange === null) {
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

      // UIを更新
      document.getElementById("today-record").textContent =
        `${stats.wins}勝 ${stats.losses}敗`;
      document.getElementById("today-winrate").textContent =
        `${stats.winRate}%`;

      const changeSign = stats.dailyChange > 0 ? "+" : "";
      const rateChangeEl = document.getElementById("rate-change");
      rateChangeEl.textContent = `${stats.startRate} → ${stats.endRate} (${changeSign}${stats.dailyChange})`;
      rateChangeEl.style.color =
        stats.dailyChange > 0
          ? "#4CAF50"
          : stats.dailyChange < 0
            ? "#f44336"
            : "#888";

      // カード描画
      const canvas = document.getElementById("card-canvas");
      renderCard(canvas, response, stats);

      showContent();

      // ボタンイベント
      document.getElementById("btn-copy").addEventListener("click", () => {
        canvas.toBlob((blob) => {
          const item = new ClipboardItem({ "image/png": blob });
          navigator.clipboard.write([item]).then(() => {
            const btn = document.getElementById("btn-copy");
            btn.textContent = "コピー完了!";
            setTimeout(() => {
              btn.textContent = "画像をコピー";
            }, 2000);
          });
        });
      });

      document.getElementById("btn-download").addEventListener("click", () => {
        const link = document.createElement("a");
        link.download = `smashmate_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      });

      document.getElementById("btn-tweet").addEventListener("click", () => {
        const text = buildTweetText(stats);
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        chrome.tabs.create({ url });
      });
    });
  });
});
