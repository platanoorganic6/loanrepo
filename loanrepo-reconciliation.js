/* LoanRepo Stage 2 — statement check-in.
   Adds the first persistent borrower-control loop to the existing History screen:
   statement date -> actual rate/EMI/balance/remaining tenure -> outcome/note -> history.
   It deliberately describes observed facts and changes between statements; it does
   not invent a model comparison when the saved diagnosis lacks the required fields. */
(function () {
  if ((location.pathname || "").toLowerCase().indexOf("app.html") < 0) return;

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>\"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }
  function money(v) {
    if (v == null || v === "") return "—";
    return "₹" + Math.round(Number(v) || 0).toLocaleString("en-IN");
  }
  function num(v, suffix) {
    return v == null || v === "" ? "—" : String(v) + (suffix || "");
  }
  function start() {
    var db = window.LoanRepoDB;
    if (!db || !db.enabled || !db.client) return false;

    var state = { loan: null, rows: [], busy: false };

    function currentLoan() {
      return db.listRuns().then(function (runs) {
        state.loan = runs && runs[0] || null;
        return state.loan;
      });
    }

    function historyHtml() {
      if (!state.rows.length) {
        return "<div style='padding:16px 0;color:var(--color-neutral-700);font-size:13px'>No statement check-ins yet. Your first check-in becomes the evidence baseline for future loan changes.</div>";
      }
      var html = "<div style='display:grid;gap:0;margin-top:14px'>";
      state.rows.forEach(function (r, i) {
        var prev = state.rows[i + 1];
        var rateDelta = prev && r.effective_rate != null && prev.effective_rate != null ? Number(r.effective_rate) - Number(prev.effective_rate) : null;
        var emiDelta = prev && r.emi != null && prev.emi != null ? Number(r.emi) - Number(prev.emi) : null;
        var balDelta = prev && r.outstanding != null && prev.outstanding != null ? Number(r.outstanding) - Number(prev.outstanding) : null;
        var monthDelta = prev && r.remaining_months != null && prev.remaining_months != null ? Number(r.remaining_months) - Number(prev.remaining_months) : null;
        html += "<div style='border-top:1px solid var(--color-divider);padding:15px 0'>";
        html += "<div style='display:flex;gap:12px;align-items:baseline;flex-wrap:wrap'><b style='font-family:var(--font-heading);font-size:18px'>" + esc(r.observed_on) + "</b><span class='pill'>" + esc(r.outcome || "unsure") + "</span></div>";
        html += "<div style='display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:12px'>";
        html += fact("Rate", num(r.effective_rate, "%"));
        html += fact("EMI", money(r.emi));
        html += fact("Outstanding", money(r.outstanding));
        html += fact("Remaining", num(r.remaining_months, " mo"));
        html += "</div>";
        if (prev) {
          html += "<div style='margin-top:12px;font-size:12px;color:var(--color-neutral-700)'><b>Change since previous check-in:</b> " +
            deltaText(rateDelta, " rate points") + "; " + deltaMoney(emiDelta, " EMI") + "; " + deltaMoney(balDelta, " outstanding") + "; " + deltaSigned(monthDelta, " months") + ".</div>";
        } else {
          html += "<div style='margin-top:12px;font-size:12px;color:var(--color-neutral-700)'>Baseline captured. Future statements will be compared against this record.</div>";
        }
        if (r.note) html += "<div style='margin-top:9px;font-size:12.5px;line-height:1.45'><b>Note:</b> " + esc(r.note) + "</div>";
        html += "</div>";
      });
      html += "</div>";
      return html;
    }
    function fact(label, value) {
      return "<div><div class='label'>" + label + "</div><div style='font-family:var(--font-heading);font-size:18px'>" + value + "</div></div>";
    }
    function deltaText(v, suffix) {
      return v == null ? "rate not compared" : (v > 0 ? "+" : "") + v.toFixed(2) + suffix;
    }
    function deltaMoney(v, label) {
      return v == null ? label + " not compared" : label + " " + (v > 0 ? "+" : "") + money(v);
    }
    function deltaSigned(v, suffix) {
      return v == null ? "tenure not compared" : (v > 0 ? "+" : "") + v + suffix;
    }

    function render(target) {
      target.setAttribute("data-reconcile-rendered", "1");
      target.innerHTML =
        "<div style='text-align:left'>" +
        "<div class='eyebrow'>Actual statement evidence</div>" +
        "<h2 style='margin:0 0 8px'>Record a loan check-in</h2>" +
        "<p style='font-size:13.5px;line-height:1.5;color:var(--color-neutral-700);margin:0 0 20px'>Enter the figures from your latest loan statement. LoanRepo keeps the record and compares future check-ins so you can see what actually changed.</p>" +
        "<div style='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px'>" +
        field("Statement date", "lr-check-date", "date", new Date().toISOString().slice(0,10), "") +
        field("Effective interest rate (%)", "lr-check-rate", "number", "", "step='0.01' min='0' max='30'") +
        field("EMI (₹)", "lr-check-emi", "number", "", "step='1' min='0'") +
        field("Outstanding balance (₹)", "lr-check-bal", "number", "", "step='1' min='0'") +
        field("Remaining tenure (months)", "lr-check-months", "number", "", "step='1' min='0'") +
        "<div class='field'><label for='lr-check-outcome'>What did you observe?</label><select class='input' id='lr-check-outcome'><option value='unchanged'>No material change</option><option value='rate_changed'>Rate changed</option><option value='emi_changed'>EMI changed</option><option value='tenure_changed'>Tenure changed</option><option value='needs_followup'>Needs bank follow-up</option><option value='unsure'>Not sure</option></select></div>" +
        "</div>" +
        "<div class='field' style='margin-top:14px'><label for='lr-check-note'>Statement / bank note (optional)</label><textarea class='input' id='lr-check-note' rows='3' placeholder='For example: June statement shows revised rate after the reset.' style='resize:vertical'></textarea></div>" +
        "<div style='display:flex;align-items:center;gap:12px;margin-top:14px;flex-wrap:wrap'><button class='btn primary' id='lr-save-checkin'>Save check-in</button><span id='lr-check-msg' style='font-size:12.5px;color:var(--color-neutral-700)'></span></div>" +
        "<div style='margin-top:28px'><div class='section-title'>Statement history</div>" + historyHtml() + "</div>" +
        "</div>";

      var save = document.getElementById("lr-save-checkin");
      if (save) save.onclick = function () {
        if (state.busy || !state.loan) return;
        var date = document.getElementById("lr-check-date").value;
        var rate = document.getElementById("lr-check-rate").value;
        var emi = document.getElementById("lr-check-emi").value;
        var bal = document.getElementById("lr-check-bal").value;
        var months = document.getElementById("lr-check-months").value;
        var outcome = document.getElementById("lr-check-outcome").value;
        var note = document.getElementById("lr-check-note").value.trim();
        if (!date) { alert("Please enter the statement date."); return; }
        if (!rate && !emi && !bal && !months) { alert("Enter at least one figure from the statement."); return; }
        state.busy = true; save.disabled = true; save.textContent = "Saving…";
        db.logCheckIn(state.loan.id, {
          observed_on: date,
          effective_rate: rate === "" ? null : Number(rate),
          emi: emi === "" ? null : Number(emi),
          outstanding: bal === "" ? null : Number(bal),
          remaining_months: months === "" ? null : Number(months),
          outcome: outcome,
          note: note || null
        }).then(function (r) {
          if (!r.ok) throw new Error(r.error || r.reason || "save failed");
          return db.listCheckIns(state.loan.id);
        }).then(function (rows) {
          state.rows = rows || [];
          state.busy = false;
          render(target);
        }).catch(function (e) {
          state.busy = false; save.disabled = false; save.textContent = "Save check-in";
          var msg = document.getElementById("lr-check-msg");
          if (msg) msg.textContent = "Could not save this check-in. Please try again.";
          console.error(e);
        });
      };
    }

    function field(label, id, type, value, attrs) {
      return "<div class='field'><label for='" + id + "'>" + label + "</label><input class='input' id='" + id + "' type='" + type + "' value='" + esc(value) + "' " + attrs + "></div>";
    }

    function findTarget() {
      var nodes = Array.prototype.slice.call(document.querySelectorAll("main .card.empty"));
      return nodes.find(function (n) { return /History is next/i.test(n.textContent || ""); });
    }

    function mount() {
      var target = findTarget();
      if (!target || target.getAttribute("data-reconcile-mounted") === "1") return;
      target.setAttribute("data-reconcile-mounted", "1");
      currentLoan().then(function (loan) {
        if (!loan) return;
        return db.listCheckIns(loan.id);
      }).then(function (rows) {
        if (!state.loan) return;
        state.rows = rows || [];
        render(target);
      });
    }

    var mo = new MutationObserver(mount);
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); }, 120000);
    mount();
    return true;
  }

  var tries = 0;
  function boot() {
    if (start()) return;
    if (tries++ < 100) setTimeout(boot, 100);
  }
  boot();
})();
