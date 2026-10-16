// カーソルを動かすJavaScript（GSAP）
//修正箇所2026/10/15 (全体をIIFEで包み、GSAP未読込・要素なし・タッチ端末のときは何もしないようにした。旧: gsap未定義でエラー停止する恐れがあった)
(function () {
    if (typeof gsap === 'undefined') return;

    //修正箇所2026/10/15 (タッチ端末ではカスタムカーソルが不要で、無駄なイベント処理になっていたため中断)
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const dot = document.querySelector('.cursor_dot');
    const outline = document.querySelector('.cursor_outline');
    if (!dot || !outline) return;

    //修正箇所2026/10/15 (旧: CSSの translate(-50%,-50%) がGSAPに上書きされカーソル中心がずれていた。xPercent/yPercentで中心合わせ)
    gsap.set([dot, outline], { xPercent: -50, yPercent: -50 });

    //修正箇所2026/10/15 (旧: mousemoveのたびに gsap.to でトゥイーンを新規生成していて重かった。quickToで使い回す)
    const outlineX = gsap.quickTo(outline, 'x', { duration: 0.3, ease: 'power2.out' }); // duration: 遅延の長さ（大きいほど遅れる）
    const outlineY = gsap.quickTo(outline, 'y', { duration: 0.3, ease: 'power2.out' });

    // マウスが動いたときの処理
    window.addEventListener('mousemove', (e) => {
        dot.classList.add('is-visible');
        outline.classList.add('is-visible');

        // 中央のドットは遅延なしで追従
        gsap.set(dot, { x: e.clientX, y: e.clientY });

        // 外側の円は滑らかに遅れて追従させる
        outlineX(e.clientX);
        outlineY(e.clientY);
    }, { passive: true });

    //修正箇所2026/10/15 (画面外にマウスが出たとき、カーソルが端に残り続けるのを防ぐ)
    document.documentElement.addEventListener('mouseleave', () => {
        dot.classList.remove('is-visible');
        outline.classList.remove('is-visible');
    });

    // リンクにホバーしたときにカーソルを大きくする演出
    //修正箇所2026/10/15 (旧: 読み込み時に存在するa/buttonにだけ個別登録していた。後から追加された要素(×ボタン等)にも効くようイベント委譲に変更。色もdifferenceブレンドに合わせて白系へ)
    const HOVER_TARGET = 'a, button, [role="button"]';
    let isHover = false;
    document.addEventListener('mouseover', (e) => {
        const onTarget = !!(e.target.closest && e.target.closest(HOVER_TARGET));
        if (onTarget === isHover) return;
        isHover = onTarget;
        gsap.to(outline, {
            scale: onTarget ? 1.5 : 1,
            backgroundColor: onTarget ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0)',
            duration: 0.2,
            overwrite: 'auto'
        });
    });
})();
