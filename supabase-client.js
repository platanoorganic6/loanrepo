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
      client.auth.getSession().then(function (r) { cb((r.data && r.data.session && r.data.session.user) || null); });
      var sub = client.auth.onAuthStateChange(function (_e, session) { cb((session && session.user) || null); });
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
    signOut: function () { if (!enabled) return Promise.resolve({ ok: false }); return client.auth.signOut().then(function () { return { ok: true }; }); },
    fetchRepoHistory: function () {
      if (!enabled) return Promise.resolve(null);
      return client.from("repo_rates").select("effective_date, rate").order("effective_date").then(function (r) {
        if (r.error || !r.data || !r.data.length) return null;
        return r.data.map(function (row) { return { d: row.effective_date, r: Number(row.rate) }; });
      }).catch(function () { return null; });
    },
    fetchExamples: function () {
      if (!enabled) return Promise.resolve(null);
      return client.from("examples").select("start_month, city, amount, tenure_years, note").eq("published", true).order("sort_order").then(function (r) {
        if (r.error || !r.data || !r.data.length) return null;
        return r.data.map(function (row) { return { date: row.start_month, city: row.city, amt: Number(row.amount), ten: row.tenure_years, note: row.note }; });
      }).catch(function () { return null; });
    },
    saveRun: function (run) {
      if (!enabled) return Promise.resolve({ ok: false, reason: "not-configured" });
      return client.auth.getUser().then(function (u) {
        var user = u.data && u.data.user;
        if (!user) return { ok: false, reason: "signed-out" };
        return client.from("tracked_loans").insert({ user_id: user.id, name: run.name || run.label || null, label: run.label || null, start_month: run.start_month, amount: run.amount, tenure_years: run.tenure_years, benchmark: run.benchmark, result: run.result || {} }).then(function (r) {
          var msg = r.error && r.error.message;
          if (msg && msg.indexOf("free_tier_loan_limit") > -1) return { ok: false, reason: "loan-limit" };
          return { ok: !r.error, error: msg };
        });
      });
    },
    listRuns: function () {
      if (!enabled) return Promise.resolve([]);
      return client.from("tracked_loans").select("id, name, label, start_month, amount, tenure_years, benchmark, result, created_at").eq("archived", false).order("created_at", { ascending: false }).limit(50).then(function (r) { return r.error ? [] : r.data; }).catch(function () { return []; });
    },
    deleteRun: function (id) { if (!enabled) return Promise.resolve({ ok: false }); return client.from("tracked_loans").delete().eq("id", id).then(function (r) { return { ok: !r.error }; }); },
    renameLoan: function (id, name) { if (!enabled) return Promise.resolve({ ok: false }); return client.from("tracked_loans").update({ name: name }).eq("id", id).then(function (r) { return { ok: !r.error, error: r.error && r.error.message }; }); },
    logCheckIn: function (loanId, obs) {
      if (!enabled) return Promise.resolve({ ok: false, reason: "not-configured" });
      return client.auth.getUser().then(function (u) {
        var user = u.data && u.data.user;
        if (!user) return { ok: false, reason: "signed-out" };
        return client.from("check_ins").insert({ loan_id: loanId, user_id: user.id, effective_rate: obs.effective_rate || null, emi: obs.emi || null, outstanding: obs.outstanding || null, remaining_months: obs.remaining_months || null, outcome: obs.outcome || "unsure", note: obs.note || null }).then(function (r) { return { ok: !r.error, error: r.error && r.error.message }; });
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
    track: function (event, props) {
      if (!enabled) return;
      client.from("usage_events").insert({ event: event, props: safeAnalyticsProps(props), session_id: sessionId() }).then(function () {}, function () {});
    },
    logAnonymousDiagnosis: function (props) {
      if (!enabled) return Promise.resolve({ ok: false, reason: "not-configured" });
      return client.from("usage_events").insert({ event: "diagnosis_completed", props: safeAnalyticsProps(props), session_id: sessionId() }).then(function (r) {
        return { ok: !r.error, error: r.error && r.error.message };
      }).catch(function (e) { return { ok: false, error: String(e) }; });
    }
  };
  window.LoanRepoDB = DB;
  connectLater();
})();

/* Stage-1 diagnosis result actions: keep the free diagnosis actions ahead of the paid tracking action.
   This is deliberately narrow: it touches only the three exact result buttons and disconnects once ordered. */
