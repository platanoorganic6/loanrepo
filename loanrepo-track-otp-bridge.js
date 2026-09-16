/* LoanRepo Stage-2 OTP bridge.
   Keeps Stage 1 independent while making the existing Track-this-loan
   authentication compatible with the project-wide Supabase OTP email template.
   It never creates a tracked loan itself; the existing Stage-2 bridge remains
   the only owner of saveRun()/tracked_loans persistence. */
(function () {
  var db = window.LoanRepoDB;
  if (!db || !db.client) return;
  var active = false;
  var email = "";
  var busy = false;

  function isDiagnosisPage() {
    var p = (location.pathname || "").toLowerCase();
    return p === "/" || /\/index\.html$/.test(p);
  }
  if (!isDiagnosisPage()) return;

  function text(el) { return (el && (el.textContent || el.innerText) || "").trim(); }
  function findAuthDialog() {
    var ds = Array.prototype.slice.call(document.querySelectorAll(".dialog"));
    return ds.find(function (d) {
      var t = text(d.querySelector(".dialog-title"));
      return /sign in to/i.test(t);
    }) || null;
  }
  function setMessage(dialog, msg) {
    var nodes = Array.prototype.slice.call(dialog.querySelectorAll("div"));
    var m = nodes.find(function (n) { return n !== dialog && /Sending|Couldn't|Enter a valid|Link sent|sign-in|try again/i.test(text(n)); });
    if (m) m.textContent = msg;
  }
  function buildOtp(dialog) {
    if (!dialog || dialog.getAttribute("data-loanrepo-otp") === "true") return;
    var title = dialog.querySelector(".dialog-title");
    var body = dialog.querySelector(".dialog-body");
    var fields = dialog.querySelector(".field");
    var input = dialog.querySelector("#lr-email");
    var primary = Array.prototype.slice.call(dialog.querySelectorAll("button")).find(function (b) { return /send link/i.test(text(b)); });
    if (!title || !body || !input || !primary) return;

    dialog.setAttribute("data-loanrepo-otp", "true");
    title.textContent = "Sign in to track this loan";
    body.textContent = "Your diagnosis remains free. Sign in only when you choose to track this loan and continue to Loan Watch — ₹149/month.";
    if (fields) {
      var label = fields.querySelector("label");
      if (label) label.textContent = "Email address";
    }
    primary.textContent = "Send sign-in code";

    var codeWrap = document.createElement("div");
    codeWrap.style.cssText = "display:none;margin-top:12px";
    codeWrap.innerHTML = "<label style='display:block;font-size:12px;margin-bottom:6px' for='lr-track-otp'>6-digit OTP</label><input class='input' id='lr-track-otp' inputmode='numeric' maxlength='6' autocomplete='one-time-code' placeholder='123456' style='width:100%;box-sizing:border-box'>";
    if (fields) fields.parentNode.insertBefore(codeWrap, fields.nextSibling);

    primary.onclick = function () {
      var em = (input.value || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        setMessage(dialog, "Enter a valid email address.");
        return;
      }
      if (codeWrap.style.display === "block") {
        var codeInput = document.getElementById("lr-track-otp");
        var code = (codeInput && codeInput.value || "").trim();
        if (!/^\d{6}$/.test(code)) {
          setMessage(dialog, "Enter the 6-digit code.");
          return;
        }
        if (busy) return;
        busy = true;
        primary.disabled = true;
        setMessage(dialog, "Signing you in…");
        db.client.auth.verifyOtp({ email: email, token: code, type: "email" }).then(function (r) {
          busy = false;
          primary.disabled = false;
          if (r.error) {
            setMessage(dialog, r.error.message || "That code is invalid or expired. Please request a new code.");
            return;
          }
          setMessage(dialog, "Signed in. Saving your loan…");
          setTimeout(function () { primary.disabled = true; }, 0);
        });
        return;
      }

      if (busy) return;
      busy = true;
      email = em;
      primary.disabled = true;
      setMessage(dialog, "Sending your sign-in code…");
      db.client.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } }).then(function (r) {
        busy = false;
        primary.disabled = false;
        if (r.error) {
          setMessage(dialog, r.error.message || "Couldn't send the sign-in code. Please try again.");
          return;
        }
        codeWrap.style.display = "block";
        primary.textContent = "Verify code";
        setMessage(dialog, "Code sent. Check your inbox and enter the 6-digit code.");
        var codeInput = document.getElementById("lr-track-otp");
        if (codeInput) codeInput.focus();
      });
    };
  }

  var observer = new MutationObserver(function () {
    var d = findAuthDialog();
    if (d) buildOtp(d);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(function () { observer.disconnect(); }, 120000);
})();
