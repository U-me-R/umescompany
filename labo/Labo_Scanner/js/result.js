/* Labo. Scanner - スキャン結果（自社の担当者 / 承認済みの発注側が閲覧可能。可否はRLSが判定） */
(function () {
  'use strict';
  var L = window.Labo, R = window.LaboRender, el = L.el, sb = L.sb;
  var main = document.getElementById('main-content');

  function message(text, kind) {
    main.textContent = '';
    main.appendChild(el('p', { class: 'scan-alert' + (kind ? ' is-' + kind : ''), role: 'alert', text: text }));
    main.appendChild(el('p', { class: 'form-actions' }, [el('a', { class: 'back-link', href: 'index.html', text: '← ダッシュボードへ戻る' })]));
  }

  (async function init() {
    var ctx;
    try { ctx = await L.requireContext(); } catch (e) { return; }
    L.mountHeader('history', ctx);

    var id = new URLSearchParams(location.search).get('id') || '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) { message('結果のIDが正しくありません。', 'error'); return; }

    var s = await sb.from('scans').select('*').eq('id', id).maybeSingle();
    if (s.error) { message(L.errMsg(s.error), 'error'); return; }
    // 権限がない場合も「存在しない」と同じ表示にする（RLSで行が返らない）
    if (!s.data) { message('この結果は存在しないか、閲覧する権限がありません。'); return; }
    var scan = s.data;
    if (scan.status !== 'completed') {
      message(scan.status === 'failed' ? 'このスキャンは失敗しました。' : 'このスキャンはまだ完了していません（' + (scan.progress || 0) + '%）。再読み込みしてください。');
      return;
    }

    var parts = await Promise.all([
      sb.from('scan_raw').select('raw').eq('scan_id', id).maybeSingle(),   // 自社のみ（発注側には返らない）
      sb.from('scans').select('created_at,score').eq('domain_id', scan.domain_id).eq('status', 'completed')
        .order('created_at', { ascending: true }).limit(200)
    ]);

    var alertBox = el('div', { class: 'scan-alert', role: 'alert', 'aria-live': 'polite', hidden: '' });
    var area = el('div', { class: 'results-area' });
    main.textContent = '';
    main.appendChild(el('section', { 'aria-labelledby': 'result-h' }, [
      el('h2', { id: 'result-h', class: 'section-heading train_one' }, ['Result.', el('span', { class: 'nomal', text: 'スキャン結果' })]),
      el('a', { class: 'back-link', href: 'history.html', text: '← 履歴へ戻る' }), alertBox, area
    ]));

    R.renderResults(area, {
      scan: scan,
      raw: parts[0].data ? parts[0].data.raw : null,
      history: parts[1].data || [],
      onDownload: async function (b) {
        b.disabled = true;
        var r = await L.api('/api/scans/' + encodeURIComponent(id) + '/report');
        b.disabled = false;
        if (!r.ok) { L.showAlert(alertBox, (r.json && r.json.error) || 'レポートを取得できませんでした。', 'error'); return; }
        window.location.href = r.json.url;
      }
    });
  })();
})();