(function () {
  function reorderOnce() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll("button"));
    var pdf = buttons.find(function (b) { return (b.textContent || "").trim() === "Save this result as PDF"; });
    var method = buttons.find(function (b) { return (b.textContent || "").trim() === "Read the method and assumptions"; });
    var track = buttons.find(function (b) { return /^Track this loan/.test((b.textContent || "").trim()); });
    if (!pdf || !method || !track) return false;
    var parent = pdf.parentElement;
    if (!parent || method.parentElement !== parent || track.parentElement !== parent) return false;
    parent.appendChild(pdf);
    parent.appendChild(method);
    parent.appendChild(track);
    return true;
  }
  function start() {
    if (reorderOnce()) return;
    if (!window.MutationObserver) return;
    var observer = new MutationObserver(function () {
      if (reorderOnce()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { observer.disconnect(); }, 10000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();

/* Stage-2 bridge: top sign-in + Track this loan -> auth -> save -> ₹149 checkout ->
   webhook-confirmed Control Centre. Diagnosis remains browser-only until Track is chosen. */
(function () {
  var PENDING = "loanrepo.pending_track";
  var DIAG = "loanrepo.pending_diagnosis";
  var CHECKOUT = "loanrepo.pending_checkout";
  var db = window.LoanRepoDB;
  if (!db) return;

  function isDiagnosisPage() {
    var p = (window.location.pathname || "").toLowerCase();
    return p === "/" || /\/index\.html$/.test(p) || /loanrepo/.test(p) && !/\/app\.html$/.test(p);
  }
  if (!isDiagnosisPage()) return;

  function storageSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function storageGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function storageDel(k) { try { sessionStorage.removeItem(k); } catch (e) {} }

  function trackButton() {
    return Array.prototype.slice.call(document.querySelectorAll("button")).find(function (b) {
      return /^Track this loan/.test((b.textContent || "").trim());
    });
  }

  function snapshotDiagnosis() {
    var date = document.getElementById("lr-date");
    var ten = document.getElementById("lr-ten");
    var amt = document.getElementById("lr-amt");
    if (!date || !ten || !amt) return;
    var bm = document.querySelector('input[name="bm"]:checked');
    var spreadToggle = document.querySelector('input[type="checkbox"]');
    var spread = document.getElementById("lr-spread");
    storageSet(DIAG, JSON.stringify({
      date: date.value,
      tenure: ten.value,
      amount: amt.value,
      benchmark: bm ? bm.value : "EBLR",
      useOwnSpread: !!(spreadToggle && spreadToggle.checked),
      spread: spread ? spread.value : ""
    }));
  }

  function patchAuthCopy() {
    var title = document.querySelector(".dialog-title");
    var body = document.querySelector(".dialog-body");
    if (title) title.textContent = "Sign in to track this loan";
    if (body) body.textContent = "Your diagnosis stays free. Sign in to save this loan and continue to Loan Watch — ₹149/month.";
  }

  function patchTrackLabel() {
    var b = trackButton();
    if (b && (b.textContent || "").trim() === "Track this loan") b.textContent = "Track this loan — ₹149/month";
  }

  function savePendingFlag() {
    snapshotDiagnosis();
    storageSet(PENDING, "1");
    patchTrackLabel();
  }

  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!b) return;
    if (/^Track this loan/.test((b.textContent || "").trim())) savePendingFlag();
  }, true);

  function restoreDiagnosisThenTrack() {
    var raw = storageGet(DIAG);
    if (!raw) return;
    var d;
    try { d = JSON.parse(raw); } catch (e) { return; }
    var tries = 0;
    function apply() {
      var date = document.getElementById("lr-date");
      var ten = document.getElementById("lr-ten");
      var amt = document.getElementById("lr-amt");
      if (!date || !ten || !amt) {
        if (tries++ < 80) setTimeout(apply, 100);
        return;
      }
      function setValue(el, value) {
        if (value == null || value === "") return;
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      setValue(date, d.date);
      setValue(ten, d.tenure);
      setValue(amt, d.amount);
      var radios = Array.prototype.slice.call(document.querySelectorAll('input[name="bm"]'));
      radios.forEach(function (r) {
        r.checked = r.value === d.benchmark;
        if (r.checked) r.dispatchEvent(new Event("change", { bubbles: true }));
      });
      var toggle = document.querySelector('input[type="checkbox"]');
      if (toggle && typeof d.useOwnSpread === "boolean") {
        toggle.checked = d.useOwnSpread;
        toggle.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (d.useOwnSpread && d.spread) {
        var spread = document.getElementById("lr-spread");
        if (spread) setValue(spread, d.spread);
      }
      setTimeout(function () {
        var run = Array.prototype.slice.call(document.querySelectorAll("button")).find(function (x) { return (x.textContent || "").trim() === "Run your loan journey"; });
        if (run) run.click();
        waitForResultAndTrack();
      }, 250);
    }
    apply();
  }

  function waitForResultAndTrack() {
    var tries = 0;
    function check() {
      var b = trackButton();
      if (b) {
        patchTrackLabel();
        setTimeout(function () { var t = trackButton(); if (t) t.click(); }, 350);
        return;
      }
      if (tries++ < 100) setTimeout(check, 100);
    }
    check();
  }

  function loadRazorpay() {
    if (window.Razorpay) return Promise.resolve(true);
    return new Promise(function (resolve) {
      var s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      s.onload = function () { resolve(!!window.Razorpay); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
  }

  function activeSubscription(sub) {
    return !!(sub && sub.plan === "pro" && sub.status === "active");
  }

  function beginLoanWatchCheckout() {
    if (storageGet(CHECKOUT) === "opening") return;
    storageSet(CHECKOUT, "opening");
    db.fetchSubscription().then(function (sub) {
      if (activeSubscription(sub)) {
        storageDel(PENDING); storageDel(DIAG); storageDel(CHECKOUT);
        window.location.href = "app.html";
        return null;
      }
      return loadRazorpay().then(function (ready) {
        if (!ready) throw new Error("checkout-unavailable");
        return db.startCheckout();
      });
    }).then(function (res) {
      if (!res) return;
      if (!res.ok || !res.subscriptionId || !window.Razorpay) throw new Error("checkout-unavailable");
      var rz = new window.Razorpay({
        key: res.keyId,
        subscription_id: res.subscriptionId,
        name: "LoanRepo",
        description: "Loan Watch — ₹149/month",
        theme: { color: "#5980a6" },
        handler: function () {
          var tries = 0;
          (function poll() {
            db.fetchSubscription().then(function (sub) {
              if (activeSubscription(sub)) {
                storageDel(PENDING); storageDel(DIAG); storageDel(CHECKOUT);
                window.location.href = "app.html";
              } else if (tries++ < 20) {
                setTimeout(poll, 2000);
              } else {
                storageDel(CHECKOUT);
              }
            });
          })();
        },
        modal: { ondismiss: function () { storageDel(CHECKOUT); } }
      });
      rz.open();
    }).catch(function () {
      storageDel(CHECKOUT);
      var msg = document.querySelector(".dialog-body") || document.body;
      if (msg && /checkout/i.test(msg.textContent || "")) msg.textContent = "Your loan was saved. Loan Watch checkout is temporarily unavailable — please try Track this loan again.";
    });
  }

  var originalSaveRun = db.saveRun;
  if (typeof originalSaveRun === "function") {
    db.saveRun = function (run) {
      return originalSaveRun.call(db, run).then(function (res) {
        if (res && res.ok) {
          storageDel(PENDING);
          db.track("loan_tracked", { stage: "post_diagnosis", benchmark: run && run.benchmark });
          setTimeout(beginLoanWatchCheckout, 250);
        }
        return res;
      });
    };
  }

  function onAuth(user) {
    if (!user || storageGet(PENDING) !== "1") return;
    patchAuthCopy();
    setTimeout(function () {
      var cancel = Array.prototype.slice.call(document.querySelectorAll("button")).find(function (b) { return (b.textContent || "").trim() === "Cancel"; });
      if (cancel) cancel.click();
      var raw = storageGet(DIAG);
      if (raw) restoreDiagnosisThenTrack();
      else waitForResultAndTrack();
    }, 300);
  }

  db.onAuth(onAuth);

  var mo = new MutationObserver(function () {
    patchTrackLabel();
    patchAuthCopy();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(function () { mo.disconnect(); }, 30000);

  if (storageGet(PENDING) === "1") {
    setTimeout(function () {
      db.onAuth(function (user) { if (user) onAuth(user); });
    }, 500);
  }
})();