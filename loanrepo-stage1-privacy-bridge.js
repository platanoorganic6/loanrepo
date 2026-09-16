/* LoanRepo Stage-1 privacy boundary.
   The personalised guide uses the browser-held diagnosis to render the PDF.
   Payment/order endpoints receive no loan particulars, and status responses
   are rehydrated from sessionStorage only for the current browser journey. */
(function () {
  var db = window.LoanRepoDB;
  if (!db || !db.client || !db.client.functions) return;
  if (window.__loanRepoStage1PrivacyBridge) return;
  window.__loanRepoStage1PrivacyBridge = true;

  function pendingLoanQuery() {
    try {
      var raw = sessionStorage.getItem("loanrepo.ebook_account_pending");
      if (!raw) return null;
      var x = JSON.parse(raw);
      return x && x.loanQuery ? x.loanQuery : null;
    } catch (e) { return null; }
  }

  var originalInvoke = db.client.functions.invoke.bind(db.client.functions);
  db.client.functions.invoke = function (name, options) {
    if (name === "ebook-order-auth") {
      options = options || {};
      var body = options.body || {};
      options = Object.assign({}, options, {
        body: { email: body.email || undefined }
      });
    }
    return originalInvoke(name, options).then(function (result) {
      if (name === "ebook-status" && result && result.data && result.data.order) {
        var q = pendingLoanQuery();
        if (q) result.data.order.loanQuery = q;
      }
      return result;
    });
  };
})();
