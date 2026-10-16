//修正箇所2026/10/15 (新規ファイル。旧: スマホ用のナビ開閉処理が無く、ナビが画面を覆っていた。ハンバーガーメニューの開閉と、動画の自動再生停止をここにまとめた)
(function () {
    // ===== ナビゲーションの開閉（スマホ幅のみ表示されるメニューボタン） =====
    const nav = document.querySelector('#index nav');
    const toggle = nav ? nav.querySelector('.nav_toggle') : null;

    if (nav && toggle) {
        const setOpen = (open) => {
            nav.classList.toggle('is-open', open);
            toggle.setAttribute('aria-expanded', String(open));
            toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
        };

        toggle.addEventListener('click', () => {
            setOpen(!nav.classList.contains('is-open'));
        });

        // メニュー内のリンクを押したら閉じる
        nav.querySelectorAll('a').forEach((a) => {
            a.addEventListener('click', () => setOpen(false));
        });

        // Escキーでも閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') setOpen(false);
        });
    }

    // ===== 「動きを減らす」設定の人には背景動画を止める =====
    //修正箇所2026/10/15 (旧: prefers-reduced-motion を考慮せず常に自動再生していた)
    const video = document.querySelector('.hiro video');
    if (video && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        video.removeAttribute('autoplay');
        video.pause();
    }
})();
