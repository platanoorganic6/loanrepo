/* LoanRepo — resilient header sign-in fallback. */
(function () {
  var path = (location.pathname || "").toLowerCase();
  if (!(path === "/" || /\/index\.html$/.test(path))) return;
  if (window.__loanRepoAuthFallback) return;
  window.__loanRepoAuthFallback = true;

  function visibleAuthDialog() {
    var els = document.querySelectorAll(".dialog-backdrop");
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      var s = window.getComputedStyle(els[i]);
      if (r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden") return true;
    }
    return false;
  }

  function dbReady() {
    return window.LoanRepoDB && window.LoanRepoDB.enabled && window.LoanRepoDB.signInEmail;
  }

  function openFallback() {
    var old = document.getElementById("lr-auth-fallback");
    if (old) { old.style.display = "flex"; return; }
    var o = document.createElement("div");
    o.id = "lr-auth-fallback";
    o.style.cssText = "position:fixed;inset:0;z-index:100000;background:rgba(20,35,50,.72);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box";
    o.innerHTML = "<div style=\"position:relative;background:var(--color-bg,#fff);color:var(--color-text,#1d2d3d);width:min(500px,100%);padding:28px;box-sizing:border-box;box-shadow:0 12px 40px rgba(0,0,0,.28);font-family:var(--font-body,Arial,sans-serif)\"><div style=\"position:relative\"><div style=\"font-family:var(--font-heading,Arial,sans-serif);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--color-accent-700,#41618a);margin-bottom:10px\">LOANREPO</div><h2 style=\"font-family:var(--font-heading,Arial,sans-serif);font-size:30px;line-height:1.05;margin:0 0 12px\">Sign in</h2><p style=\"font-size:14px;line-height:1.55;margin:0 0 18px;color:var(--color-neutral-700,#555)\">Sign in with your email to access your private LoanRepo workspace. Signing in does not track or save your loan details.</p><label style=\"display:block;font-size:12px;margin-bottom:6px\" for=\"lr-auth-fallback-email\">Email a sign-in link</label><input id=\"lr-auth-fallback-email\" type=\"email\" autocomplete=\"email\" style=\"width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--color-divider,rgba(29,31,32,.16));font:inherit\" placeholder=\"you@example.com\"><div id=\"lr-auth-fallback-msg\" style=\"min-height:30px;font-size:12px;color:var(--color-accent-800,#355);margin-top:10px;line-height:1.5\"></div><div style=\"display:flex;gap:10px;justify-content:flex-end;margin-top:14px\"><button id=\"lr-auth-fallback-cancel\" type=\"button\" class=\"btn btn-ghost\">Cancel</button><button id=\"lr-auth-fallback-send\" type=\"button\" class=\"btn btn-primary\">Send link</button></div></div></div>";
    document.body.appendChild(o);
    var input = document.getElementById("lr-auth-fallback-email");
    var msg = document.getElementById("lr-auth-fallback-msg");
    var send = document.getElementById("lr-auth-fallback-send");
    var cancel = document.getElementById("lr-auth-fallback-cancel");
    cancel.onclick = function () { o.style.display = "none"; };
    o.onclick = function (e) { if (e.target === o) o.style.display = "none"; };
    send.onclick = function () {
      var email = (input.value || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "Enter a valid email address."; return; }
      if (!dbReady()) { msg.textContent = "Sign-in is still loading. Please try again in a moment."; return; }
      send.disabled = true;
      msg.textContent = "Sending your sign-in link…";
      window.LoanRepoDB.signInEmail(email).then(function (r) {
        send.disabled = false;
        msg.textContent = r && r.ok ? "Check your email and click the LoanRepo sign-in link." : ((r && r.error) || "Unable to send the sign-in link. Please try again.");
      }).catch(function (e) { send.disabled = false; msg.textContent = String(e && e.message || e || "Unable to send the sign-in link."); });
    };
    setTimeout(function () { if (input) input.focus(); }, 30);
  }

  /* Capture phase is important: the site's native action can stop propagation
     before a bubble-phase fallback listener ever sees the click. */
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("header button") : null;
    if (!b || !/^sign in$/i.test((b.textContent || "").trim())) return;
    setTimeout(function () { if (!visibleAuthDialog()) openFallback(); }, 350);
  }, true);
})();
