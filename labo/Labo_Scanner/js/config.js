// Labo. Scanner - フロント設定（GitHub Pages 側）
// ここに置いてよいのは「公開されても問題ない値」だけ。
//   OK : SUPABASE_URL / SUPABASE_ANON_KEY（anon または publishable キー）/ API_BASE
//   NG : service_role（secret）キー、データベースのパスワード  → 絶対に書かない
(function () {
  var isLocal = ["localhost", "127.0.0.1"].indexOf(location.hostname) !== -1;
  window.LABO_CONFIG = {
    API_BASE: isLocal ? "http://127.0.0.1:5000" : "https://labo-scanner-api.onrender.com",
    SUPABASE_URL: "https://xjncaltvvbvrdddpibol.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_Yz7gOUZuPsXdCwA5JXRm_g_v204jxzd",
  };
})();
