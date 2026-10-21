/* =========================================================
   views/member-edit.js — افزودن/ویرایش عضو (self-contained)
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.memberEdit = function (root, state, opts = {}) {
  const U = App.Utils;
  const MS = App.MemberService;
  const code = opts.code || null;
  const isEdit = !!code;

  (async () => {
    const member = isEdit ? await MS.get(code) : null;
    if (isEdit && !member) {
      App.UI.toast?.error('عضو یافت نشد');
      App.Views.members(root, state);
      return;
    }

    const field = (id, label, value = '', type = 'text', required = false, hint = '') => `
      <div class="field">
        <label for="f-${id}">${U.esc(label)}${required ? ' <span class="req">*</span>' : ''}</label>
        <input id="f-${id}" type="${type}" value="${U.esc(value)}">
        ${hint ? `<div class="field-hint">${U.esc(hint)}</div>` : ''}
        <div class="field-error" data-error="${id}"></div>
      </div>`;

    root.innerHTML = `
      <div class="card">
        <div class="controls">
          <button class="btn plain" id="backBtn">← بازگشت به فهرست اعضا</button>
          <span class="spacer"></span>
          <h3 style="margin:0">${isEdit ? 'ویرایش عضو' : 'افزودن عضو جدید'}</h3>
        </div>

        <div id="formAlert"></div>

        <form id="memberForm" autocomplete="off" style="max-width:640px">
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px">
            ${field('code', 'کد عضو', member?.code || '', 'text', true, 'کد یکتا برای شناسایی')}
            ${field('name', 'نام کامل', member?.name || '', 'text', true)}
          </div>

          <div class="field">
            <label for="f-status">وضعیت</label>
            <select id="f-status">
              <option value="active" ${(!member || member.status === 'active') ? 'selected' : ''}>فعال</option>
              <option value="inactive" ${member?.status === 'inactive' ? 'selected' : ''}>غیرفعال</option>
            </select>
          </div>

          <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px">
            ${field('phone', 'شماره تماس', member?.phone || '')}
            ${field('nationalId', 'کد ملی', member?.nationalId || '')}
          </div>

          <div class="field">
            <label for="f-note">یادداشت</label>
            <textarea id="f-note" rows="3">${U.esc(member?.note || '')}</textarea>
          </div>

          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
            <button type="button" class="btn plain" id="cancelBtn">انصراف</button>
            <button type="submit" class="btn solid">${isEdit ? '💾 ذخیره تغییرات' : '➕ افزودن عضو'}</button>
          </div>
        </form>
      </div>`;

    if (isEdit) root.querySelector('#f-code').disabled = true;

    const form = root.querySelector('#memberForm');
    const alertBox = root.querySelector('#formAlert');

    root.querySelector('#backBtn').onclick   = () => App.Views.members(root, state);
    root.querySelector('#cancelBtn').onclick = () => App.Views.members(root, state);

    form.onsubmit = async (e) => {
      e.preventDefault();
      alertBox.innerHTML = '';
      form.querySelectorAll('.field-error').forEach(x => x.textContent = '');
      form.querySelectorAll('.field').forEach(x => x.classList.remove('has-error'));

      const data = {
        code:       form.querySelector('#f-code').value.trim(),
        name:       form.querySelector('#f-name').value.trim(),
        status:     form.querySelector('#f-status').value,
        phone:      form.querySelector('#f-phone').value.trim(),
        nationalId: form.querySelector('#f-nationalId').value.trim(),
        note:       form.querySelector('#f-note').value.trim()
      };

      try {
        if (isEdit) {
          delete data.code;
          await MS.update(code, data);
          App.UI.toast?.success('تغییرات ذخیره شد');
        } else {
          await MS.create(data);
          App.UI.toast?.success('عضو جدید افزوده شد');
        }
        await App.DataService.loadAll(state);
        App.Views.members(root, state);
      } catch (err) {
        console.error(err);
        if (err.code === 'VALIDATION' && err.details) {
          for (const [k, msg] of Object.entries(err.details)) {
            const el = form.querySelector(`[data-error="${k}"]`);
            if (el) {
              el.textContent = msg;
              el.closest('.field')?.classList.add('has-error');
            }
          }
        }
        alertBox.innerHTML = `<div class="form-alert danger">${U.esc(err.message)}</div>`;
      }
    };

    setTimeout(() => form.querySelector(isEdit ? '#f-name' : '#f-code')?.focus(), 100);
  })();
};