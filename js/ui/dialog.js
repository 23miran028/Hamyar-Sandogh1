function _confirmAsk(opts) {
  const o = typeof opts === 'string' ? { message: opts } : (opts || {});
  return new Promise((resolve) => {
    openModal(`
      <div class="confirm-body">
        <div class="confirm-icon ${o.kind === 'danger' ? 'danger' : ''}">
          ${o.kind === 'danger' ? '⚠️' : '❓'}
        </div>
        <h3>${U.esc(o.title || 'تأیید عملیات')}</h3>
        <p>${U.esc(o.message || '')}</p>
        ${o.details ? `<div class="confirm-details">${U.esc(o.details)}</div>` : ''}  <!-- ← این خط مهم -->
        <div class="confirm-actions">
          <button class="btn plain" id="cf-no">${U.esc(o.cancelText || 'انصراف')}</button>
          <button class="btn ${o.kind === 'danger' ? 'danger' : 'solid'}" id="cf-yes">
            ${U.esc(o.confirmText || 'تأیید')}
          </button>
        </div>
      </div>`);
    // ...
  });
}