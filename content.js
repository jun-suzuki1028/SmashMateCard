// smashmate.net/user/* ページからデータを抽出するContent Script

(function () {
  function extractData() {
    const data = {
      currentRate: null,
      maxRate: null,
      totalWins: null,
      totalLosses: null,
      dailyChange: null,
      dataPoints: [],
      character: null,
      userName: null,
      error: null,
    };

    try {
      // ユーザー名
      const nameEl = document.querySelector("h2.user-name, .user-name");
      if (nameEl) {
        data.userName = nameEl.textContent.trim();
      }

      // ページ全体のテキストから情報を抽出
      const bodyText = document.body.innerText;

      // 現在レート: "レート" の近くにある数値
      const rateSection = document.querySelectorAll(
        "table.user-info td, .rating-value, .user-info span",
      );
      const allText = document.body.innerHTML;

      // テーブルからレート情報を抽出
      const tables = document.querySelectorAll("table");
      for (const table of tables) {
        const rows = table.querySelectorAll("tr");
        for (const row of rows) {
          const cells = row.querySelectorAll("th, td");
          if (cells.length >= 2) {
            const label = cells[0].textContent.trim();
            const value = cells[1].textContent.trim();

            if (
              label.includes("レート") &&
              !label.includes("最高") &&
              !label.includes("前日比")
            ) {
              const match = value.match(/(\d+)/);
              if (match) data.currentRate = parseInt(match[1]);
            }
            if (label.includes("最高レート") || label.includes("最高")) {
              const match = value.match(/(\d+)/);
              if (match) data.maxRate = parseInt(match[1]);
            }
            if (label.includes("前日比")) {
              const match = value.match(/([+-]?\d+)/);
              if (match) data.dailyChange = parseInt(match[1]);
            }
          }
        }
      }

      // テーブルで取得できなかった場合、bodyTextから正規表現で抽出
      if (data.currentRate === null) {
        const currentRateMatch = bodyText.match(/現在レート\s*(\d+)/);
        if (currentRateMatch) data.currentRate = parseInt(currentRateMatch[1]);
      }
      if (data.maxRate === null) {
        const maxRateMatch = bodyText.match(/最高レート\s*(\d+)/);
        if (maxRateMatch) data.maxRate = parseInt(maxRateMatch[1]);
      }
      if (data.dailyChange === null) {
        const dailyMatch = bodyText.match(/前日比[：:]\s*([+-]?\d+)/);
        if (dailyMatch) data.dailyChange = parseInt(dailyMatch[1]);
      }

      // 勝敗総数を抽出
      const winLossMatch = bodyText.match(/(\d+)\s*勝\s*(\d+)\s*敗/);
      if (winLossMatch) {
        data.totalWins = parseInt(winLossMatch[1]);
        data.totalLosses = parseInt(winLossMatch[2]);
      }

      // 使用キャラ画像URLを取得
      const charImg = document.querySelector(
        'img[src*="/img/symbol/"], img[src*="/img/chara/"]',
      );
      if (charImg) {
        data.character = charImg.src;
      }

      // <script>タグからdataPoints配列を抽出
      const scripts = document.querySelectorAll("script");
      for (const script of scripts) {
        const text = script.textContent;

        // dataPoints.push({x:1, y:1500}) パターンを検索
        const pushMatches = text.matchAll(
          /dataPoints\.push\(\{\s*x\s*:\s*(\d+)\s*,\s*y\s*:\s*(\d+)\s*\}\)/g,
        );
        for (const m of pushMatches) {
          data.dataPoints.push({ x: parseInt(m[1]), y: parseInt(m[2]) });
        }

        // 配列リテラル形式のフォールバック: dataPoints: [{x:1,y:1500}, ...]
        if (data.dataPoints.length === 0) {
          const dpMatch = text.match(/dataPoints\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
          if (dpMatch) {
            try {
              const cleaned = dpMatch[1]
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

      // 前日比が取得できなかった場合
      if (data.dailyChange === null) {
        data.error =
          "前日比が取得できませんでした。ログインしていることを確認してください。";
      }
    } catch (e) {
      data.error = "データ抽出中にエラーが発生しました: " + e.message;
    }

    return data;
  }

  // メッセージリスナー: ポップアップからのリクエストに応答
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractData") {
      const data = extractData();
      sendResponse(data);
    }
    return true; // 非同期レスポンスを有効化
  });
})();
