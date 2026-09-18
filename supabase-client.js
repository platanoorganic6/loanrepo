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
    /* ── My Space documents ───────────────────────────────────────────── */
    // Contract matches the repo's ebook-* functions exactly: orders live in
    // ebook_orders, finished files in user_documents, PDFs in the private
    // loanrepo-documents bucket under <user_id>/. Nothing here is new
    // server-side — only the UI moved into the app.
    listDocuments: function () {
      if (!enabled) return Promise.resolve([]);
      return client.from("user_documents")
        .select("id,title,document_type,storage_path,created_at,order_id")
        .order("created_at", { ascending: false })
        .then(function (r) { return (r.error ? [] : r.data) || []; });
    },

    // A paid order with no document yet: payment cleared but the PDF was never
    // rendered (closed tab, failed upload). My Space retries it.
    pendingGuideOrder: function () {
      if (!enabled) return Promise.resolve(null);
      return client.from("ebook_orders")
        .select("id,status,document_path,loan_query,created_at")
        .eq("status", "paid").is("document_path", null)
        .order("created_at", { ascending: false }).limit(1)
        .then(function (r) { return (r.error || !r.data || !r.data.length) ? null : r.data[0]; });
    },

    documentUrl: function (path) {
      if (!enabled) return Promise.resolve(null);
      return client.storage.from("loanrepo-documents").createSignedUrl(path, 600)
        .then(function (r) { return (r.error || !r.data) ? null : r.data.signedUrl; });
    },

    uploadGuide: function (orderId, blob) {
      if (!enabled) return Promise.resolve({ ok: false, reason: "not-configured" });
      return client.auth.getUser().then(function (r) {
        var u = r.data && r.data.user;
        if (!u) return { ok: false, reason: "session-expired" };
        var path = u.id + "/borrowers-guide-" + orderId + ".pdf";
        return client.storage.from("loanrepo-documents")
          .upload(path, blob, { contentType: "application/pdf", cacheControl: "3600", upsert: true })
          .then(function (up) {
            if (up.error) return { ok: false, error: up.error.message };
            return client.functions.invoke("ebook-document", {
              body: { loanrepo_order_id: orderId, storage_path: path }
            }).then(function (fn) {
              var ok = !fn.error && fn.data && fn.data.ok;
              return ok ? { ok: true, path: path }
                        : { ok: false, error: (fn.error && fn.error.message) || (fn.data && fn.data.error) || "document-record-failed" };
            });
          });
      });
    },

    createGuideOrder: function (email, loanQuery) {
      if (!enabled) return Promise.resolve({ ok: false, reason: "not-configured" });
      return client.functions.invoke("ebook-order-auth", { body: { email: email, loanQuery: loanQuery } })
        .then(function (r) {
          if (r.error || !r.data || !r.data.order_id) {
            return { ok: false, error: (r.error && r.error.message) || "order-failed" };
          }
          return { ok: true, data: r.data };
        });
    },

    // Signature verification is server-side; the browser only reports back.
    confirmGuidePayment: function (orderId, response) {
      if (!enabled) return Promise.resolve({ ok: false });
      return client.functions.invoke("ebook-payment-confirm", {
        body: {
          loanrepo_order_id: orderId,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature
        }
      }).then(function (r) {
        var d = r.data || {};
        return { ok: !r.error && (d.paid || d.already_paid), error: (r.error && r.error.message) || d.error };
      });
    },

    guideOrderStatus: function (orderId) {
      if (!enabled) return Promise.resolve(null);
      return client.functions.invoke("ebook-status", { body: { loanrepo_order_id: orderId } })
        .then(function (r) { return (r.error || !r.data) ? null : r.data.order; })
        .catch(function () { return null; });
    },

    /* ── saved reports: the user's own workspace ──────────────────────── */
    // Stores the loan inputs plus a snapshot of what the model said, not a PDF
    // binary. The report is regenerated on demand, so it cannot go stale and
    // there is no file sitting in storage to leak.
    saveReport: function (payload) {
      if (!enabled) return Promise.resolve({ ok: false, reason: "not-configured" });
      return client.auth.getUser().then(function (u) {
        var id = u && u.data && u.data.user && u.data.user.id;
        if (!id) return { ok: false, reason: "signin-required" };
        return client.from("saved_reports").insert({
          user_id: id,
          label: payload.label || null,
          start_month: payload.startMonth,
          amount: payload.amount,
          tenure_years: payload.tenureYears,
          benchmark: payload.benchmark,
          own_spread: payload.ownSpread == null ? null : payload.ownSpread,
          snapshot: payload.snapshot || null
        }).then(function (r) { return { ok: !r.error, error: r.error && r.error.message }; });
      });
    },
    listReports: function () {
      if (!enabled) return Promise.resolve([]);
      return client.from("saved_reports").select("*").order("created_at", { ascending: false })
        .then(function (r) { return (r.error ? [] : r.data) || []; });
    },
    deleteReport: function (id) {
      if (!enabled) return Promise.resolve({ ok: false });
      return client.from("saved_reports").delete().eq("id", id).then(function (r) { return { ok: !r.error }; });
    },
    // Does this account hold the book? Drives whether the workspace offers it
    // to read or to buy.
    ownsBook: function () {
      if (!enabled) return Promise.resolve(false);
      return client.from("user_documents").select("id").eq("document_type", "ebook").limit(1)
        .then(function (r) { return !r.error && !!(r.data && r.data.length); });
    },
    startEbookOrder: function (email, loanQuery) {
      if (!enabled) return Promise.resolve({ ok: false, reason: "not-configured" });
      return client.functions.invoke("ebook-order", { body: { email: email, loanQuery: loanQuery || null } }).then(function (r) { if (r.error || !r.data || !r.data.order_id) return { ok: false, error: (r.error && r.error.message) || "no-response" }; return { ok: true, orderId: r.data.order_id, amount: r.data.amount, keyId: r.data.key_id }; }).catch(function (e) { return { ok: false, error: String(e) }; });
    },
    joinWaitlist: function (email, source) {
      if (!enabled) return Promise.resolve({ ok: false, reason: "not-configured" });
      return client.from("waitlist").insert({ email: email, source: source || "app" }).then(function (r) { if (r.error && r.error.code === "23505") return { ok: true, duplicate: true }; return { ok: !r.error, error: r.error && r.error.message }; });
    },
    track: function (event, props) {
      if (!enabled) return;
      client.from("usage_events").insert({ event: event, props: props || {}, session_id: sessionId() }).then(function () {}, function () {});
    }
  };
  window.LoanRepoDB = DB;
  connectLater();
})();

/* The diagnosis card, the health score and the copy rewrites that used to be
   injected from here now live in the page itself (build c3). Re-adding a
   loader would render the card twice. */
