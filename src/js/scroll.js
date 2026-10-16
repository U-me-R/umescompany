//修正箇所2026/10/15 (全体をIIFEで包み、GSAP/ScrollTriggerがCDN障害などで読み込めなかった場合にエラー停止しないようにした)
(function () {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  // GSAPの拡張プラグイン「ScrollTrigger」を有効化
  gsap.registerPlugin(ScrollTrigger);

  //修正箇所2026/10/15 (スマホでアドレスバーが伸縮するたびにScrollTriggerが再計算して位置ズレ・ガタつきが起きるのを防ぐ)
  ScrollTrigger.config({ ignoreMobileResize: true });

  //修正箇所2026/10/15 (「動きを減らす」設定の人は、スクロールの追従遅延(scrub の数値)を無くす)
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  //修正箇所2026/10/15 (旧: THRESHOLD / DURATION / COOLDOWN による手動のパネル切替ロジックは廃止。scrub + snap に置き換えたため定数も不要)


  // 横スクロールエリアA (#area-me) の個別制御
  (function () {
    // 対象となる全体の親要素を取得
    const wrapper = document.querySelector("#area-me");
    if (!wrapper) return; // 要素が存在しない場合は処理を中断

    // 動かす対象のコンテナと、その中の各パネル（子要素）を取得
    const container = wrapper.querySelector(".scroll");
    const panels = gsap.utils.toArray(wrapper.querySelectorAll(".panel"));
    const total = panels.length; // パネルの総数
    if (!container || total < 2) return; // 必要な要素が揃っていなければ（パネルが1枚以下なら動かす必要が無いので）中断

    // パネルの総数に合わせて、横スクロールコンテナの全体幅を設定（例：4枚なら 400vw）
    gsap.set(container, { width: `${total * 100}vw` });

    //修正箇所2026/10/15 (旧: onUpdate内で手動判定→changePanel→完了時に ST.scroll() で強制的にスクロール位置を書き換える方式だった。
    // ナビのアンカー移動でこのエリアを通過すると、ST.scroll()でスクロールが引き戻され暴走する恐れがあったため、
    // ScrollTrigger標準の scrub + snap に置き換え。パネルごとに吸着し、位置の強制書き換えが不要になる)
    gsap.to(container, {
      x: () => -window.innerWidth * (total - 1), // 最終的に左へ動かす総量
      ease: "none",
      scrollTrigger: {
        trigger: wrapper,   // 監視の基準となる要素
        pin: true,          // スクロール中に親要素を画面内に固定する
        start: "top top",   // 親要素のトップが画面のトップに達したら固定開始
        end: () => `+=${window.innerHeight * (total - 1)}`, // 固定を解除するまでのスクロール距離
        scrub: reduceMotion ? true : 0.3, // スクロール量にアニメーションを連動
        snap: {
          snapTo: 1 / (total - 1), // パネルの位置にぴったり吸着
          duration: { min: 0.15, max: 0.4 },
          ease: "power2.out"
        },
        //修正箇所2026/10/15 (画面サイズ変更時に x の移動量を再計算させるために必要。旧: resizeイベントで手動で x を再設定していた)
        invalidateOnRefresh: true
      }
    });
  })();


  // 横スクロールエリアB (#area-b) の個別制御
  // （処理内容は上記の #area-me と似ているが、こちらは画面固定せず独立して動作）
  (function () {
    const wrapper = document.querySelector("#area-b");
    if (!wrapper) return;

    const container = wrapper.querySelector(".scroll");
    const panels = gsap.utils.toArray(wrapper.querySelectorAll(".panel"));
    const total = panels.length;
    if (!container || total === 0) return;

    // コンテナの全体の横幅を設定
    gsap.set(container, { width: `${total * 100}vw` });

    //修正箇所2026/10/15 (旧: パネルが1枚でも (total-1)=0 の移動量でScrollTriggerを作っていた。1枚の間は動かす意味が無いため、2枚以上になったときだけ有効化)
    if (total < 2) return;

    // 画面に固定せず、縦スクロールの量に合わせてなめらかに横に動かす
    gsap.to(container, {
      x: () => -(window.innerWidth * (total - 1)),
      ease: "none", // スクロールと完全に同期させるためイージングはなし
      scrollTrigger: {
        trigger: wrapper,
        pin: false,          // 画面固定（Pin）をオフにする
        start: "top bottom", // エリアの上が画面の下端に入ったらアニメーション開始
        end: "bottom top",   // エリアの下が画面の上端から出ていったらアニメーション終了
        scrub: true,         // スクロール量にアニメーションを直接連動させる
        //修正箇所2026/10/15 (画面サイズ変更時に x の移動量を再計算させるために必要)
        invalidateOnRefresh: true
      }
    });
  })();

  // 全体計算の強制同期リフレッシュ（白画面化バグ・位置ズレ対策）

  // ページ内の画像やCSSなどの全リソースが読み込まれたタイミングで実行
  window.addEventListener("load", () => {
    // ScrollTriggerに全体のスクロール位置や要素の高さを再計算させる
    // 遅延読み込み等による位置情報のズレや、画面が真っ白になる不具合を防ぐための処理
    ScrollTrigger.refresh();
  });
})();
