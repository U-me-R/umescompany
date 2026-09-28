// カーソルを動かすJavaScript（GSAP）
const dot = document.querySelector('.custom-cursor-dot');
const outline = document.querySelector('.custom-cursor-outline');

// マウスが動いたときの処理
window.addEventListener('mousemove', (e) => {
    // 中央のドットは遅延なしで追従
    gsap.set(dot, {
        x: e.clientX,
        y: e.clientY
    });

    // 外側の円は「duration」を指定して滑らかに遅れて追従させる
    gsap.to(outline, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.3, // 遅延の長さ（数値を大きくするとより遅れる）
        ease: "power2.out"
    });
});

// リンクにホバーしたときにカーソルを大きくする演出
const links = document.querySelectorAll('a, button');
links.forEach(link => {
    link.addEventListener('mouseenter', () => {
        gsap.to(outline, { scale: 1.5, backgroundColor: "rgba(51,51,51,0.1)", duration: 0.2 });
    });
    link.addEventListener('mouseleave', () => {
        gsap.to(outline, { scale: 1, backgroundColor: "transparent", duration: 0.2 });
    });
});