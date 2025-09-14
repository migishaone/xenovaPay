/* Xenova Pay embeddable helper (vanilla JS)
 * Usage:
 *   XenovaPay.open({
 *     apiBase: 'https://xenovalabs.com',
 *     phone: '250783456789',
 *     amount: 1000,
 *     currency: 'RWF',
 *     country: 'RWA',
 *     description: 'Order #123',
 *   });
 */
(function (global) {
  function openCenteredPopup(name, width, height) {
    var w = Math.min(width || 480, Math.max(360, (window.outerWidth || 800) - 40));
    var h = Math.min(height || 720, Math.max(520, (window.outerHeight || 600) - 80));
    var left = (window.screenX || 0) + Math.max(0, Math.round(((window.outerWidth || 800) - w) / 2));
    var top = (window.screenY || 0) + Math.max(0, Math.round(((window.outerHeight || 600) - h) / 2));
    var features = 'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top + ',' +
      'resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no';
    var popup = window.open('about:blank', name || 'pawapay-payment', features);
    if (popup) {
      popup.document.write('<html><head><title>Loading Payment...</title>' +
        '<meta name="viewport" content="width=device-width, initial-scale=1"/>' +
        '<style>body{font-family:system-ui;text-align:center;padding:40px;background:#f7f7fb}.s{border:4px solid #e5e7eb;border-top:4px solid #7c3aed;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin:0 auto 16px}@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}</style>' +
        '</head><body><div class="s"></div>Preparing payment…</body></html>');
    }
    return popup;
  }

  async function open(config) {
    var apiBase = (config && config.apiBase) || '';
    if (!apiBase) throw new Error('apiBase is required');
    var popup = openCenteredPopup('pawapay-payment');
    if (!popup) throw new Error('Popup blocked');

    var res = await fetch(apiBase + '/api/hosted-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        phoneNumber: String(config.phone || ''),
        amount: String(config.amount),
        currency: config.currency || 'RWF',
        description: config.description,
        country: config.country || 'RWA',
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    var payload = await res.json();
    var txId = payload.transactionId;
    var redirectUrl = payload.redirectUrl;

    var finished = false;
    function toReceipt() { finished = true; try { popup.close(); } catch(e){} window.location.assign('/receipt?id=' + encodeURIComponent(txId)); }
    function toFailed()  { finished = true; try { popup.close(); } catch(e){} window.location.assign('/payment-failed?id=' + encodeURIComponent(txId)); }

    window.addEventListener('message', function (e) {
      if (e.origin !== window.location.origin) return;
      if (e.data && e.data.transactionId === txId) {
        if (e.data.type === 'PAYMENT_COMPLETE') return toReceipt();
        if (e.data.type === 'PAYMENT_FAILED') return toFailed();
      }
    });

    async function poll() {
      if (finished) return;
      try {
        var r = await fetch(apiBase + '/api/payment-status/' + encodeURIComponent(txId), { credentials: 'include' });
        if (r.ok) {
          var d = await r.json();
          var s = String(d.status || '').toUpperCase();
          if (s === 'COMPLETED') return toReceipt();
          if (s === 'FAILED') return toFailed();
        }
      } finally {
        if (!finished) setTimeout(poll, 2000);
      }
    }
    setTimeout(poll, 1500);

    popup.location.replace(redirectUrl);
  }

  global.XenovaPay = { open: open };
})(window);

