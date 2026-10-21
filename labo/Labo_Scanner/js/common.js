/* Labo. Scanner - 共通処理（Supabaseクライアント / 認証 / ヘッダー / API呼び出し） */
(function () {
  'use strict';

  var C = window.LABO_CONFIG || {};
  var API = (C.API_BASE || '').replace(/\/$/, '');
  var configured = !/YOUR-/.test((C.SUPABASE_URL || '') + (C.SUPABASE_ANON_KEY || ''));

  var sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  // ---------- DOM ヘルパー（innerHTMLは使わない。値は必ず textContent 経由） ----------
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'class') node.className = attrs[k];
      else if (attrs[k] !== false && attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function showAlert(box, msg, kind) {
    box.textContent = msg;
    box.className = 'scan-alert' + (kind ? ' is-' + kind : '');
    box.hidden = false;
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' });
  }

  // ---------- 入力 ----------
  var DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;   // DBの制約と同じ
  function normalizeDomain(raw) {
    return String(raw || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/[\/?#].*$/, '').replace(/\.$/, '');
  }
  function isValidDomain(d) { return d.length <= 253 && DOMAIN_RE.test(d); }

  // ---------- エラー文言 ----------
  function errMsg(e) {
    if (!e) return '';
    var m = String(e.message || '');
    if (/invalid_or_expired_invitation/.test(m)) return '招待コードが無効、または期限切れです。発行元に再発行を依頼してください。';
    if (/forbidden|42501|permission denied|row-level security/i.test(m + (e.code || ''))) return 'この操作を行う権限がありません。';
    if (e.code === '23505') return 'すでに登録されています。';
    if (e.code === '23514') return '入力内容の形式が正しくありません。';
    if (/JWT|expired/i.test(m)) return 'ログインの有効期限が切れました。再度ログインしてください。';
    return '処理に失敗しました。時間をおいて再度お試しください。';
  }

  // ---------- 認証・コンテキスト ----------
  async function getSession() {
    var r = await sb.auth.getSession();
    return r.data.session;
  }

  function showConfigError() {
    var main = document.getElementById('main-content') || document.body;
    main.textContent = '';
    main.appendChild(el('p', { class: 'scan-alert is-error', role: 'alert',
      text: 'js/config.js の SUPABASE_URL / SUPABASE_ANON_KEY / API_BASE が未設定です。' }));
  }

  /** ログイン必須のページ用。未ログインならログイン画面へ。組織が未作成でも org は null で返る */
  async function requireContext() {
    if (!configured) { showConfigError(); throw new Error('not configured'); }
    var session = await getSession();
    if (!session) {
      var next = location.pathname.split('/').pop() + location.search;
      location.replace('login.html?next=' + encodeURIComponent(next));
      throw new Error('redirecting');
    }
    var r = await sb.from('memberships').select('role, organizations(id,name,type)').order('created_at', { ascending: true });
    if (r.error) throw r.error;
    var m = (r.data || [])[0];
    return { session: session, user: session.user, org: m ? m.organizations : null, role: m ? m.role : null };
  }

  /** バックエンド(Render)のAPIを、ログイン中のトークン付きで呼ぶ */
  async function api(path, opts) {
    opts = opts || {};
    var session = await getSession();
    if (!session) { location.replace('login.html'); return { ok: false, status: 401, json: {} }; }
    var headers = { Authorization: 'Bearer ' + session.access_token };
    if (opts.body) headers['Content-Type'] = 'application/json';
    var res;
    try {
      res = await fetch(API + path, { method: opts.method || 'GET', headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined });
    } catch (e) {
      return { ok: false, status: 0, json: { error: 'サーバーに接続できません。サーバーの起動に時間がかかっている場合があります。30秒ほど待ってからもう一度お試しください。' } };
    }
    var json = {};
    try { json = await res.json(); } catch (e) { /* 本文なし */ }
    return { ok: res.ok, status: res.status, json: json };
  }

  // ---------- ヘッダー ----------
  var NAV = [
    ['index.html', 'Home.', 'ダッシュボード', 'home'],
    ['history.html', 'History.', 'スキャン履歴', 'history'],
    ['https://umescompany.com/labo/', 'Labo.', 'プロジェクト一覧', 'labo']
  ];
  var ORG_TYPE = { buyer: '発注側（大企業）', supplier: '取引先（中小企業など）' };

  function mountHeader(active, ctx) {
    var h = document.getElementById('site-header');
    h.textContent = '';
    h.appendChild(el('a', { class: 'company_logo', href: 'https://umescompany.com/', 'aria-label': "Ume'sCompany ポータルサイトへ" },
      [el('img', { src: img/Umescompany/logo_white.png', alt: "Ume'sCompany" })]));
    h.appendChild(el('h1', { class: 'site-title train_one', text: 'Labo. Scanner' }));
    h.appendChild(el('p', { class: 'site-tagline', text: 'External Exposure Check' }));

    if (active !== 'login') {
      var items = NAV.map(function (n) {
        return el('li', {}, [el('a', { href: n[0], 'aria-current': n[3] === active ? 'page' : false }, [
          el('span', { class: 'nav_en', text: n[1] }), el('span', { class: 'nav_ja', text: n[2] })])]);
      });
      h.appendChild(el('nav', { class: 'main-nav', 'aria-label': 'メインナビゲーション' }, [el('ul', { class: 'nav-list' }, items)]));
    }

    if (ctx) {
      var logout = el('button', { type: 'button', class: 'btn-secondary', text: 'ログアウト' });
      logout.addEventListener('click', async function () { await sb.auth.signOut(); location.href = 'login.html'; });
      h.appendChild(el('div', { class: 'user-bar' }, [
        el('span', { class: 'user-mail', text: ctx.user.email || '' }),
        ctx.org ? el('span', { class: 'badge', text: ctx.org.name + '（' + (ORG_TYPE[ctx.org.type] || '') + '）' }) : null,
        logout
      ]));
    }
  }

  // ---------- スキャンの進捗監視（Realtime + ポーリングの二重化） ----------
  function watchScan(id, cb) {
    var stopped = false, timer = null, channel = null;
    function stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      if (channel) { try { sb.removeChannel(channel); } catch (e) { /* 無視 */ } }
    }
    function handle(row) {
      if (stopped || !row) return;
      cb(row);
      if (row.status === 'completed' || row.status === 'failed') stop();
    }
    async function poll() {
      var r = await sb.from('scans').select('id,status,progress,message,score,error,domain').eq('id', id).maybeSingle();
      if (r.data) handle(r.data);
    }
    try {
      channel = sb.channel('scan-' + id)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scans', filter: 'id=eq.' + id },
          function (p) { handle(p.new); })
        .subscribe();
    } catch (e) { /* Realtimeが使えなくてもポーリングで動く */ }
    timer = setInterval(poll, 3000);
    poll();
    return stop;
  }

  window.Labo = {
    sb: sb, el: el, api: api, configured: configured,
    getSession: getSession, requireContext: requireContext, mountHeader: mountHeader,
    showAlert: showAlert, fmtDate: fmtDate, errMsg: errMsg, watchScan: watchScan,
    normalizeDomain: normalizeDomain, isValidDomain: isValidDomain, ORG_TYPE: ORG_TYPE,
    CONSENT_VERSION: 'v1',
    CONSENT_TEXT: 'このドメインの所有者である、または所有者から診断の許可を得ています。'
  };
})();
