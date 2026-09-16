/* LoanRepo Stage 2 database compatibility layer.
   The live project uses loan_runs and the existing subscription schema.
   This file is loaded before supabase-client.js and intercepts LoanRepoDB creation
   so the app's first auth callback already sees the live-schema adapter. */
(function () {
  var patched = false;

  function patch(db) {
    if (!db || patched) return;
    patched = true;
    var client = db.client;
    if (!client) { patched = false; return; }

    db.saveRun = function (run) {
      return client.auth.getUser().then(function (u) {
        var user = u.data && u.data.user;
        if (!user) return { ok: false, reason: "signed-out" };
        return client.from("loan_runs").insert({
          user_id: user.id,
          label: run.name || run.label || null,
          start_month: run.start_month,
          amount: run.amount,
          tenure_years: run.tenure_years,
          benchmark: run.benchmark,
          result: run.result || {}
        }).select("id").single().then(function (r) {
          var msg = r.error && r.error.message;
          if (msg && /duplicate|unique|loan.?limit/i.test(msg)) return { ok: false, reason: "loan-limit", error: msg };
          return { ok: !r.error, id: r.data && r.data.id, error: msg };
        });
      });
    };

    db.listRuns = function () {
      return client.from("loan_runs")
        .select("id,label,start_month,amount,tenure_years,benchmark,result,created_at")
        .order("created_at", { ascending: false })
        .limit(50)
        .then(function (r) {
          if (r.error || !r.data) return [];
          return r.data.map(function (x) {
            return {
              id: x.id, name: x.label, label: x.label,
              start_month: x.start_month, amount: Number(x.amount),
              tenure_years: x.tenure_years, benchmark: x.benchmark,
              result: x.result || {}, created_at: x.created_at
            };
          });
        }).catch(function () { return []; });
    };

    db.deleteRun = function (id) {
      return client.from("loan_runs").delete().eq("id", id).then(function (r) {
        return { ok: !r.error, error: r.error && r.error.message };
      });
    };

    db.renameLoan = function (id, name) {
      return client.from("loan_runs").update({ label: name }).eq("id", id).then(function (r) {
        return { ok: !r.error, error: r.error && r.error.message };
      });
    };

    db.logCheckIn = function (loanId, obs) {
      return client.auth.getUser().then(function (u) {
        var user = u.data && u.data.user;
        if (!user) return { ok: false, reason: "signed-out" };
        return client.from("check_ins").insert({
          loan_id: loanId,
          user_id: user.id,
          observed_on: obs.observed_on || new Date().toISOString().slice(0, 10),
          effective_rate: obs.effective_rate == null ? null : obs.effective_rate,
          emi: obs.emi == null ? null : obs.emi,
          outstanding: obs.outstanding == null ? null : obs.outstanding,
          remaining_months: obs.remaining_months == null ? null : obs.remaining_months,
          outcome: obs.outcome || "unsure",
          note: obs.note || null
        }).then(function (r) {
          return { ok: !r.error, error: r.error && r.error.message };
        });
      });
    };

    db.listCheckIns = function (loanId) {
      var q = client.from("check_ins")
        .select("id,loan_id,observed_on,effective_rate,emi,outstanding,remaining_months,outcome,note,created_at")
        .order("observed_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (loanId) q = q.eq("loan_id", loanId);
      return q.then(function (r) { return r.error ? [] : (r.data || []); }).catch(function () { return []; });
    };

    db.deleteCheckIn = function (id) {
      return client.from("check_ins").delete().eq("id", id).then(function (r) {
        return { ok: !r.error, error: r.error && r.error.message };
      });
    };

    db.fetchSubscription = function () {
      return client.auth.getUser().then(function (u) {
        var user = u.data && u.data.user;
        if (!user) return null;
        return client.from("subscriptions")
          .select("plan_code,status,expires_at,amount_inr")
          .eq("user_id", user.id)
          .order("expires_at", { ascending: false })
          .limit(1)
          .maybeSingle();
      }).then(function (r) {
        if (!r || r.error || !r.data) return null;
        return {
          plan: r.data.plan_code || (Number(r.data.amount_inr) === 149 ? "pro" : "free"),
          status: r.data.status,
          current_period_end: r.data.expires_at || null
        };
      }).catch(function () { return null; });
    };

    window.__LOANREPO_DB_ADAPTED = true;
  }

  /* Intercept the synchronous assignment performed by supabase-client.js. */
  try {
    var existing = window.LoanRepoDB;
    if (existing) {
      patch(existing);
    } else if (!Object.getOwnPropertyDescriptor(window, "LoanRepoDB")) {
      var value;
      Object.defineProperty(window, "LoanRepoDB", {
        configurable: true,
        get: function () { return value; },
        set: function (next) { value = next; patch(next); }
      });
    }
  } catch (e) {}
})();
