/* =========================================================
   views/reports.js — مرکز گزارش‌ها
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.reports = function (root, state) {
  const U = App.Utils;
  const Auth = App.AuthService;

  const periods = state.months || [];
  const years = state.years || [];
  const members = [...state.members.values()].sort((a, b) => String(a.code).localeCompare(String(b.code)));

  const lastPeriod = periods[periods.length - 1];

  root.innerHTML = `
    <div class="card">
      <h3><span class="dot"></span> مرکز گزارش‌ها</h3>
      <p style="color:var(--muted);font-size:13px;margin:-4px 0 16px">
        یکی از گزارش‌های زیر را انتخاب کنید. پس از مشاهده، می‌توانید آن را <b>چاپ</b> (PDF) یا در قالب <b>Excel/CSV</b> خروجی بگیرید.
      </p>

      <div class="report-grid">

        <!-- کارنامه عضو -->
        <div class="report-card" data-report="member-statement">
          <div class="report-card-icon">📋</div>
          <div class="report-card-title">کارنامه عضو</div>
          <div class="report-card-desc">
            سابقه کامل مالی یک عضو شامل وام‌ها، اقساط و واریزها
          </div>
          <div class="report-card-control">
            <select id="opt-member">
              ${members.map(m => `<option value="${U.esc(m.code)}">${U.esc(m.code)} — ${U.esc(m.name)}</option>`).join('')}
            </select>
          </div>
          <button class="btn solid js-run-report" data-report="member-statement">مشاهده گزارش</button>
        </div>

        <!-- صورت‌جلسه ماهانه -->
        <div class="report-card" data-report="meeting-minutes">
          <div class="report-card-icon">📝</div>
          <div class="report-card-title">صورت‌جلسه ماهانه</div>
          <div class="report-card-desc">
            گزارش کامل یک ماه شامل ریز حساب همه اعضا و آمار دوره
          </div>
          <div class="report-card-control">
            <select id="opt-period">
              ${periods.slice().reverse().map(p => `<option value="${U.esc(p.key)}" ${p.key === lastPeriod?.key ? 'selected' : ''}>${U.monthLabel(p)}</option>`).join('')}
            </select>
          </div>
          <button class="btn solid js-run-report" data-report="meeting-minutes">مشاهده گزارش</button>
        </div>

        <!-- وام‌های جاری -->
        <div class="report-card" data-report="active-loans">
          <div class="report-card-icon">💳</div>
          <div class="report-card-title">وام‌های جاری</div>
          <div class="report-card-desc">
            فهرست کامل وام‌های فعال با زمان تسویه
          </div>
          <div class="report-card-control" style="color:var(--muted);font-size:12.5px;text-align:center;padding:8px">
            آماده برای مشاهده
          </div>
          <button class="btn solid js-run-report" data-report="active-loans">مشاهده گزارش</button>
        </div>

        <!-- اقساط معوق -->
        <div class="report-card" data-report="overdue">
          <div class="report-card-icon">⚠️</div>
          <div class="report-card-title">اقساط معوق</div>
          <div class="report-card-desc">
            فهرست اقساطی که سررسید شده‌اند و پرداخت نشده‌اند
          </div>
          <div class="report-card-control" style="color:var(--muted);font-size:12.5px;text-align:center;padding:8px">
            آماده برای مشاهده
          </div>
          <button class="btn solid js-run-report" data-report="overdue">مشاهده گزارش</button>
        </div>

        <!-- ترازنامه -->
        <div class="report-card" data-report="balance-sheet">
          <div class="report-card-icon">⚖️</div>
          <div class="report-card-title">ترازنامه صندوق</div>
          <div class="report-card-desc">
            وضعیت دارایی‌ها، حقوق اعضا و آمار کل صندوق
          </div>
          <div class="report-card-control" style="color:var(--muted);font-size:12.5px;text-align:center;padding:8px">
            آماده برای مشاهده
          </div>
          <button class="btn solid js-run-report" data-report="balance-sheet">مشاهده گزارش</button>
        </div>

        <!-- فهرست اعضا -->
        <div class="report-card" data-report="members-list">
          <div class="report-card-icon">👥</div>
          <div class="report-card-title">فهرست اعضا</div>
          <div class="report-card-desc">
            لیست کامل اعضا با سرمایه و وضعیت وام
          </div>
          <div class="report-card-control" style="color:var(--muted);font-size:12.5px;text-align:center;padding:8px">
            آماده برای مشاهده
          </div>
          <button class="btn solid js-run-report" data-report="members-list">مشاهده گزارش</button>
        </div>

        <!-- خلاصه سالانه -->
        <div class="report-card" data-report="yearly-summary">
          <div class="report-card-icon">📅</div>
          <div class="report-card-title">خلاصه سالانه</div>
          <div class="report-card-desc">
            عملکرد یک سال شامل واریزها، اقساط و وام‌ها
          </div>
          <div class="report-card-control">
            <select id="opt-year">
              ${years.map(y => `<option value="${U.esc(y.year)}">${U.toFa(y.year)}</option>`).join('')}
            </select>
          </div>
          <button class="btn solid js-run-report" data-report="yearly-summary">مشاهده گزارش</button>
        </div>

      </div>
    </div>`;

  /* رویدادها */
  root.querySelectorAll('.js-run-report').forEach(btn => {
    btn.onclick = () => {
      const type = btn.dataset.report;
      const params = {};

      if (type === 'member-statement') {
        params.memberCode = root.querySelector('#opt-member').value;
      } else if (type === 'meeting-minutes') {
        params.periodKey = root.querySelector('#opt-period').value;
      } else if (type === 'yearly-summary') {
        params.year = root.querySelector('#opt-year').value;
      }

      App.Views.reportViewer(root, state, { type, params });
    };
  });
};