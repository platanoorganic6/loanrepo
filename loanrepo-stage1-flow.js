/* LoanRepo Stage-1 commercial flow:
   diagnosis -> free report -> personalised Borrower's Guide (₹299) -> Stage 2.
   The existing Stage-2 bridge remains available, but its original Track action
   is hidden here so the paid tracking journey is offered only after the guide. */
(function () {
  var db = window.LoanRepoDB;
  if (!db) return;

  var PENDING = "loanrepo.pending_track";
  var DIAG = "loanrepo.pending_diagnosis";
  var CHECKOUT = "loanrepo.pending_checkout";
  var user = null, busy = false, ebookBusy = false;

  function isPage() {
    var p = (location.pathname || "").toLowerCase();
    return p === "/" || /\/index\.html$/.test(p);
  }
  if (!isPage()) return;

  function set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function del(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  function buttons() { return Array.prototype.slice.call(document.querySelectorAll("button")); }

  function oldTrack() {
    return buttons().find(function (b) { return /^Track this loan/i.test((b.textContent || "").trim()); });
  }

  function bookCta() {
    return buttons().find(function (b) {
      var t = (b.textContent || "").trim();
      return /THE BOOK|PERSONALISED BORROWER'S GUIDE/i.test(t) && /299/.test(t) && !b.id;
    });
  }

  function parseMoney(txt) {
    if (!txt) return null;
    var s = String(txt).replace(/₹/g, "").replace(/,/g, "").trim();
    var m = s.match(/^([0-9.]+)\s*(Cr|L|K)?$/i);
    if (!m) return null;
    var n = Number(m[1]);
    if (!isFinite(n)) return null;
    var unit = (m[2] || "").toLowerCase();
    if (unit === "cr") n *= 10000000;
    else if (unit === "l") n *= 100000;
    else if (unit === "k") n *= 1000;
    return Math.round(n);
  }

  function firstMatch(text, re) {
    var m = text.match(re);
    return m ? m[1] : "";
  }

  function addMonths(year, month, n) {
    var d = new Date(year, month - 1 + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  }

  function labelMonth(y, m) {
    return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  }

  function resetDates(start, benchmark) {
    var parts = String(start || "").split("-").map(Number);
    if (parts.length !== 2 || !parts[0] || !parts[1]) return [];
    var step = benchmark === "MCLR" ? 12 : 3;
    var now = new Date(2026, 8, 1);
    var base = new Date(parts[0], parts[1] - 1, 1);
    var months = (now.getFullYear() - base.getFullYear()) * 12 + (now.getMonth() - base.getMonth());
    var k = Math.floor(months / step) + 1;
    var out = [];
    for (var i = 0; i < 4; i++) {
      var d = addMonths(parts[0], parts[1], (k + i) * step);
      out.push(labelMonth(d.y, d.m));
    }
    return out;
  }

  function resultText() {
    var main = document.querySelector("main");
    return main ? (main.innerText || main.textContent || "").replace(/\s+/g, " ") : "";
  }

  function snapshot() {
    var d = document.getElementById("lr-date");
    var t = document.getElementById("lr-ten");
    var a = document.getElementById("lr-amt");
    if (!d || !t || !a) return null;

    var bm = document.querySelector('input[name="bm"]:checked');
    var sp = document.getElementById("lr-spread");
    var text = resultText();

    var actualYears = firstMatch(text, /Actual,?\s*after every rate reset\s+([0-9]+(?:\.[0-9]+)?)\s+years/i);
    var startRate = firstMatch(text, /from\s+([0-9]+(?:\.[0-9]+)?)%\s+at disbursal/i);
    var nowRate = firstMatch(text, /to\s+([0-9]+(?:\.[0-9]+)?)%\s+today/i);
    if (!nowRate) nowRate = firstMatch(text, /Effective rate today\s+([0-9]+(?:\.[0-9]+)?)%/i);
    var emiRaw = firstMatch(text, /EMI, then and now\s+₹?\s*([0-9.,]+(?:\s*(?:L|Cr|K))?)/i);
    var balRaw = firstMatch(text, /Outstanding now\s+₹?\s*([0-9.,]+(?:\s*(?:L|Cr|K))?)/i);

    return {
      date: d.value,
      tenure: Number(t.value),
      amount: Number(a.value),
      benchmark: bm ? bm.value : "EBLR",
      spread: sp ? sp.value : "",
      actualYears: Number(actualYears) || Number(t.value),
      startRate: Number(startRate) || null,
      nowRate: Number(nowRate) || null,
      emi: parseMoney(emiRaw),
      balance: parseMoney(balRaw),
      resets: resetDates(d.value, bm ? bm.value : "EBLR"),
      verdict_text: text.match(/Added to your loan, unannounced.{0,600}/i)
        ? text.match(/Added to your loan, unannounced.{0,600}/i)[0] : ""
    };
  }

  function savePending() {
    var d = snapshot();
    if (!d) return false;
    set(DIAG, JSON.stringify(d));
    set(PENDING, "1");
    return true;
  }

  function active(s) { return !!(s && s.plan === "pro" && s.status === "active"); }

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

  function checkout() {
    if (get(CHECKOUT) === "opening") return;
    set(CHECKOUT, "opening");
    db.fetchSubscription().then(function (s) {
      if (active(s)) { del(CHECKOUT); del(PENDING); del(DIAG); location.href = "app.html"; return null; }
      return loadRazorpay().then(function (ok) { if (!ok) throw Error("checkout"); return db.startCheckout(); });
    }).then(function (r) {
      if (!r) return;
      if (!r.ok || !r.subscriptionId) throw Error("checkout");
      var rz = new Razorpay({
        key: r.keyId, subscription_id: r.subscriptionId, name: "LoanRepo",
        description: "Loan Watch — ₹149/month", prefill: { email: user && user.email || "" },
        theme: { color: "#5980a6" },
        handler: function () {
          var n = 0;
          (function poll() { db.fetchSubscription().then(function (s) {
            if (active(s)) { del(CHECKOUT); del(PENDING); del(DIAG); location.href = "app.html"; }
            else if (n++ < 20) setTimeout(poll, 2000); else del(CHECKOUT);
          }); })();
        },
        modal: { ondismiss: function () { del(CHECKOUT); } }
      });
      rz.open();
    }).catch(function () {
      del(CHECKOUT); busy = false;
      alert("Loan saved, but Loan Watch checkout could not be opened. Please try again.");
    });
  }

  function trackNow() {
    if (busy) return;
    var d = snapshot();
    if (!d) return;
    savePending();
    if (!user) {
      var sign = buttons().find(function (b) { return /^Sign in$/i.test((b.textContent || "").trim()); });
      if (sign) { sign.click(); return; }
      alert("Please sign in to continue to Loan Watch."); return;
    }
    busy = true;
    db.saveRun({
      name: d.date + " · ₹" + Number(d.amount).toLocaleString("en-IN"),
      label: d.date + " · ₹" + Number(d.amount).toLocaleString("en-IN"),
      start_month: d.date, amount: d.amount, tenure_years: d.tenure, benchmark: d.benchmark,
      result: { verdict: d.verdict_text || "Saved diagnosis", diagnosis_snapshot: d }
    }).then(function (r) {
      if (!r.ok) { busy = false; alert("We couldn't save the loan just now. Nothing was lost — please try again."); return; }
      db.track("loan_tracked", { stage: "post_stage1", benchmark: d.benchmark });
      del(PENDING); checkout();
    });
  }

  function findBookSection() {
    var bs = bookCta();
    var all = Array.prototype.slice.call(document.querySelectorAll("div"));
    if (!bs) return null;
    return all.filter(function (x) {
      var tx = x.textContent || "";
      return /THE PDF ABOVE/i.test(tx) && /THE BOOK/i.test(tx) && /eight chapters/i.test(tx);
    }).sort(function (a, b) { return a.textContent.length - b.textContent.length; })[0] || bs.parentElement;
  }

  function openEbookModal() {
    if (ebookBusy) return;
    var existing = document.getElementById("lr-ebook-modal");
    if (existing) { existing.style.display = "flex"; return; }
    var overlay = document.createElement("div");
    overlay.id = "lr-ebook-modal";
    overlay.style.cssText = "position:fixed;inset:0;z-index:100;background:rgba(20,35,50,.62);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box";
    var box = document.createElement("div");
    box.style.cssText = "background:var(--color-bg,#fff);color:var(--color-text,#1d2d3d);width:min(520px,100%);padding:28px;box-sizing:border-box;box-shadow:0 12px 40px rgba(0,0,0,.22)";
    box.innerHTML = "<div style='font-family:var(--font-heading);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--color-accent-700);margin-bottom:10px'>Stage 1 · Take action</div>" +
      "<h2 style='font-family:var(--font-heading);font-size:30px;line-height:1.05;margin:0 0 12px'>Get your personalised Borrower's Guide</h2>" +
      "<p style='font-size:14px;line-height:1.55;margin:0 0 18px;color:var(--color-neutral-700)'>₹299 one-time. We use the loan figures from this diagnosis to prepare your personalised edition and email you a secure link after payment.</p>" +
      "<label style='display:block;font-size:12px;color:var(--color-neutral-700);margin-bottom:6px' for='lr-ebook-email'>Email address</label>" +
      "<input id='lr-ebook-email' type='email' style='width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--color-divider);font:inherit' placeholder='you@example.com'>" +
      "<div id='lr-ebook-modal-msg' style='min-height:22px;font-size:12px;color:var(--color-accent-800);margin-top:9px'></div>" +
      "<div style='display:flex;gap:10px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap'><button id='lr-ebook-cancel' type='button' class='btn btn-ghost'>Cancel</button><button id='lr-ebook-pay' type='button' class='btn btn-primary'>Continue to payment — ₹299</button></div>";
    overlay.appendChild(box); document.body.appendChild(overlay);
    var email = document.getElementById("lr-ebook-email");
    if (user && user.email) email.value = user.email;
    document.getElementById("lr-ebook-cancel").onclick = function () { overlay.style.display = "none"; };
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.style.display = "none"; });
    document.getElementById("lr-ebook-pay").onclick = function () { startEbookPurchase(email.value.trim(), overlay); };
    email.focus();
  }

  function startEbookPurchase(email, overlay) {
    if (ebookBusy) return;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      var m = document.getElementById("lr-ebook-modal-msg");
      if (m) m.textContent = "Enter the email address where the guide should be delivered.";
      return;
    }
    var d = snapshot();
    if (!d) return;
    ebookBusy = true;
    var msg = document.getElementById("lr-ebook-modal-msg");
    var pay = document.getElementById("lr-ebook-pay");
    if (msg) msg.textContent = "Preparing your personalised order…";
    if (pay) pay.disabled = true;

    var loanQuery = {
      name: user && user.email ? user.email.split("@")[0] : "",
      amount: String(d.amount),
      start: labelMonth(Number(d.date.slice(0, 4)), Number(d.date.slice(5, 7))),
      tenure: String(d.tenure),
      actual: Number(d.actualYears || d.tenure).toFixed(1),
      rate0: d.startRate == null ? "" : Number(d.startRate).toFixed(2),
      rate1: d.nowRate == null ? "" : Number(d.nowRate).toFixed(2),
      emi: d.emi == null ? "" : String(d.emi),
      bal: d.balance == null ? "" : String(d.balance),
      bm: d.benchmark,
      resets: (d.resets || []).join(",")
    };

    loadRazorpay().then(function (ok) {
      if (!ok) throw Error("razorpay");
      return db.startEbookOrder(email, loanQuery);
    }).then(function (res) {
      if (!res.ok || !res.orderId) throw Error(res.error || "order");
      var rz = new Razorpay({
        key: res.keyId, order_id: res.orderId, amount: res.amount, currency: "INR",
        name: "LoanRepo", description: "The Quiet Years — personalised Borrower's Guide",
        prefill: { email: email }, theme: { color: "#5980a6" },
        handler: function () {
          ebookBusy = false;
          if (overlay) overlay.style.display = "none";
          alert("Payment received. Your personalised Borrower's Guide is being emailed to " + email + ".");
          db.track("ebook_purchase_completed", { stage: "stage1a" });
        },
        modal: { ondismiss: function () { ebookBusy = false; if (pay) pay.disabled = false; if (msg) msg.textContent = "Checkout closed. Nothing was charged."; } }
      });
      if (msg) msg.textContent = "Opening secure payment…";
      rz.open();
    }).catch(function () {
      ebookBusy = false;
      if (pay) pay.disabled = false;
      if (msg) msg.textContent = "We couldn't open payment right now. Please try again.";
    });
  }

  function render() {
    var b = bookCta();
    var tr = oldTrack();
    var section = findBookSection();
    if (tr) { tr.style.display = "none"; tr.setAttribute("data-stage2-hidden", "true"); }
    if (b) { b.textContent = "GET YOUR PERSONALISED BORROWER'S GUIDE — ₹299"; b.setAttribute("data-loanrepo-ebook-cta", "true"); }
    if (!section) return false;
    if (!document.getElementById("lr-stage2-after-book")) {
      var wrap = document.createElement("div");
      wrap.id = "lr-stage2-after-book";
      wrap.style.cssText = "margin-top:20px;padding:18px 0 0;border-top:1px dashed var(--color-divider);display:flex;align-items:center;gap:16px;flex-wrap:wrap";
      var note = document.createElement("div");
      note.style.cssText = "font-size:12px;line-height:1.5;color:var(--color-neutral-700);margin-right:auto";
      note.innerHTML = "<b>Stage 2</b> · After you have used your personalised guide, keep LoanRepo watching the loan for ₹149/month.";
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "btn btn-primary"; btn.textContent = "TRACK THIS LOAN — ₹149/MONTH"; btn.addEventListener("click", trackNow);
      wrap.appendChild(note); wrap.appendChild(btn); section.parentNode.insertBefore(wrap, section.nextSibling);
    }
    return true;
  }

  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!b) return;
    var t = (b.textContent || "").trim();
    if (b.getAttribute("data-loanrepo-ebook-cta") === "true" || (/PERSONALISED BORROWER'S GUIDE/i.test(t) && /299/.test(t))) {
      e.preventDefault(); e.stopImmediatePropagation(); openEbookModal();
    }
  }, true);

  db.onAuth(function (u) { user = u || null; });
  var mo = new MutationObserver(function () { render(); });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(function () { mo.disconnect(); }, 60000);
  render();
})();
