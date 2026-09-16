/* LoanRepo Stage 2 database compatibility layer.
   The live project uses loan_runs and the existing subscription schema.
   Keep the public LoanRepoDB contract stable so the diagnosis and Control Centre
   do not need to know the underlying migration history. */
(function () {
  function start() {
    var db = window.LoanRepoDB;
    if (!db || !db.enabled || !db.client) return false;

    var client = db.client;
    var original = {
      saveRun: db.saveRun,
      listRuns: db.listRuns,
      deleteRun: db.deleteRun,
      renameLoan: db.renameLoan,
      fetchSubscription: db.fetchSubscription
    };

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
              id: x.id,
              name: x.label,
              label: x.label,
              start_month: x.start_month,
              amount: Number(x.amount),
              tenure_years: x.tenure_years,
              benchmark: x.benchmark,
              result: x.result || {},
              created_at: x.created_at
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

    db.fetchSubscription = function () {
      return client.from("subscriptions")
        .select("plan_code,status,expires_at,amount_inr")
        .eq("user_id", "00000000-0000-0000-0000-000000000000")
        .limit(0)
        .then(function () {
          return client.auth.getUser();
        }).then(function (u) {
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

    /* The original methods remain available for diagnostics that run without
       the compatibility layer; Stage 2 explicitly uses the live schema above. */
    db._stage2Originals = original;
    window.LoanRepoDB = db;
    return true;
  }

  var tries = 0;
  function boot() {
    if (start()) return;
    if (tries++ < 100) setTimeout(boot, 100);
  }
  boot();
})();
