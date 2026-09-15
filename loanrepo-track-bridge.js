/* LoanRepo Stage-2 bridge
   Owns only the explicit "Track this loan" transition. The calculator remains
   browser-only until that button is deliberately pressed. */
(function () {
  var db = window.LoanRepoDB;
  if (!db) return;

  var PENDING = "loanrepo.pending_track";
  var DIAG = "loanrepo.pending_diagnosis";
  var CHECKOUT = "loanrepo.pending_checkout";
  var HANDLED = "loanrepo.track_handled";
  var currentUser = null;
  var busy = false;

  function isDiagnosisPage() {
    var p = (window.location.pathname || "").toLowerCase();
    return p === "/" || /\/index\.html$/.test(p);
  }
  if (!isDiagnosisPage()) return;

  function set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function del(k) { try { sessionStorage.removeItem(k); } catch (e) {} }

  function buttons() { return Array.prototype.slice.call(document.querySelectorAll("button")); }
  function trackButton() { return buttons().find(function (b) { return /^Track this loan/.test((b.textContent || "").trim()); }); }
  function pdfButton() { return buttons().find(function (b) { return (b.textContent || "").trim() === "Save this result as PDF"; }); }
  function methodButton() { return buttons().find(function (b) { return (b.textContent || "").trim() === "Read the method and assumptions"; }); }

  function patchLabels() {
    var b = trackButton();
    if (b && !/₹149/.test(b.textContent || "")) b.textContent = "Track this loan — ₹149/month";
    var title = document.querySelector(".dialog-title");
    var body = document.querySelector(".dialog-body");
    if (title && /save your runs/i.test(title.textContent || "")) title.textContent = "Sign in to track this loan";
    if (body && /account only stores/i.test(body.textContent || "")) body.textContent = "Your diagnosis stays free. Sign in to save this loan and continue to Loan Watch — ₹149/month.";
  }

  /* Put the three result actions in a deterministic order even when the DC
     runtime wraps individual controls in different elements. */
  function orderActions() {
    var pdf = pdfButton(), method = methodButton(), track = trackButton();
    if (!pdf || !method || !track) return false;
    var parent = pdf.parentElement;
    var okSame = parent && method.parentElement === parent && track.parentElement === parent;
    if (okSame) {
      parent.appendChild(pdf); parent.appendChild(method); parent.appendChild(track);
      return true;
    }
    var wrap = document.getElementById("lr-stage1-actions");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "lr-stage1-actions";
      wrap.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;align-items:center;width:100%;margin-top:0;";
      var first = [pdf, method, track].sort(function (a, b) {
        return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
      })[0];
      first.parentNode.insertBefore(wrap, first);
    }
    wrap.appendChild(pdf); wrap.appendChild(method); wrap.appendChild(track);
    return true;
  }

  function snapshot() {
    var date = document.getElementById("lr-date");
    var ten = document.getElementById("lr-ten");
    var amt = document.getElementById("lr-amt");
    if (!date || !ten || !amt) return null;
    var bm = document.querySelector('input[name="bm"]:checked');
    var toggle = document.querySelector('input[type="checkbox"]');
    var spread = document.getElementById("lr-spread");
    var text = document.body ? document.body.innerText : "";
    var verdict = "";
    var verdictNode = buttons().map(function () { return null; });
    var dark = Array.prototype.slice.call(document.querySelectorAll("div")).find(function (el) {
      return /Added to your loan, unannounced/.test(el.textContent || "");
    });
    if (dark) verdict = (dark.textContent || "").replace(/\s+/g, " ").slice(0, 500);
    return {
      date: date.value,
      tenure: Number(ten.value),
      amount: Number(amt.value),
      benchmark: bm ? bm.value : "EBLR",
      useOwnSpread: !!(toggle && toggle.checked),
      spread: spread ? spread.value : "",
      verdict_text: verdict
    };
  }

  function savePending() {
    var d = snapshot();
    if (!d) return false;
    set(DIAG, JSON.stringify(d));
    set(PENDING, "1");
    return true;
  }

  function friendly(res) {
    var raw = (res && (res.error || res.reason)) || "";
    if (res && res.reason === "loan-limit") return "This account already has its free tracked loan. Loan Watch is required for another loan.";
    if (res && res.reason === "signed-out") return "Please sign in first, then track the loan.";
    if (/row-level security|permission|policy/i.test(raw)) return "The loan could not be saved. Please sign out and sign back in, then try again.";
    if (/schema cache|does not exist|relation/i.test(raw)) return "Loan tracking is not fully enabled on the server yet. Nothing was lost.";
    return "We couldn't save the loan just now. Nothing was lost — please try again.";
  }

  function active(sub) { return !!(sub && sub.plan === "pro" && sub.status === "active"); }

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

  function beginCheckout() {
    if (get(CHECKOUT) === "opening") return;
    set(CHECKOUT, "opening");
    db.fetchSubscription().then(function (sub) {
      if (active(sub)) {
        del(CHECKOUT); del(PENDING); del(DIAG); del(HANDLED);
        window.location.href = "app.html";
        return null;
      }
      return loadRazorpay().then(function (ready) {
        if (!ready) throw new Error("checkout unavailable");
        return db.startCheckout();
      });
    }).then(function (res) {
      if (!res) return;
      if (!res.ok || !res.subscriptionId || !window.Razorpay) throw new Error("checkout unavailable");
      var rz = new window.Razorpay({
        key: res.keyId,
        subscription_id: res.subscriptionId,
        name: "LoanRepo",
        description: "Loan Watch — ₹149/month",
        prefill: { email: currentUser && currentUser.email || "" },
        theme: { color: "#5980a6" },
        handler: function () {
          var tries = 0;
          (function poll() {
            db.fetchSubscription().then(function (sub) {
              if (active(sub)) {
                del(CHECKOUT); del(PENDING); del(DIAG); del(HANDLED);
                window.location.href = "app.html";
              } else if (tries++ < 20) setTimeout(poll, 2000);
              else del(CHECKOUT);
            });
          })();
        },
        modal: { ondismiss: function () { del(CHECKOUT); } }
      });
      rz.open();
    }).catch(function () {
      del(CHECKOUT);
      busy = false;
      alert("Loan saved, but Loan Watch checkout could not be opened. Please use Track this loan again.");
    });
  }

  function saveAndContinue() {
    if (busy) return;
    if (!currentUser) return;
    var d = snapshot();
    if (!d) return;
    busy = true;
    set(HANDLED, "1");
    set(PENDING, "1");
    var run = {
      name: d.date + " · ₹" + Number(d.amount).toLocaleString("en-IN"),
      label: d.date + " · ₹" + Number(d.amount).toLocaleString("en-IN"),
      start_month: d.date,
      amount: d.amount,
      tenure_years: d.tenure,
      benchmark: d.benchmark,
      result: { verdict: d.verdict_text || "Saved diagnosis", diagnosis_snapshot: d.verdict_text || null }
    };
    db.saveRun(run).then(function (res) {
      if (!res.ok) {
        busy = false;
        del(HANDLED);
        alert(friendly(res));
        return;
      }
      db.track("loan_tracked", { stage: "post_diagnosis", benchmark: d.benchmark });
      del(PENDING);
      beginCheckout();
    });
  }

  function restoreAfterAuth() {
    if (!currentUser || get(PENDING) !== "1" || busy) return;
    var d = get(DIAG);
    if (!d) return;
    try {
      var x = JSON.parse(d);
      var date = document.getElementById("lr-date"), ten = document.getElementById("lr-ten"), amt = document.getElementById("lr-amt");
      if (date) date.value = x.date;
      if (ten) ten.value = x.tenure;
      if (amt) amt.value = x.amount;
      var radios = Array.prototype.slice.call(document.querySelectorAll('input[name="bm"]'));
      radios.forEach(function (r) { r.checked = r.value === x.benchmark; });
    } catch (e) {}
    setTimeout(saveAndContinue, 250);
  }

  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!b || !/^Track this loan/.test((b.textContent || "").trim())) return;
    savePending();
    if (currentUser) {
      e.preventDefault();
      e.stopImmediatePropagation();
      saveAndContinue();
    }
  }, true);

  db.onAuth(function (user) {
    currentUser = user || null;
    if (user) restoreAfterAuth();
  });

  var mo = new MutationObserver(function () {
    patchLabels();
    orderActions();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(function () { mo.disconnect(); }, 60000);
  patchLabels();
  orderActions();
})();
