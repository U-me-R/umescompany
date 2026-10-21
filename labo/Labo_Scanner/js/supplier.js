/* Labo. Scanner - 取引先の状況（発注側向け）。ドメインごとのスコア推移と最新の確認事項 */
(function () {
  'use strict';
  var L = window.Labo, R = window.LaboRender, el = L.el, sb = L.sb;
  var main = document.getElementById('main-content');

  function message(text) {
    main.textContent = '';
    main.appendChild(el('p', { class: 'scan-alert', role: 'alert', text: text }));
    main.appendChild(el('p', { class: 'form-actions' }, [el('a', { class: 'back-link', href: 'index.html', text: '← ダッシュボードへ戻る' })]));
  }

  (async function init() {
    var ctx;
    try { ctx = await L.requireContext(); } catch (e) { return; }
    L.mountHeader('home', ctx);

    var orgId = new URLSearchParams(location.search).get('org') || '';
    if (!/^[0-9a-f-]{36}$/i.test(orgId)) { message('取引先のIDが正しくありません。'); return; }

    var o = await sb.from('organizations').select('id,name').eq('id', orgId).maybeSingle();
    if (!o.data) { message('この取引先は表示できません（承認済みの接続がありません）。'); return; }

    var r = await sb.from('scans').select('id,domain_id,domain,score,findings,created_at').eq('org_id', orgId)
      .eq('status', 'completed').order('created_at', { ascending: true }).limit(1000);
    if (r.error) { message(L.errMsg(r.error)); return; }

    var byDomain = {};
    (r.data || []).forEach(function (s) { (byDomain[s.domain_id] = byDomain[s.domain_id] || []).push(s); });

    main.textContent = '';
    var blocks = [el('a', { class: 'back-link', href: 'index.html', text: '← ダッシュボードへ戻る' })];
    var ids = Object.keys(byDomain);
    if (!ids.length) blocks.push(el('p', { class: 'form-help', text: '完了したスキャンはまだありません。' }));

    ids.forEach(function (id) {
      var list = byDomain[id], last = list[list.length - 1];
      var rows = list.slice().reverse().map(function (s) {
        return el('tr', {}, [el('td', { text: L.fmtDate(s.created_at) }), el('td', {}, [R.scoreBadge(s.score)]),
          el('td', {}, [el('a', { class: 'table-link', href: 'result.html?id=' + encodeURIComponent(s.id), text: '結果' })])]);
      });
      blocks.push(el('div', { class: 'panel-box' }, [
        el('h3', { class: 'box-title', text: last.domain }),
        el('p', { class: 'form-help', text: '最新スコア: ' }),
        el('p', {}, [R.scoreBadge(last.score)]),
        el('h4', { class: 'subheading', text: 'スコアの推移' }),
        list.length >= 2 ? R.trendChart(list) : el('p', { class: 'form-help', text: '推移グラフは、2回目以降のスキャンから表示されます。' }),
        el('h4', { class: 'subheading', text: '最新の確認事項' }),
        R.severityCounts(last.findings), R.findingsList(last.findings),
        el('h4', { class: 'subheading', text: 'スキャン履歴' }),
        el('div', { class: 'table-wrap' }, [el('table', { class: 'data list-table' }, [
          el('thead', {}, [el('tr', {}, ['日時', 'スコア', ''].map(function (h) { return el('th', { scope: 'col', text: h }); }))]),
          el('tbody', {}, rows)])])
      ]));
    });

    main.appendChild(el('section', { 'aria-labelledby': 'partner-h' }, [
      el('h2', { id: 'partner-h', class: 'section-heading train_one' }, ['Partner.', el('span', { class: 'nomal', text: o.data.name })])
    ].concat(blocks)));
  })();
})();
