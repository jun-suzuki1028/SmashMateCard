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
        // dataPoints: [{x:1,y:1500}, ...] のパターンを探す
        const dpMatch = text.match(/dataPoints\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
        if (dpMatch) {
          try {
            // JSON5風のオブジェクト表記をパース
            const cleaned = dpMatch[1]
              .replace(/(\w+)\s*:/g, '"$1":') // キー名をクォート
              .replace(/'/g, '"')
              .replace(/,\s*([}\]])/g, "$1"); // 末尾カンマ除去
            data.dataPoints = JSON.parse(cleaned);
          } catch (e) {
            // evalフォールバック（安全な範囲で）
            try {
              const fn = new Function("return " + dpMatch[1]);
              data.dataPoints = fn();
            } catch (e2) {
              data.error = "dataPointsのパースに失敗しました";
            }
          }
        }

        // data: [{x:1,y:1500}, ...] パターンも検索（Chart.jsの場合）
        if (data.dataPoints.length === 0) {
          const dataMatch = text.match(
            /data\s*:\s*(\[\s*\{[\s\S]*?\}\s*\])\s*[,}]/,
          );
          if (dataMatch) {
            try {
              const cleaned = dataMatch[1]
                .replace(/(\w+)\s*:/g, '"$1":')
                .replace(/'/g, '"')
                .replace(/,\s*([}\]])/g, "$1");
              data.dataPoints = JSON.parse(cleaned);
            } catch (e) {
              try {
                const fn = new Function("return " + dataMatch[1]);
                data.dataPoints = fn();
              } catch (e2) {
                // 無視
              }
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
