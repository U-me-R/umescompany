// idに紐付いてスクロールする
//修正箇所2026/10/15 (jQuery 1.8.3 を廃止し素のJSに置き換え。旧: http://読み込みでHTTPSサイトではブロックされ、バージョンも古く脆弱性があった)
(function () {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    //修正箇所2026/10/15 (イベント委譲にして、後から追加されたリンクにも対応)
    document.addEventListener('click', (e) => {
        //修正箇所2026/10/15 (popup.js側で preventDefault 済みのクリック(Read more●・サービス一覧リンク)は処理しない。旧: 全ての href^="#" に反応していた)
        if (e.defaultPrevented) return;

        const link = e.target.closest && e.target.closest('a[href^="#"]');
        if (!link) return;

        const href = link.getAttribute('href');

        //修正箇所2026/10/15 (旧: href="#" のリンクを押すと $('html') が対象になり、ページ先頭へ飛んでしまっていた。"#"のみのリンクは対象外)
        if (!href || href.length < 2) return;

        const target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();

        //修正箇所2026/10/15 (旧: $('html').animate で自前アニメーション。ネイティブのスムーススクロールに変更。動きを減らす設定の人には即時移動)
        target.scrollIntoView({
            behavior: reduceMotion ? 'auto' : 'smooth',
            block: 'start'
        });
    });
})();
