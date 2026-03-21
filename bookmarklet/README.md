# SmashMateCard ブックマークレット版

Chrome拡張をインストールできない環境（スマホ等）で、同等の機能を利用できます。

## ブックマークレット

以下のコードをブックマークのURLとして登録してください。

```
javascript:void(function(){var s=document.createElement('script');s.src='https://raw.githubusercontent.com/jun-suzuki1028/SmashMateCard/main/bookmarklet/smashmate-card.js';document.body.appendChild(s)})()
```

## スマホでの登録方法

### Android (Chrome)
1. このページの「ブックマークレット」のコードをコピー
2. 適当なページをブックマークに追加（名前は「SmashMateCard」にする）
3. ブックマークマネージャーを開き、今追加したブックマークを編集
4. URLを上記コードに書き換えて保存

### iPhone (Safari)
1. このページの「ブックマークレット」のコードをコピー
2. 適当なページをブックマークに追加（名前は「SmashMateCard」にする）
3. ブックマークを編集し、URLを上記コードに書き換えて保存

## 使い方

1. smashmate.net にログイン
2. マイページまたはユーザーページを開く
3. ブックマークレットをタップ/クリック
4. 戦績カードが表示されるので、保存・共有

## 注意事項

- smashmate.net へのログインが必要です
- データはブラウザ内で処理され、外部サーバーへの送信は行いません
- スクリプトの読み込みに GitHub への通信が発生します（ユーザーデータの送信はありません）
- ブラウザによってはブックマークレットが動作しない場合があります
