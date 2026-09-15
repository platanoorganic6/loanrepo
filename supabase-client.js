/* LoanRepo — Supabase data layer.
   Loads after supabase-js and supabase-config.js. Exposes window.LoanRepoDB.

   Every method degrades: with no credentials configured, reads return null and
   writes resolve to {ok:false, reason:'not-configured'} so the app keeps
   working entirely client-side. */
(function () {
  var CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
  var cfg = window.LOANREPO_SUPABASE || {};
  var lib = window.supabase;
  var enabled = !!(cfg.url && cfg.anonKey && lib && lib.createClient);
  var client = enabled ? lib.createClient(cfg.url, cfg.anonKey) : null;

  // This file can execute before the Supabase UMD bundle has run — script order
  // in the page is not guaranteed. Without a retry every method would report
  // not-configured for the rest of the session, silently disabling accounts.
  function connectLater() {
    if (enabled) return;
    var tries = 0;
    var attach = function () {
      cfg = window.LOANREPO_SUPABASE || cfg;
      lib = window.supabase;
      if (cfg.url && cfg.anonKey && lib && lib.createClient) {
        client = lib.createClient(cfg.url, cfg.anonKey);
        enabled = true;
        if (window.LoanRepoDB) { window.LoanRepoDB.enabled = true; window.LoanRepoDB.client = client; }
        return true;
      }
      return false;
    };
    var tick = function () {
      if (attach() || tries++ > 60) return;
      setTimeout(tick, 100);
    };
    if (!window.supabase && !document.getElementById("loanrepo-supabase-lib")) {
      var s = document.createElement("script");
      s.id = "loanrepo-supabase-lib";
      s.src = CDN;
      document.head.appendChild(s);
    }
    tick();
  }

  function sessionId() {
    try {
      var k = "loanrepo.sid", v = localStorage.getItem(k);
      if (!v) {
        v = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
        localStorage.setItem(k, v);
      }
      return v;
    } catch (e) { return null; }
  }

  // Anonymous product analytics must never become a shadow loan database.
  // Only low-risk aggregate dimensions are allowed here. Loan particulars
  // such as amount, start date, tenure, EMI, rate, outstanding balance,
  // lender, spread and reset dates are deliberately excluded.
  function safeAnalyticsProps(props) {
    props = props || {};
    var allowed = ["source", "stage", "variant", "benchmark", "diagnosis_type", "outcome", "entry_point"];
    var out = {};
    allowed.forEach(function (k) {
      if (props[k] !== undefined && props[k] !== null) out[k] = String(props[k]).slice(0, 80);
    });
    return out;
  }

  var DB = {
    enabled: enabled,
    client: client,
    onAuth: function (cb) {
      if (!enabled) { cb(null); return function () {}; }
      client.auth.getSession().then(function (r) {
        cb((r.data && r.data.session && r.data.session.user) || null);
      });
      var sub = client.auth.onAuthStateChange(function (_e, session) {
        cb((session && session.user) || null);
      });
      return function () { sub.data.subscription.unsubscribe(); };
    },
    signInEmail: function (email) {
      if (!enabled) return Promise.resolve({ ok: false, reason: "not-configured" });
      return client.auth.signInWithOtp({ email: email, options: { emailRedirectTo: window.location.href } })
        .then(function (r) { return { ok: !r.error, error: r.error && r.error.message }; });
    },
    signInGoogle: function () {
      if (!enabled) return Promise.resolve({ ok: false, reason: "not-configured" });
      return client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } })
        .then(function (r) { return { ok: !r.error, error: r.error && r.error.message }; });
    },
    signOut: function () {
      if (!enabled) return Promise.resolve({ ok: false });
      return client.auth.signOut().then(function () { return { ok: true }; });
    },
    fetchRepoHistory: function () {
      if (!enabled) return Promise.resolve(null);
      return client.from("repo_rates").select("effective_date, rate").order("effective_date")
        .then(function (r) {
          if (r.error || !r.data || !r.data.length) return null;
          return r.data.map(function (row) { return { d: row.effective_date, r: Number(row.rate) }; });
        }).catch(function () { return null; });
    },
    fetchExamples: function () {
      if (!enabled) return Promise.resolve(null);
      return client.from("examples").select("start_month, city, amount, tenure_years, note")
        .eq("published", true).order("sort_order")
        .then(function (r) {
          if (r.error || !r.data || !r.data.length) return null;
          return r.data.map(function (row) { return { date: row.start_month, city: row.city, amt: Number(row.amount), ten: row.tenure_years, note: row.note }; });
        }).catch(function () { return null; });
    },
    saveRun: function (run) {
      if (!enabled) return Promise.resolve({ ok: false, reason: "not-configured" });
      return client.auth.getUser().then(function (u) {
        var user = u.data && u.data.user;
        if (!user) return { ok: false, reason: "signed-out" };
        return client.from("tracked_loans").insert({ user_id: user.id, name: run.name || run.label || null, label: run.label || null, start_month: run.start_month, amount: run.amount, tenure_years: run.tenure_years, benchmark: run.benchmark, result: run.result || {} })
          .then(function (r) { var msg = r.error && r.error.message; if (msg && msg.indexOf("free_tier_loan_limit") > -1) return { ok: false, reason: "loan-limit" }; return { ok: !r.error, error: msg }; });
      });
    },
    listRuns: function () {
      if (!enabled) return Promise.resolve([]);
      return client.from("tracked_loans").select("id, name, label, start_month, amount, tenure_years, benchmark, result, created_at")
        .eq("archived", false).order("created_at", { ascending: false }).limit(50)
        .then(function (r) { return r.error ? [] : r.data; }).catch(function () { return []; });
    },
    deleteRun: function (id) { if (!enabled) return Promise.resolve({ ok: false }); return client.from("tracked_loans").delete().eq("id", id).then(function (r) { return { ok: !r.error }; }); },
    renameLoan: function (id, name) { if (!enabled) return Promise.resolve({ ok: false }); return client.from("tracked_loans").update({ name: name }).eq("id", id).then(function (r) { return { ok: !r.error, error: r.error && r.error.message }; }); },
    logCheckIn: function (loanId, obs) {
      if (!enabled) return Promise.resolve({ ok: false, reason: "not-configured" });
      return client.auth.getUser().then(function (u) {
        var user = u.data && u.data.user;
        if (!user) return { ok: false, reason: "signed-out" };
        return client.from("check_ins").insert({ loan_id: loanId, user_id: user.id, effective_rate: obs.effective_rate || null, emi: obs.emi || null, outstanding: obs.outstanding || null, remaining_months: obs.remaining_months || null, outcome: obs.outcome || "unsure", note: obs.note || null })
          .then(function (r) { return { ok: !r.error, error: r.error && r.error.message }; });
      });
    },
    listCheckIns: function (loanId) {
      if (!enabled) return Promise.resolve([]);
      var q = client.from("check_ins").select("id, loan_id, observed_on, effective_rate, emi, outstanding, remaining_months, outcome, note").order("observed_on", { ascending: false }).limit(200);
      if (loanId) q = q.eq("loan_id", loanId);
      return q.then(function (r) { return r.error ? [] : r.data; }).catch(function () { return []; });
    },
    deleteCheckIn: function (id) { if (!enabled) return Promise.resolve({ ok: false }); return client.from("check_ins").delete().eq("id", id).then(function (r) { return { ok: !r.error }; }); },
    fetchSubscription: function () {
      if (!enabled) return Promise.resolve(null);
      return client.from("subscriptions").select("plan, status, current_period_end").maybeSingle().then(function (r) { return r.error ? null : r.data; }).catch(function () { return null; });
    },
    startCheckout: function () {
      if (!enabled) return Promise.resolve({ ok: false, reason: "not-configured" });
      return client.functions.invoke("razorpay-order", { body: {} }).then(function (r) { if (r.error || !r.data) return { ok: false, error: (r.error && r.error.message) || "no-response" }; return { ok: true, subscriptionId: r.data.subscription_id, keyId: r.data.key_id }; }).catch(function (e) { return { ok: false, error: String(e) }; });
    },
    startEbookOrder: function (email, loanQuery) {
      if (!enabled) return Promise.resolve({ ok: false, reason: "not-configured" });
      return client.functions.invoke("ebook-order", { body: { email: email, loanQuery: loanQuery || null } }).then(function (r) { if (r.error || !r.data || !r.data.order_id) return { ok: false, error: (r.error && r.error.message) || "no-response" }; return { ok: true, orderId: r.data.order_id, amount: r.data.amount, keyId: r.data.key_id }; }).catch(function (e) { return { ok: false, error: String(e) }; });
    },
    joinWaitlist: function (email, source) {
      if (!enabled) return Promise.resolve({ ok: false, reason: "not-configured" });
      return client.from("waitlist").insert({ email: email, source: source || "app" }).then(function (r) { if (r.error && r.error.code === "23505") return { ok: true, duplicate: true }; return { ok: !r.error, error: r.error && r.error.message }; });
    },
    // General analytics entry point. Loan particulars are filtered out before
    // anything reaches Supabase so analytics cannot silently become storage.
    track: function (event, props) {
      if (!enabled) return;
      client.from("usage_events").insert({ event: event, props: safeAnalyticsProps(props), session_id: sessionId() }).then(function () {}, function () {});
    },
    // Purpose-built metric for the 10,000-borrower mission. This records only
    // that a diagnosis was completed, plus non-identifying aggregate dimensions.
    // It deliberately does NOT accept or transmit the diagnosis inputs/results.
    logAnonymousDiagnosis: function (props) {
      if (!enabled) return Promise.resolve({ ok: false, reason: "not-configured" });
      return client.from("usage_events").insert({
        event: "diagnosis_completed",
        props: safeAnalyticsProps(props),
        session_id: sessionId()
      }).then(function (r) {
        return { ok: !r.error, error: r.error && r.error.message };
      }).catch(function (e) { return { ok: false, error: String(e) }; });
    }
  };
  window.LoanRepoDB = DB;
  connectLater();
})();

/* The diagnosis card, the health score and the copy rewrites that used to be
   injected from here now live in the page itself (build c3). Re-adding a
   loader would render the card twice. */