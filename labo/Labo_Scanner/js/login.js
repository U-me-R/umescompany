/* Labo. Scanner - ログイン / 新規登録 / パスワード再設定 */
(function () {
  'use strict';
  var L = window.Labo, el = L.el, sb = L.sb;
  var main = document.getElementById('main-content');
  var mode = 'login';
  // パスワード再設定メールのリンクから来た場合（SDKがURLを処理して消す前に判定する）
  var isRecovery = /type=recovery/.test(location.hash);

  L.mountHeader('login', null);
  if (!L.configured) { main.textContent = ''; main.appendChild(el('p', { class: 'scan-alert is-error', role: 'alert', text: 'js/config.js が未設定です（SUPABASE_URL / SUPABASE_ANON_KEY）。' })); return; }

  // ログイン後の遷移先。同じサイト内の相対パスだけ許可（外部サイトへの誘導を防ぐ）
  function nextUrl() {
    var n = new URLSearchParams(location.search).get('next') || '';
    return /^[A-Za-z0-9_\-]+\.html(\?[A-Za-z0-9_=&%\-]*)?$/.test(n) ? n : 'index.html';
  }

  var alertBox = el('div', { class: 'scan-alert', role: 'alert', 'aria-live': 'polite', hidden: '' });
  var email = el('input', { type: 'email', id: 'email', class: 'form-input', autocomplete: 'email', required: '', placeholder: 'you@example.co.jp' });
  var pw = el('input', { type: 'password', id: 'password', class: 'form-input', required: '', minlength: '10' });
  var submit = el('button', { type: 'submit', class: 'btn-primary' });
  var pwLabel = el('label', { for: 'password', class: 'form-label' });
  var pwHelp = el('small', { class: 'form-help' });
  var tabLogin = el('button', { type: 'button', class: 'tab', role: 'tab', text: 'ログイン' });
  var tabSignup = el('button', { type: 'button', class: 'tab', role: 'tab', text: '新規登録' });
  var resetLink = el('button', { type: 'button', class: 'link-button', text: 'パスワードを忘れた場合' });
  var emailLabel = el('label', { for: 'email', class: 'form-label', text: 'メールアドレス' });
  var form = el('form', { class: 'scan-form', novalidate: '' }, [emailLabel, email, pwLabel, pw, pwHelp,
    el('div', { class: 'form-actions' }, [submit]), el('div', { class: 'form-actions' }, [resetLink])]);

  function setMode(m) {
    mode = m;
    alertBox.hidden = true;
    tabLogin.setAttribute('aria-selected', String(m === 'login'));
    tabSignup.setAttribute('aria-selected', String(m === 'signup'));
    emailLabel.hidden = email.hidden = (m === 'newpw');
    email.required = (m !== 'newpw');
    pw.hidden = pwLabel.hidden = (m === 'reset');
    pw.required = (m !== 'reset');
    pw.autocomplete = (m === 'login') ? 'current-password' : 'new-password';
    pwLabel.textContent = (m === 'newpw') ? '新しいパスワード' : 'パスワード';
    pwHelp.textContent = (m === 'login' || m === 'reset') ? '' : '10文字以上で設定してください。';
    resetLink.hidden = (m !== 'login');
    submit.textContent = { login: 'ログイン', signup: 'アカウントを作成', reset: '再設定メールを送る', newpw: 'パスワードを変更' }[m];
    tabLogin.hidden = tabSignup.hidden = (m === 'reset' || m === 'newpw');
  }

  tabLogin.addEventListener('click', function () { setMode('login'); });
  tabSignup.addEventListener('click', function () { setMode('signup'); });
  resetLink.addEventListener('click', function () { setMode('reset'); });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    alertBox.hidden = true;
    var mail = email.value.trim(), pass = pw.value;
    if (mode !== 'newpw' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { L.showAlert(alertBox, 'メールアドレスの形式が正しくありません。', 'error'); return; }
    if ((mode === 'signup' || mode === 'newpw') && pass.length < 10) { L.showAlert(alertBox, 'パスワードは10文字以上にしてください。', 'error'); return; }
    submit.disabled = true;
    try {
      if (mode === 'login') {
        var r = await sb.auth.signInWithPassword({ email: mail, password: pass });
        if (r.error) { L.showAlert(alertBox, 'メールアドレスまたはパスワードが正しくありません。', 'error'); return; }
        location.replace(nextUrl());
      } else if (mode === 'signup') {
        var s = await sb.auth.signUp({ email: mail, password: pass, options: { emailRedirectTo: new URL('index.html', location.href).href } });
        if (s.error) { L.showAlert(alertBox, '登録できませんでした。入力内容を確認してください。', 'error'); return; }
        if (s.data.session) location.replace(nextUrl());
        else L.showAlert(alertBox, '確認メールを送りました。メール内のリンクを開くと登録が完了します。', 'success');
      } else if (mode === 'reset') {
        await sb.auth.resetPasswordForEmail(mail, { redirectTo: new URL('login.html', location.href).href });
        // 登録の有無を知られないよう、結果にかかわらず同じ文言を表示する
        L.showAlert(alertBox, '登録されているメールアドレスであれば、再設定用のメールを送りました。', 'success');
      } else if (mode === 'newpw') {
        var u = await sb.auth.updateUser({ password: pass });
        if (u.error) { L.showAlert(alertBox, 'パスワードを変更できませんでした。', 'error'); return; }
        location.replace('index.html');
      }
    } finally { submit.disabled = false; }
  });

  main.textContent = '';
  main.appendChild(el('section', { 'aria-labelledby': 'login-h' }, [
    el('h2', { id: 'login-h', class: 'section-heading train_one' }, ['Login.', el('span', { class: 'nomal', text: 'ログイン・新規登録' })]),
    el('div', { class: 'scan-form-container' }, [el('div', { class: 'tabs', role: 'tablist' }, [tabLogin, tabSignup]), form]),
    alertBox
  ]));

  // パスワード再設定メールのリンクから戻ってきたとき
  sb.auth.onAuthStateChange(function (event) { if (event === 'PASSWORD_RECOVERY') setMode('newpw'); });
  setMode(isRecovery ? 'newpw' : 'login');
  if (!isRecovery) {
    sb.auth.getSession().then(function (r) { if (r.data.session && mode === 'login') location.replace(nextUrl()); });
  }
})();
