// 同一オリジンの履歴取得と、拡張機能専用の基準保存を担当する。
(function () {
  "use strict";

  const tracker = SmashMateTracking.createTracker({
    userUrl: location.href,
    storage: {
      get(key) {
        return new Promise((resolve, reject) => {
          chrome.storage.local.get(key, (items) => {
            const error = chrome.runtime.lastError;
            if (error) reject(new Error("計測の基準を読み込めませんでした。"));
            else resolve(items[key]);
          });
        });
      },
      set(key, value) {
        return new Promise((resolve, reject) => {
          chrome.storage.local.set({ [key]: value }, () => {
            const error = chrome.runtime.lastError;
            if (error) reject(new Error("計測の基準を保存できませんでした。"));
            else resolve();
          });
        });
      },
    },
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action !== "trackStats") return false;
    const options = {};
    if (Object.hasOwn(request, "baselineId")) options.baselineId = request.baselineId;
    if (request.reset === true) options.reset = true;
    tracker.refresh(options).then(
      (result) => sendResponse(result),
      (error) => sendResponse({ error: error.message, code: error.code }),
    );
    return true;
  });
})();
