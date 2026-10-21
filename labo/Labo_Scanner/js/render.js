/* Labo. Scanner - 結果の描画（スコア・確認事項・推移グラフ） */
(function () {
  'use strict';

  var el = window.Labo.el;
  var SEV_ORDER = { high: 0, medium: 1, low: 2, info: 3 };
  var SEV_LABEL = { high: '高', medium: '中', low: '低', info: '情報' };
  var SVG_NS = 'http://www.w3.org/2000/svg';

  // PDFレポートと同じ区分（pdf_generator.py の _score_band と揃えている）
  function band(score) {
    if (score >= 80) return { label: '良好', color: '#8fbf9f' };
    if (score >= 60) return { label: '軽度のリスク', color: '#d4b246' };
    if (score >= 40) return { label: '要注意', color: '#e0a14e' };
    return { label: '高リスク', color: '#e07a6e' };
  }

  function scoreBadge(score) {
    if (score === null || score === undefined) return el('span', { text: '—' });
    var b = band(Number(score));
    var s = el('span', { class: 'score-chip', text: score + '　' + b.label });
    s.style.color = b.color;
    return s;
  }

  function fmt(v) {
    if (v === null || v === undefined || v === '') return '—';
    if (Array.isArray(v)) return v.length ? v.map(fmt).join('\n') : '—';
    if (typeof v === 'object') return Object.keys(v).map(function (k) { return k + ': ' + v[k]; }).join(', ');
    return String(v);
  }

  function table(rows) {
    var body = el('tbody');
    rows.forEach(function (r) {
      body.appendChild(el('tr', {}, [el('th', { scope: 'row', text: r[0] }), el('td', { text: fmt(r[1]) })]));
    });
    return el('div', { class: 'table-wrap' }, [el('table', { class: 'data' }, [body])]);
  }

  // ---------- SVG ----------
  function ns(tag, attrs, children) {
    var n = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    (children || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }
  function svgText(x, y, text, attrs) {
    var t = ns('text', Object.assign({ x: x, y: y }, attrs || {}));
    t.textContent = text;
    return t;
  }
  function shortDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : (d.getMonth() + 1) + '/' + d.getDate();
  }

  /** points: [{created_at, score}]（古い順）。スコア推移の折れ線グラフ */
  function trendChart(points) {
    var W = 640, H = 240, P = { l: 40, r: 18, t: 14, b: 34 };
    var iw = W - P.l - P.r, ih = H - P.t - P.b;
    var svg = ns('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'trend-chart', role: 'img',
      'aria-label': 'スコア推移グラフ（' + points.length + '回分）' });
    var y = function (s) { return P.t + ih - (s / 100) * ih; };

    [0, 40, 60, 80, 100].forEach(function (g) {
      svg.appendChild(ns('line', { x1: P.l, x2: W - P.r, y1: y(g), y2: y(g), class: 'chart-grid' }));
      svg.appendChild(svgText(P.l - 8, y(g) + 4, String(g), { class: 'chart-label', 'text-anchor': 'end' }));
    });

    var times = points.map(function (p) { return new Date(p.created_at).getTime(); });
    var t0 = Math.min.apply(null, times), t1 = Math.max.apply(null, times);
    var x = function (t) { return t1 === t0 ? P.l + iw / 2 : P.l + ((t - t0) / (t1 - t0)) * iw; };

    var pts = points.map(function (p, i) { return x(times[i]) + ',' + y(p.score); }).join(' ');
    if (points.length > 1) svg.appendChild(ns('polyline', { points: pts, class: 'chart-line' }));

    points.forEach(function (p, i) {
      var c = ns('circle', { cx: x(times[i]), cy: y(p.score), r: 5, class: 'chart-dot' });
      c.setAttribute('fill', band(p.score).color);
      var title = ns('title'); title.textContent = shortDate(p.created_at) + '：' + p.score + '点';
      c.appendChild(title);
      svg.appendChild(c);
    });

    svg.appendChild(svgText(P.l, H - 8, shortDate(points[0].created_at), { class: 'chart-label' }));
    if (points.length > 1) {
      svg.appendChild(svgText(W - P.r, H - 8, shortDate(points[points.length - 1].created_at), { class: 'chart-label', 'text-anchor': 'end' }));
    }
    return el('div', { class: 'chart-wrap' }, [svg]);
  }

  /** 一覧用の小さな推移線 */
  function sparkline(values) {
    var W = 110, H = 30;
    var svg = ns('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'sparkline', role: 'img', 'aria-label': 'スコア推移' });
    if (values.length < 2) { svg.appendChild(svgText(0, 20, '—', { class: 'chart-label' })); return svg; }
    var pts = values.map(function (v, i) { return (i / (values.length - 1)) * (W - 8) + 4 + ',' + (H - 4 - (v / 100) * (H - 8)); }).join(' ');
    svg.appendChild(ns('polyline', { points: pts, class: 'chart-line' }));
    return svg;
  }

  // ---------- 結果 ----------
  function techDetails(raw) {
    var box = el('details', { class: 'tech-details' }, [el('summary', { text: '技術詳細（担当エンジニア向け）' })]);
    var dns = raw.dns || {}, ssl = raw.ssl || {}, web = raw.web || {}, whois = raw.whois || {};

    var dnsRows = Object.keys(dns).filter(function (k) { return dns[k] && dns[k].length; })
      .map(function (k) { return [k, dns[k]]; });
    box.appendChild(el('h4', { class: 'subheading', text: 'DNS' }));
    box.appendChild(dnsRows.length ? table(dnsRows) : el('p', { class: 'form-help', text: 'DNSレコードを取得できませんでした。' }));

    box.appendChild(el('h4', { class: 'subheading', text: 'SSL / TLS' }));
    box.appendChild(ssl.error
      ? el('p', { class: 'form-help', text: '取得できませんでした: ' + ssl.error })
      : table([['TLSバージョン', ssl.tls_version], ['暗号スイート', ssl.cipher],
               ['有効期限まで（日）', ssl.days_until_expiry], ['発行者', ssl.issuer], ['対象', ssl.subject]]));

    box.appendChild(el('h4', { class: 'subheading', text: 'Web' }));
    var webRows = Object.keys(web).map(function (p) {
      var w = web[p] || {};
      return [p.toUpperCase(), w.error ? '接続できません（' + w.error + '）'
        : 'ステータス ' + w.status_code + ' / Server: ' + w.server + ' / ' + (w.title || '')];
    });
    box.appendChild(webRows.length ? table(webRows) : el('p', { class: 'form-help', text: '取得できませんでした。' }));

    box.appendChild(el('h4', { class: 'subheading', text: 'WHOIS' }));
    box.appendChild(whois.error
      ? el('p', { class: 'form-help', text: '取得できませんでした（.jp などのドメインでは失敗することがあります）。' })
      : table([['登録事業者', whois.registrar], ['登録日', whois.creation_date],
               ['有効期限', whois.expiration_date], ['ネームサーバー', whois.name_servers]]));
    return box;
  }

  function findingsList(findings) {
    var sorted = (findings || []).slice().sort(function (a, c) {
      var A = SEV_ORDER[a.severity], C = SEV_ORDER[c.severity];
      return (A === undefined ? 3 : A) - (C === undefined ? 3 : C);
    });
    if (!sorted.length) return el('p', { class: 'empty-state', text: '外部から確認できる範囲で、重大な確認事項は見つかりませんでした。' });
    var list = el('div', { class: 'finding-list' });
    sorted.forEach(function (f) {
      var sev = SEV_ORDER[f.severity] === undefined ? 'info' : f.severity;
      list.appendChild(el('details', { class: 'finding sev-' + sev }, [
        el('summary', {}, [
          el('span', { class: 'badge sev-' + sev, text: SEV_LABEL[sev] }),
          el('span', { class: 'finding-title', text: f.title || '' }),
          el('span', { class: 'finding-category', text: f.category || '' })
        ]),
        el('dl', { class: 'finding-body' }, [
          el('dt', { text: '内容' }), el('dd', { text: f.detail || '—' }),
          el('dt', { text: '改善のヒント' }), el('dd', { text: f.remediation || '—' })
        ])
      ]));
    });
    return list;
  }

  function severityCounts(findings) {
    var counts = { high: 0, medium: 0, low: 0, info: 0 };
    (findings || []).forEach(function (f) { if (counts[f.severity] !== undefined) counts[f.severity]++; });
    var sum = el('div', { class: 'sev-summary' });
    Object.keys(counts).forEach(function (k) {
      sum.appendChild(el('span', { class: 'badge sev-' + k, text: SEV_LABEL[k] + ' ' + counts[k] + '件' }));
    });
    return sum;
  }

  /**
   * d = { scan, raw, history, onDownload }
   *   scan: scansの1行 / raw: scan_rawのraw（自社のみ。無ければnull）
   *   history: 同じドメインの完了済みスキャン [{created_at, score}]（古い順）
   *   onDownload: PDFボタンの処理（PDFがあるときだけ表示）
   */
  function renderResults(container, d) {
    var scan = d.scan, score = Number(scan.score || 0), b = band(score);
    container.textContent = '';

    var ring = el('div', { class: 'score-ring', role: 'img', 'aria-label': 'スコア ' + score + ' / 100（' + b.label + '）' }, [
      el('div', {}, [el('span', { class: 'score-num train_one', text: String(score) }), el('span', { class: 'score-max', text: '/ 100' })])
    ]);
    ring.style.setProperty('--pct', String(Math.max(0, Math.min(100, score))));
    ring.style.setProperty('--ring', b.color);

    var actions = el('div', { class: 'result-actions' });
    if (scan.pdf_path && d.onDownload) {
      var btn = el('button', { type: 'button', class: 'btn-primary', text: 'PDFレポートを保存' });
      btn.addEventListener('click', function () { d.onDownload(btn); });
      actions.appendChild(btn);
    }

    var band_p = el('p', { class: 'result-band', text: '判定: ' + b.label });
    band_p.style.setProperty('--ring-text', b.color);
    container.appendChild(el('div', { class: 'result-head' }, [ring, el('div', { class: 'result-meta' }, [
      el('h3', { class: 'train_one', text: scan.domain }),
      band_p,
      el('p', { class: 'result-note', text: '評価日時: ' + window.Labo.fmtDate(scan.finished_at || scan.created_at) +
        '　|　簡易スコア（Ume\u2019sCompany独自。SCS評価制度の評価結果ではありません）' }),
      actions
    ])]));

    container.appendChild(severityCounts(scan.findings));

    container.appendChild(el('h4', { class: 'subheading', text: 'スコアの推移' }));
    if (d.history && d.history.length >= 2) container.appendChild(trendChart(d.history));
    else container.appendChild(el('p', { class: 'form-help', text: '推移グラフは、2回目以降のスキャンから表示されます。' }));

    container.appendChild(el('h4', { class: 'subheading', text: '確認事項（' + (scan.findings || []).length + '件）' }));
    container.appendChild(findingsList(scan.findings));

    if (d.raw) container.appendChild(techDetails(d.raw));
  }

  window.LaboRender = {
    renderResults: renderResults, band: band, scoreBadge: scoreBadge, trendChart: trendChart,
    sparkline: sparkline, findingsList: findingsList, severityCounts: severityCounts
  };
})();
