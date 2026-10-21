/* Labo. Scanner - ダッシュボード
   組織が未作成: 組織の作成 / 取引先(supplier): 接続の承認・ドメイン登録・スキャン / 発注側(buyer): 招待・取引先の状況・ドメイン */
(function () {
  'use strict';
  var L = window.Labo, R = window.LaboRender, el = L.el, sb = L.sb;
  var main = document.getElementById('main-content');
  var ctx, pageAlert;

  function section(id, en, ja, children) {
    return el('section', { id: id, 'aria-labelledby': id + '-h' }, [
      el('h2', { id: id + '-h', class: 'section-heading train_one' }, [en, el('span', { class: 'nomal', text: ja })])
    ].concat(children));
  }
  function note(text) { return el('p', { class: 'form-help', text: text }); }
  function box(children) { return el('div', { class: 'panel-box' }, children); }
  function btn(text, cls, onClick) {
    var b = el('button', { type: 'button', class: cls || 'btn-secondary', text: text });
    b.addEventListener('click', function () { onClick(b); });
    return b;
  }
  function tableOf(headers, rows) {
    var head = el('thead', {}, [el('tr', {}, headers.map(function (h) { return el('th', { scope: 'col', text: h }); }))]);
    return el('div', { class: 'table-wrap' }, [el('table', { class: 'data list-table' }, [head, el('tbody', {}, rows)])]);
  }
  function say(msg, kind) { L.showAlert(pageAlert, msg, kind); pageAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }

  // 組織の作成
  function renderOnboarding() {
    var name = el('input', { type: 'text', id: 'org-name', class: 'form-input', maxlength: '100', required: '', placeholder: '例）株式会社〇〇' });
    function choice(value, title, desc, checked) {
      var input = el('input', { type: 'radio', name: 'org-type', value: value, checked: checked ? '' : false });
      return el('label', { class: 'choice' }, [input, el('span', {}, [el('strong', { text: title }), el('small', { text: desc })])]);
    }
    var submit = el('button', { type: 'submit', class: 'btn-primary', text: '組織を作成' });
    var form = el('form', { class: 'scan-form', id: 'org-form' }, [
      el('span', { class: 'form-label', text: '組織の種類' }),
      el('div', { class: 'choices' }, [
        choice('supplier', '取引先（中小企業・下請け側）', '自社の外部公開状況を確認し、改善に役立てたい', true),
        choice('buyer', '発注側（大企業）', '招待した取引先のスコアと改善の推移を確認したい', false)
      ]),
      note('※ 種類はあとから変更できません。'),
      el('label', { for: 'org-name', class: 'form-label', text: '組織名' }), name,
      el('div', { class: 'form-actions' }, [submit])
    ]);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var type = form.querySelector('input[name="org-type"]:checked').value, nm = name.value.trim();
      if (!nm) { say('組織名を入力してください。', 'error'); return; }
      submit.disabled = true;
      var r = await sb.rpc('create_organization', { p_name: nm, p_type: type });
      if (r.error) { say(L.errMsg(r.error), 'error'); submit.disabled = false; return; }
      location.reload();
    });
    return section('onboarding', 'Welcome.', 'はじめに組織を作成してください', [el('div', { class: 'scan-form-container' }, [form])]);
  }

  // 接続（取引先側: 承認・コードの入力 / 発注側: 招待の発行）
  async function loadConnections() {
    var col = ctx.org.type === 'supplier' ? 'supplier_org_id' : 'buyer_org_id';
    var r = await sb.from('connections')
      .select('id,status,created_at,approved_at,buyer:organizations!buyer_org_id(id,name),supplier:organizations!supplier_org_id(id,name)')
      .eq(col, ctx.org.id).neq('status', 'revoked').order('created_at', { ascending: false });
    if (r.error) throw r.error;
    return r.data || [];
  }

  async function setStatus(id, status, okMsg) {
    var r = await sb.rpc('set_connection_status', { p_conn: id, p_status: status });
    if (r.error) { say(L.errMsg(r.error), 'error'); return; }
    say(okMsg, 'success');
    await refreshAll();
  }

  function supplierConnections(conns) {
    var pending = conns.filter(function (c) { return c.status === 'pending'; });
    var active = conns.filter(function (c) { return c.status === 'active'; });
    var nodes = [];

    pending.forEach(function (c) {
      var name = c.buyer ? c.buyer.name : '発注側の組織';
      nodes.push(box([
        el('h3', { class: 'box-title', text: name + ' からの接続の確認' }),
        el('p', { class: 'consent-text', text: '承認すると、' + name + ' は、貴社の「完了済みのスキャン結果（スコア・確認事項・スコアの推移）」を閲覧できるようになります。過去の結果も含まれます。技術的な生データ（DNSレコードなど）は共有されません。共有は、いつでも解除できます。' }),
        el('div', { class: 'row-actions' }, [
          btn('承認して共有する', 'btn-primary', function () { setStatus(c.id, 'active', name + ' との共有を開始しました。'); }),
          btn('承認しない', 'btn-secondary', function () { setStatus(c.id, 'revoked', '接続を見送りました。'); })
        ])
      ]));
    });

    var redeemIn = el('input', { type: 'text', id: 'invite-code', class: 'form-input', maxlength: '32', autocomplete: 'off', placeholder: '招待コード（16文字）' });
    var redeemBtn = el('button', { type: 'submit', class: 'btn-primary', text: 'コードを使う' });
    var redeemForm = el('form', { class: 'inline-form', id: 'redeem-form' }, [
      el('label', { for: 'invite-code', class: 'form-label', text: '発注側から招待コードを受け取った場合' }), redeemIn, redeemBtn]);
    redeemForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!redeemIn.value.trim()) return;
      redeemBtn.disabled = true;
      var r = await sb.rpc('redeem_invitation', { p_code: redeemIn.value.trim(), p_supplier_org: ctx.org.id });
      redeemBtn.disabled = false;
      if (r.error) { say(L.errMsg(r.error), 'error'); return; }
      say('招待コードを確認しました。内容をよく読み、「承認して共有する」を押すと共有が始まります（押すまでは何も共有されません）。', 'success');
      await refreshAll();
    });
    nodes.push(box([redeemForm]));

    if (active.length) {
      nodes.push(box([el('h3', { class: 'box-title', text: '結果を共有している発注側' }), tableOf(['発注側', '共有開始', ''], active.map(function (c) {
        return el('tr', {}, [el('td', { text: c.buyer ? c.buyer.name : '—' }), el('td', { text: L.fmtDate(c.approved_at) }),
          el('td', {}, [btn('共有を解除', 'btn-secondary', function () {
            if (confirm((c.buyer ? c.buyer.name : '発注側') + ' への共有を解除しますか？ 解除後は、相手は結果を見られなくなります。')) setStatus(c.id, 'revoked', '共有を解除しました。');
          })])]);
      }))]));
    }
    return section('connections', 'Sharing.', '発注側との共有', nodes);
  }

  var scanData = [];   // 取引先の状況表示用

  async function buyerConnections(conns) {
    var nodes = [];
    var codeBox = el('div', { class: 'code-box', hidden: '' });
    var days = el('select', { id: 'invite-days', class: 'form-input' }, [
      el('option', { value: '7', text: '7日間' }), el('option', { value: '14', text: '14日間', selected: '' }), el('option', { value: '30', text: '30日間' })]);
    var issue = btn('招待コードを発行', 'btn-primary', async function (b) {
      b.disabled = true;
      var r = await sb.rpc('create_invitation', { p_buyer_org: ctx.org.id, p_valid_days: Number(days.value) });
      b.disabled = false;
      if (r.error) { say(L.errMsg(r.error), 'error'); return; }
      codeBox.textContent = '';
      var copy = btn('コピー', 'btn-secondary', function () {
        if (navigator.clipboard) navigator.clipboard.writeText(r.data).then(function () { copy.textContent = 'コピーしました'; });
      });
      codeBox.appendChild(el('strong', { class: 'code', text: r.data }));
      codeBox.appendChild(copy);
      codeBox.appendChild(el('small', { text: 'このコードは今だけ表示されます（再表示できません）。取引先へ安全な方法で伝えてください。取引先が承認するまでは、何も共有されません。' }));
      codeBox.hidden = false;
      await refreshInvitations();
    });
    var invitesHolder = el('div', { id: 'invites-holder' });
    nodes.push(box([el('h3', { class: 'box-title', text: '取引先を招待する' }),
      el('div', { class: 'inline-form' }, [el('label', { for: 'invite-days', class: 'form-label', text: '有効期間' }), days, issue]), codeBox, invitesHolder]));
    nodes.push(el('div', { id: 'partners-holder' }));
    return { node: section('connections', 'Partners.', '取引先の招待と状況', nodes), conns: conns };
  }

  async function refreshInvitations() {
    var holder = document.getElementById('invites-holder');
    if (!holder) return;
    var r = await sb.from('invitations').select('id,expires_at,used_at,created_at').order('created_at', { ascending: false }).limit(10);
    holder.textContent = '';
    if (r.error || !r.data.length) return;
    holder.appendChild(el('h4', { class: 'subheading', text: '発行した招待' }));
    holder.appendChild(tableOf(['発行日時', '状態', '有効期限'], r.data.map(function (i) {
      var st = i.used_at ? '使用済み' : (new Date(i.expires_at) < new Date() ? '期限切れ' : '有効');
      return el('tr', {}, [el('td', { text: L.fmtDate(i.created_at) }), el('td', { text: st }), el('td', { text: L.fmtDate(i.expires_at) })]);
    })));
  }

  async function renderPartners(conns) {
    var holder = document.getElementById('partners-holder');
    if (!holder) return;
    holder.textContent = '';
    var activeIds = conns.filter(function (c) { return c.status === 'active'; }).map(function (c) { return c.supplier.id; });
    var scans = [];
    if (activeIds.length) {
      var r = await sb.from('scans').select('id,org_id,domain_id,domain,score,created_at').eq('status', 'completed')
        .in('org_id', activeIds).order('created_at', { ascending: true }).limit(1000);
      if (r.error) throw r.error;
      scans = r.data || [];
    }
    var byDomain = {};
    scans.forEach(function (s) { (byDomain[s.domain_id] = byDomain[s.domain_id] || []).push(s); });

    var rows = [];
    conns.forEach(function (c) {
      var name = c.supplier ? c.supplier.name : '（承認待ち）';
      if (c.status === 'pending') {
        rows.push(el('tr', {}, [el('td', { text: name }), el('td', { text: '—' }), el('td', { text: '承認待ち（取引先が承認すると共有されます）', colspan: '4' })]));
        return;
      }
      var doms = Object.keys(byDomain).filter(function (id) { return byDomain[id][0].org_id === c.supplier.id; });
      if (!doms.length) {
        rows.push(el('tr', {}, [el('td', { text: name }), el('td', { text: '—' }), el('td', { text: '共有中・完了したスキャンはまだありません', colspan: '3' }),
          el('td', {}, [btn('共有を解除', 'btn-secondary', function () { revokeAsBuyer(c); })])]));
        return;
      }
      doms.forEach(function (id) {
        var list = byDomain[id], last = list[list.length - 1];
        rows.push(el('tr', {}, [
          el('td', { text: name }), el('td', { text: last.domain }),
          el('td', {}, [R.scoreBadge(last.score)]),
          el('td', {}, [R.sparkline(list.map(function (s) { return s.score; }))]),
          el('td', { text: L.fmtDate(last.created_at) }),
          el('td', {}, [el('a', { class: 'table-link', href: 'supplier.html?org=' + encodeURIComponent(c.supplier.id), text: '詳細' })])
        ]));
      });
    });
    holder.appendChild(box([el('h3', { class: 'box-title', text: '取引先の状況' }),
      rows.length ? tableOf(['取引先', 'ドメイン', '最新スコア', '推移', '最終スキャン', ''], rows)
                  : note('まだ取引先がありません。招待コードを発行して、取引先に伝えてください。')]));
  }

  function revokeAsBuyer(c) {
    if (confirm((c.supplier ? c.supplier.name : '取引先') + ' との接続を解除しますか？ 解除後は結果を見られなくなり、再開には新しい招待が必要です。')) {
      setStatus(c.id, 'revoked', '接続を解除しました。');
    }
  }

  // ============================================================
  // ドメイン（共通）: 登録 / スキャン / 削除
  // ============================================================
  var running = {};   // domain_id -> stop関数

  async function loadDomains() {
    var d = await sb.from('domains').select('id,domain,created_at').eq('org_id', ctx.org.id).order('created_at', { ascending: true });
    if (d.error) throw d.error;
    var s = await sb.from('scans').select('id,domain_id,status,progress,message,score,created_at,finished_at')
      .eq('org_id', ctx.org.id).order('created_at', { ascending: false }).limit(300);
    if (s.error) throw s.error;
    var latest = {};
    (s.data || []).forEach(function (x) {
      var o = latest[x.domain_id] = latest[x.domain_id] || {};
      if (!o.any) o.any = x;
      if (!o.done && x.status === 'completed') o.done = x;
    });
    return { domains: d.data || [], latest: latest };
  }

  function statusCell(d, info) {
    var any = info && info.any, done = info && info.done;
    var cell = el('td', { class: 'status-cell' });
    if (any && (any.status === 'queued' || any.status === 'running')) {
      var prog = el('progress', { class: 'scan-progress', value: String(any.progress || 0), max: '100', 'aria-label': 'スキャン進捗' });
      var msg = el('small', { class: 'form-help', text: any.message || '実行中…' });
      cell.appendChild(prog); cell.appendChild(msg);
      cell.dataset.progressFor = d.id;
      return cell;
    }
    if (done) {
      cell.appendChild(R.scoreBadge(done.score));
      cell.appendChild(el('small', { class: 'form-help', text: ' ' + L.fmtDate(done.finished_at || done.created_at) }));
    } else cell.appendChild(el('span', { text: '未実行' }));
    if (any && any.status === 'failed') cell.appendChild(el('small', { class: 'form-help', text: '　直近のスキャンは失敗しました' }));
    return cell;
  }

  function trackScan(domainId, scanId) {
    if (running[domainId]) return;
    running[domainId] = L.watchScan(scanId, function (row) {
      var cell = document.querySelector('[data-progress-for="' + domainId + '"]');
      if (cell && (row.status === 'queued' || row.status === 'running')) {
        cell.querySelector('progress').value = row.progress || 0;
        cell.querySelector('small').textContent = row.message || '実行中…';
      }
      if (row.status === 'completed' || row.status === 'failed') {
        delete running[domainId];
        say(row.status === 'completed' ? row.domain + ' のスキャンが完了しました。「結果」から確認できます。' : (row.error || 'スキャンに失敗しました。'),
          row.status === 'completed' ? 'success' : 'error');
        renderDomains();
      }
    });
  }

  async function startScan(d, b) {
    b.disabled = true;
    var r = await L.api('/api/scans', { method: 'POST', body: { domain_id: d.id } });
    if (!r.ok) { say((r.json && r.json.error) || 'スキャンを開始できませんでした。', 'error'); b.disabled = false; return; }
    say(d.domain + ' のスキャンを開始しました。', 'success');
    await renderDomains(r.json.scan_id, d.id);
  }

  async function renderDomains(newScanId, newDomainId) {
    var holder = document.getElementById('domains-holder');
    var data = await loadDomains();
    holder.textContent = '';

    var rows = data.domains.map(function (d) {
      var info = data.latest[d.id], any = info && info.any, done = info && info.done;
      var isRunning = any && (any.status === 'queued' || any.status === 'running');
      var actions = el('td', { class: 'row-actions' });
      var scanBtn = btn(isRunning ? '実行中…' : 'スキャン開始', 'btn-secondary', function (b) { startScan(d, b); });
      if (isRunning) scanBtn.disabled = true;
      actions.appendChild(scanBtn);
      if (done) actions.appendChild(el('a', { class: 'table-link', href: 'result.html?id=' + encodeURIComponent(done.id), text: '結果' }));
      if (ctx.role === 'owner') {
        actions.appendChild(btn('削除', 'btn-secondary btn-danger', async function () {
          if (!confirm(d.domain + ' を削除しますか？ このドメインのスキャン履歴もすべて削除され、元に戻せません。')) return;
          var r = await sb.from('domains').delete().eq('id', d.id);
          if (r.error) say(L.errMsg(r.error), 'error'); else { say(d.domain + ' を削除しました。', 'success'); renderDomains(); }
        }));
      }
      if (isRunning) trackScan(d.id, any.id);
      return el('tr', {}, [el('td', { text: d.domain }), statusCell(d, info), actions]);
    });
    if (newScanId && newDomainId) {
      // 開始直後は、取得済みの一覧に新しい行がまだ無いことがあるため、確実に追跡を開始する
      trackScan(newDomainId, newScanId);
    }

    // 登録フォーム
    var domIn = el('input', { type: 'text', id: 'domain-input', class: 'form-input', placeholder: 'example.co.jp', autocomplete: 'off', spellcheck: 'false', inputmode: 'url', required: '' });
    var consent = el('input', { type: 'checkbox', id: 'consent-input', required: '' });
    var addBtn = el('button', { type: 'submit', class: 'btn-primary', text: 'ドメインを登録' });
    var form = el('form', { class: 'scan-form', id: 'domain-form' }, [
      el('label', { for: 'domain-input', class: 'form-label', text: 'スキャン対象のドメイン' }), domIn,
      note('公開DNS・WHOIS・SSL/TLS・Webの応答ヘッダーなど、外部から確認できる情報を調べます。ポートスキャンや脆弱性の試行は行いません。'),
      el('label', { class: 'form-consent' }, [consent, el('span', { text: L.CONSENT_TEXT })]),
      el('div', { class: 'form-actions' }, [addBtn])
    ]);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var domain = L.normalizeDomain(domIn.value);
      domIn.value = domain;
      if (!L.isValidDomain(domain)) { say('ドメインの形式が正しくありません（例: example.co.jp）。', 'error'); return; }
      if (!consent.checked) { say('同意にチェックを入れてください。', 'error'); return; }
      addBtn.disabled = true;
      var r = await sb.from('domains').insert({ org_id: ctx.org.id, domain: domain, consent_at: new Date().toISOString(),
        consent_by: ctx.user.id, consent_text_version: L.CONSENT_VERSION });
      addBtn.disabled = false;
      if (r.error) { say(L.errMsg(r.error), 'error'); return; }
      say(domain + ' を登録しました。', 'success');
      renderDomains();
    });

    holder.appendChild(box([el('h3', { class: 'box-title', text: '登録済みのドメイン' }),
      rows.length ? tableOf(['ドメイン', '最新の状態', ''], rows) : note('まだドメインが登録されていません。下のフォームから登録してください。')]));
    holder.appendChild(el('div', { class: 'scan-form-container' }, [form]));
  }

  // ============================================================
  // 全体
  // ============================================================
  async function refreshAll() {
    var conns = await loadConnections();
    var holder = document.getElementById('connections-holder');
    holder.textContent = '';
    if (ctx.org.type === 'supplier') {
      holder.appendChild(supplierConnections(conns));
    } else {
      var b = await buyerConnections(conns);
      holder.appendChild(b.node);
      await refreshInvitations();
      await renderPartners(conns);
    }
  }

  (async function init() {
    try { ctx = await L.requireContext(); } catch (e) { if (e && e.message !== 'redirecting' && e.message !== 'not configured') main.textContent = L.errMsg(e); return; }
    L.mountHeader('home', ctx);
    main.textContent = '';
    pageAlert = el('div', { class: 'scan-alert', role: 'alert', 'aria-live': 'polite', hidden: '' });
    main.appendChild(pageAlert);

    if (!ctx.org) { main.appendChild(renderOnboarding()); return; }

    var domainSection = section('domains', 'Domains.', '自社のドメインとスキャン', [el('div', { id: 'domains-holder' })]);
    main.appendChild(el('div', { id: 'connections-holder' }));
    main.appendChild(domainSection);
    try {
      await refreshAll();
      await renderDomains();
    } catch (e) { say(L.errMsg(e), 'error'); }
  })();
})();
