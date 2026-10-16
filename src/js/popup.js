//修正箇所2026/10/15 (全体をIIFEで包み、ポップアップが存在しないページでもエラーにならないようにした)
(function () {
    const popup = document.querySelector('#labo-popup');
    if (!popup) return;

    const openButtons = document.querySelectorAll('.open-labo');
    const closeButtons = document.querySelectorAll('.close-labo');

    //修正箇所2026/10/15 (開く前にフォーカスしていた要素を覚えておき、閉じたときに戻す。キーボード操作・スクリーンリーダー対応)
    let lastFocused = null;
    const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function openPopup(trigger) {
        lastFocused = trigger || document.activeElement;
        popup.classList.add('active');

        //修正箇所2026/10/15 (旧: aria-hidden="true" が開いた後も残り、スクリーンリーダーに内容が読まれなかった。開閉に合わせて切り替え)
        popup.setAttribute('aria-hidden', 'false');
        popup.scrollTop = 0;

        // 背面のスクロールを止める
        document.body.style.overflow = 'hidden';

        //修正箇所2026/10/15 (開いたらポップアップ内へフォーカスを移動)
        popup.focus({ preventScroll: true });
    }

    function closePopup() {
        popup.classList.remove('active');
        popup.setAttribute('aria-hidden', 'true');

        // 背面のスクロールを戻す
        document.body.style.overflow = '';

        if (lastFocused && typeof lastFocused.focus === 'function') {
            lastFocused.focus({ preventScroll: true });
        }
    }

    // 「Read more●」を押したときにポップアップを開く
    openButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // 画面の上部に飛ぶのを止める
            e.preventDefault();
            openPopup(button);
        });
    });

    // ×ボタンを押したときにポップアップを閉じる
    closeButtons.forEach(button => {
        button.addEventListener('click', closePopup);
    });

    //修正箇所2026/10/15 (旧: Escキーで閉じられず、Tabキーでポップアップの外に出てしまっていた。Esc で閉じる＋ポップアップ内でフォーカスを循環)
    document.addEventListener('keydown', (e) => {
        if (!popup.classList.contains('active')) return;

        if (e.key === 'Escape') {
            closePopup();
            return;
        }

        if (e.key === 'Tab') {
            const items = Array.from(popup.querySelectorAll(FOCUSABLE))
                .filter(el => el.offsetParent !== null);
            if (items.length === 0) {
                e.preventDefault();
                return;
            }
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && (document.activeElement === first || document.activeElement === popup)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    });

    // 修正：サービス一覧のリンクをクリックしたときの処理
    const jumpLinks = document.querySelectorAll('.jump_panel');
    jumpLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // もし「同一ページ内のスクロール（#targetなど）」ではなく「別ページへのリンク」なら
            // e.preventDefault() を実行せずに、そのままページ遷移させます。
            const href = link.getAttribute('href');
            
            // hrefが「#」から始まるページ内リンクの場合だけスクロール処理を行う
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    popup.scrollTo({
                        top: target.offsetTop - 80,
                        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
                    });
                }
            } else {
                // 通常のリンク（/labo/Labo_Scanner/ など）のときは、
                // ポップアップを開いたままだと戻ってきた時に不都合がある場合、ここで閉じる処理を挟むと親切です。
                closePopup();
            }
        });
    });
})(); // 一番最後の閉じ括弧
