/* Labo. Scanner - スキャン履歴（自社の分 + 承認済みの取引先の完了分。範囲はRLSが決める） */
(function () {
  'use strict';
  var L = window.Labo, R = window.LaboRender, el = L.el, sb = L.sb;
  var main = document.getElementById('main-content');
  var STATUS = { queued: '待機中', running: '実行中', completed: '完了', failed: '失敗' };

  (async function init() {
    var ctx;
    try { ctx = await L.requireContext(); } catch (e) { return; }
    L.mountHeader('history', ctx);
    main.textContent = '';

    var holder = el('div', { class: 'panel-box' }, [el('p', { class: 'form-help', text: '読み込み中…' })]);
    main.appendChild(el('section', { 'aria-labelledby': 'history-h' }, [
      el('h2', { id: 'history-h', class: 'section-heading train_one' }, ['History.', el('span', { class: 'nomal', text: 'スキャン履歴' })]),
      holder,
      el('p', { class: 'history-note', text: '自社のスキャンに加え、共有を承認している取引先の完了済みスキャンが表示されます。' })
    ]));

    var r = await sb.from('scans').select('id,org_id,domain,status,score,created_at').order('created_at', { ascending: false }).limit(200);
    holder.textContent = '';
    if (r.error) { holder.appendChild(el('p', { class: 'form-help', text: L.errMsg(r.error) })); return; }
    if (!r.data.length) { holder.appendChild(el('p', { class: 'form-help', text: 'スキャン履歴はまだありません。ダッシュボードからスキャンを実行してください。' })); return; }

    var o = await sb.from('organizations').select('id,name');
    var names = {};
    (o.data || []).forEach(function (x) { names[x.id] = x.name; });
    var mine = ctx.org && ctx.org.id;

    var head = el('thead', {}, [el('tr', {}, ['日時', '組織', 'ドメイン', '状態', 'スコア', ''].map(function (h) { return el('th', { scope: 'col', text: h }); }))]);
    var rows = r.data.map(function (s) {
      return el('tr', {}, [
        el('td', { text: L.fmtDate(s.created_at) }),
        el('td', { text: s.org_id === mine ? '自社' : (names[s.org_id] || '—') }),
        el('td', { text: s.domain }),
        el('td', { text: STATUS[s.status] || s.status }),
        el('td', {}, [R.scoreBadge(s.score)]),
        el('td', {}, [s.status === 'completed' ? el('a', { class: 'table-link', href: 'result.html?id=' + encodeURIComponent(s.id), text: '結果' }) : null])
      ]);
    });
    holder.appendChild(el('div', { class: 'table-wrap' }, [el('table', { class: 'data list-table' }, [head, el('tbody', {}, rows)])]));
  })();
})();
