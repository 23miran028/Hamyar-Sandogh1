/* =========================================================
   charts.js — نمودارهای SVG با طراحی حرفه‌ای
   ========================================================= */
window.App = window.App || {};

App.Charts = (function () {
  const U = App.Utils;
  const NS = 'http://www.w3.org/2000/svg';

  /* ---------- ابزارها ---------- */
  function svg(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9);
  }

  function ensureHost(host) {
    if (!host) return null;
    /* ایجاد tooltip اگر نیست */
    if (!host.querySelector('.chart-tooltip')) {
      const tip = document.createElement('div');
      tip.className = 'chart-tooltip';
      host.appendChild(tip);
    }
    host.style.position = 'relative';
    return host;
  }

  function showTooltip(host, x, y, html) {
    const tip = host.querySelector('.chart-tooltip');
    if (!tip) return;
    tip.innerHTML = html;
    tip.classList.add('show');
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  function hideTooltip(host) {
    const tip = host.querySelector('.chart-tooltip');
    if (tip) tip.classList.remove('show');
  }

  /* ---------- Curve: تبدیل نقاط به مسیر Bezier نرم ---------- */
  function smoothPath(pts, tension = 0.35) {
    if (pts.length < 2) return '';
    if (pts.length === 2) {
      return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;
    }

    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) * tension / 3;
      const cp1y = p1.y + (p2.y - p0.y) * tension / 3;
      const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
      const cp2y = p2.y - (p3.y - p1.y) * tension / 3;

      d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x},${p2.y}`;
    }
    return d;
  }

  /* =========================================================
     ۱) Line Chart — نمودار خطی حرفه‌ای
     ========================================================= */
  function line(host, pts, opts = {}) {
    ensureHost(host);
    host.innerHTML = '';
    ensureHost(host);

    if (!pts || !pts.length) {
      host.innerHTML = '<div class="empty-chart">📉 داده‌ای برای نمایش نیست</div>';
      return;
    }

    const color = opts.color || 'var(--brand-500)';
    const color2 = opts.color2 || null;
    const H = opts.height || 260;
    const W = Math.max(host.clientWidth || 620, 320);
    const P = { t: 22, r: 20, b: 42, l: 82 };
    const iw = W - P.l - P.r;
    const ih = H - P.t - P.b;

    /* محدوده Y */
    let vals = pts.map(p => U.num(p.v));
    let max = Math.max(...vals);
    let min = Math.min(...vals);
    if (max === min) { max += Math.abs(max || 1) * 0.25 + 1; min = Math.max(0, min - 1); }
    const pad = (max - min) * 0.12;
    max += pad;
    min = Math.max(0, min - pad);
    const span = max - min || 1;

    /* موقعیت */
    const X = i => P.l + (pts.length === 1 ? iw / 2 : i * iw / (pts.length - 1));
    const Y = v => P.t + ih - ((v - min) / span) * ih;

    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, class: 'chart-svg' });
    s.style.direction = 'ltr';

    /* defs */
    const defs = svg('defs');
    const gradId = uid('grad');
    const areaGrad = svg('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' });
    areaGrad.appendChild(svg('stop', { offset: '0%',   'stop-color': color, 'stop-opacity': '.30' }));
    areaGrad.appendChild(svg('stop', { offset: '55%',  'stop-color': color, 'stop-opacity': '.10' }));
    areaGrad.appendChild(svg('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': '0' }));
    defs.appendChild(areaGrad);

    /* فیلتر سایه برای خط */
    const shadowId = uid('sh');
    const shadow = svg('filter', { id: shadowId, x: '-20%', y: '-20%', width: '140%', height: '140%' });
    shadow.appendChild(svg('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: '3', result: 'blur' }));
    shadow.appendChild(svg('feOffset', { in: 'blur', dy: '2', result: 'off' }));
    shadow.appendChild(svg('feComponentTransfer', { in: 'off', result: 'off2' }));
    const comp = shadow.querySelector('feComponentTransfer');
    comp.appendChild(svg('feFuncA', { type: 'linear', slope: '0.15' }));
    const merge = svg('feMerge');
    merge.appendChild(svg('feMergeNode', { in: 'off2' }));
    merge.appendChild(svg('feMergeNode', { in: 'SourceGraphic' }));
    shadow.appendChild(merge);
    defs.appendChild(shadow);

    s.appendChild(defs);

    /* Grid افقی + برچسب محور Y */
    for (let i = 0; i <= 4; i++) {
      const v = min + span * i / 4;
      const y = Y(v);
      s.appendChild(svg('line', {
        x1: P.l, x2: W - P.r, y1: y, y2: y,
        stroke: 'currentColor',
        'stroke-opacity': i === 0 ? '.18' : '.08',
        'stroke-dasharray': i === 0 ? '' : '3 4'
      }));
      const t = svg('text', {
        x: P.l - 10, y: y + 4,
        'text-anchor': 'end', 'font-size': '10.5',
        'font-weight': '600',
        fill: 'currentColor', 'fill-opacity': '.55',
        'font-family': 'Vazirmatn, Tahoma, sans-serif'
      });
      t.textContent = U.shortMoney(v);
      s.appendChild(t);
    }

    /* نقاط برای منحنی */
    const points = pts.map((p, i) => ({ x: X(i), y: Y(U.num(p.v)), v: U.num(p.v), l: p.l }));

    /* مسیر خطی */
    const lineD = smoothPath(points, 0.32);

    /* ناحیه زیر خط */
    const areaD = lineD +
      ` L${points[points.length - 1].x},${(P.t + ih)} L${points[0].x},${(P.t + ih)} Z`;

    /* انیمیشن ورود */
    const area = svg('path', {
      d: areaD, fill: `url(#${gradId})`,
      class: 'chart-area'
    });
    s.appendChild(area);

    const path = svg('path', {
      d: lineD,
      fill: 'none',
      stroke: color,
      'stroke-width': 2.6,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
      filter: `url(#${shadowId})`,
      class: 'chart-line',
      'stroke-dasharray': '2000',
      'stroke-dashoffset': '2000'
    });
    s.appendChild(path);

    /* خط عمودی راهنما (hover) */
    const vline = svg('line', {
      x1: 0, x2: 0, y1: P.t, y2: P.t + ih,
      stroke: color, 'stroke-opacity': '.25',
      'stroke-width': 1.5,
      'stroke-dasharray': '4 4',
      opacity: 0,
      'pointer-events': 'none'
    });
    s.appendChild(vline);

    /* نقاط */
    const dots = [];
    points.forEach((p, i) => {
      const g = svg('g', { class: 'chart-dot-group' });

      /* دایره‌ی بزرگ شفاف برای hover area */
      const hit = svg('circle', {
        cx: p.x, cy: p.y, r: 14,
        fill: 'transparent',
        style: 'cursor:pointer'
      });

      /* دایره‌ی اصلی */
      const c = svg('circle', {
        cx: p.x, cy: p.y, r: 4,
        fill: 'var(--panel)',
        stroke: color,
        'stroke-width': 2.2,
        class: 'chart-dot',
        style: 'opacity:0;transition:opacity .4s'
      });

      g.appendChild(c);
      g.appendChild(hit);
      s.appendChild(g);
      dots.push(c);

      /* Tooltip تعاملی */
      hit.addEventListener('mouseenter', () => {
        vline.setAttribute('x1', p.x);
        vline.setAttribute('x2', p.x);
        vline.setAttribute('opacity', '1');
        c.setAttribute('r', 6);
        c.setAttribute('stroke-width', 3);

        const hostRect = host.getBoundingClientRect();
        const svgRect = s.getBoundingClientRect();
        const scaleX = svgRect.width / W;
        const scaleY = svgRect.height / H;
        const px = p.x * scaleX;
        const py = p.y * scaleY;

        showTooltip(host, px, py - 8,
          `<div class="ct-label">${U.esc(p.l)}</div>
           <div class="ct-value">${U.fmt(p.v)} <span class="ct-unit">تومان</span></div>`);
      });

      hit.addEventListener('mouseleave', () => {
        vline.setAttribute('opacity', '0');
        c.setAttribute('r', 4);
        c.setAttribute('stroke-width', 2.2);
        hideTooltip(host);
      });
    });

    /* برچسب محور X */
    const step = Math.max(1, Math.ceil(pts.length / 8));
    pts.forEach((p, i) => {
      if (i % step !== 0 && i !== pts.length - 1) return;
      const t = svg('text', {
        x: X(i), y: H - 14,
        'text-anchor': 'middle',
        'font-size': '10.5',
        'font-weight': '600',
        fill: 'currentColor', 'fill-opacity': '.55',
        'font-family': 'Vazirmatn, Tahoma, sans-serif'
      });
      t.textContent = p.l;
      s.appendChild(t);
    });

    host.appendChild(s);

    /* انیمیشن ترسیم */
    requestAnimationFrame(() => {
      path.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)';
      path.style.strokeDashoffset = '0';
      setTimeout(() => {
        dots.forEach((c, i) => setTimeout(() => {
          c.style.opacity = '1';
          c.style.transform = 'scale(1)';
        }, i * 30));
      }, 400);
    });
  }

  /* =========================================================
     ۲) Bar Chart — نمودار ستونی حرفه‌ای
     ========================================================= */
  function bars(host, pts, opts = {}) {
    ensureHost(host);
    host.innerHTML = '';
    ensureHost(host);

    if (!pts || !pts.length) {
      host.innerHTML = '<div class="empty-chart">📊 داده‌ای برای نمایش نیست</div>';
      return;
    }

    const color = opts.color || 'var(--brand-500)';
    const H = opts.height || 260;
    const W = Math.max(host.clientWidth || 620, 320);
    const P = { t: 22, r: 20, b: 44, l: 82 };
    const iw = W - P.l - P.r;
    const ih = H - P.t - P.b;

    const max = Math.max(...pts.map(p => U.num(p.v)), 1) * 1.15;
    const bw = Math.max(6, Math.min(52, iw / pts.length * 0.62));
    const X = i => P.l + (i + 0.5) * (iw / pts.length);
    const Y = v => P.t + ih - (U.num(v) / max) * ih;

    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, class: 'chart-svg' });
    s.style.direction = 'ltr';

    /* defs */
    const defs = svg('defs');
    const barGradId = uid('bar');
    const barGrad = svg('linearGradient', { id: barGradId, x1: '0', y1: '0', x2: '0', y2: '1' });
    barGrad.appendChild(svg('stop', { offset: '0%',   'stop-color': color, 'stop-opacity': '1' }));
    barGrad.appendChild(svg('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': '.65' }));
    defs.appendChild(barGrad);

    const barHoverId = uid('barh');
    const barHover = svg('linearGradient', { id: barHoverId, x1: '0', y1: '0', x2: '0', y2: '1' });
    barHover.appendChild(svg('stop', { offset: '0%',   'stop-color': color, 'stop-opacity': '1' }));
    barHover.appendChild(svg('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': '.85' }));
    defs.appendChild(barHover);

    s.appendChild(defs);

    /* Grid افقی */
    for (let i = 0; i <= 4; i++) {
      const v = max * i / 4;
      const y = Y(v);
      s.appendChild(svg('line', {
        x1: P.l, x2: W - P.r, y1: y, y2: y,
        stroke: 'currentColor',
        'stroke-opacity': i === 0 ? '.18' : '.08',
        'stroke-dasharray': i === 0 ? '' : '3 4'
      }));
      const t = svg('text', {
        x: P.l - 10, y: y + 4,
        'text-anchor': 'end', 'font-size': '10.5', 'font-weight': '600',
        fill: 'currentColor', 'fill-opacity': '.55',
        'font-family': 'Vazirmatn, Tahoma, sans-serif'
      });
      t.textContent = U.shortMoney(v);
      s.appendChild(t);
    }

    /* ستون‌ها */
    pts.forEach((p, i) => {
      const v = U.num(p.v);
      const y = Y(v);
      const h = Math.max(2, P.t + ih - y);
      const x = X(i) - bw / 2;

      const g = svg('g', { class: 'chart-bar-group', style: 'cursor:pointer' });

      /* پس‌زمینه‌ی shadowی (هنگام hover) */
      const hoverBg = svg('rect', {
        x: X(i) - bw / 2 - 4, y: P.t,
        width: bw + 8, height: ih,
        fill: color, 'fill-opacity': '0',
        rx: 6,
        class: 'chart-bar-hover-bg',
        style: 'transition:fill-opacity .2s'
      });
      g.appendChild(hoverBg);

      const r = svg('rect', {
        x, y, width: bw, height: h,
        rx: Math.min(6, bw / 2),
        fill: `url(#${barGradId})`,
        class: 'chart-bar',
        style: 'transform-origin: ' + (x + bw/2) + 'px ' + (P.t + ih) + 'px; transform: scaleY(0); transition: transform .6s cubic-bezier(.34,1.3,.64,1), fill .2s'
      });
      g.appendChild(r);

      /* Tooltip */
      g.addEventListener('mouseenter', () => {
        hoverBg.setAttribute('fill-opacity', '.06');
        r.style.fill = `url(#${barHoverId})`;
        r.setAttribute('filter', `url(#${shadowIdGlobal(host)})`);

        const svgRect = s.getBoundingClientRect();
        const scaleX = svgRect.width / W;
        const scaleY = svgRect.height / H;
        const px = X(i) * scaleX;
        const py = y * scaleY;

        showTooltip(host, px, py - 8,
          `<div class="ct-label">${U.esc(p.l)}</div>
           <div class="ct-value">${U.fmt(v)} <span class="ct-unit">تومان</span></div>`);
      });

      g.addEventListener('mouseleave', () => {
        hoverBg.setAttribute('fill-opacity', '0');
        r.style.fill = `url(#${barGradId})`;
        r.removeAttribute('filter');
        hideTooltip(host);
      });

      /* انیمیشن ورود با تأخیر */
      requestAnimationFrame(() => {
        setTimeout(() => {
          r.style.transform = 'scaleY(1)';
        }, i * 40);
      });

      s.appendChild(g);
    });

    /* برچسب محور X */
    const step = Math.max(1, Math.ceil(pts.length / 8));
    pts.forEach((p, i) => {
      if (i % step !== 0 && i !== pts.length - 1) return;
      const t = svg('text', {
        x: X(i), y: H - 14,
        'text-anchor': 'middle',
        'font-size': '10.5', 'font-weight': '600',
        fill: 'currentColor', 'fill-opacity': '.55',
        'font-family': 'Vazirmatn, Tahoma, sans-serif'
      });
      t.textContent = p.l;
      s.appendChild(t);
    });

    host.appendChild(s);
  }

  /* ---------- کمک برای shadow در bar hover ---------- */
  function shadowIdGlobal() { return 'barShGlobal'; }

  /* =========================================================
     ۳) Donut Chart — نمودار دایره‌ای توخالی
     ========================================================= */
  function donut(host, data, opts = {}) {
    ensureHost(host);
    host.innerHTML = '';
    ensureHost(host);

    if (!data || !data.length) {
      host.innerHTML = '<div class="empty-chart">🍩 داده‌ای برای نمایش نیست</div>';
      return;
    }

    const size = opts.size || 240;
    const thickness = opts.thickness || 28;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 12;
    const innerRadius = radius - thickness;

    const total = data.reduce((s, d) => s + U.num(d.value), 0);
    if (total === 0) {
      host.innerHTML = '<div class="empty-chart">🍩 داده‌ای برای نمایش نیست</div>';
      return;
    }

    const s = svg('svg', {
      viewBox: `0 0 ${size} ${size}`,
      width: size, height: size,
      class: 'chart-svg donut-svg',
      style: 'display:block;margin:0 auto'
    });
    s.style.direction = 'ltr';

    const defs = svg('defs');
    s.appendChild(defs);

    /* زاویه‌ها */
    let angle = -Math.PI / 2; /* شروع از بالا */
    const gap = 0.025; /* فاصله بین قطعات */

    data.forEach((d, i) => {
      const value = U.num(d.value);
      const ratio = value / total;
      const angleEnd = angle + ratio * Math.PI * 2;

      /* اگر فقط یک قطعه یا نزدیک ۱۰۰٪، دایره‌ی کامل */
      if (ratio >= 0.999) {
        s.appendChild(svg('circle', {
          cx: centerX, cy: centerY,
          r: (radius + innerRadius) / 2,
          fill: 'none',
          stroke: d.color || 'var(--brand-500)',
          'stroke-width': thickness,
          class: 'chart-donut-segment',
          'data-idx': i
        }));
      } else {
        const start = angle + gap;
        const end = angleEnd - gap;

        const x1 = centerX + radius * Math.cos(start);
        const y1 = centerY + radius * Math.sin(start);
        const x2 = centerX + radius * Math.cos(end);
        const y2 = centerY + radius * Math.sin(end);
        const x3 = centerX + innerRadius * Math.cos(end);
        const y3 = centerY + innerRadius * Math.sin(end);
        const x4 = centerX + innerRadius * Math.cos(start);
        const y4 = centerY + innerRadius * Math.sin(start);

        const largeArc = ratio > 0.5 ? 1 : 0;
        const pathD = `M${x1},${y1} A${radius},${radius} 0 ${largeArc} 1 ${x2},${y2} L${x3},${y3} A${innerRadius},${innerRadius} 0 ${largeArc} 0 ${x4},${y4} Z`;

        const seg = svg('path', {
          d: pathD,
          fill: d.color || 'var(--brand-500)',
          class: 'chart-donut-segment',
          'data-idx': i,
          style: 'transition:opacity .2s, transform .2s; transform-origin:' + centerX + 'px ' + centerY + 'px'
        });

        seg.addEventListener('mouseenter', () => {
          seg.style.opacity = '.85';
          seg.style.transform = 'scale(1.04)';
          showTooltip(host,
            centerX + size * 0.5, centerY,
            `<div class="ct-label">${U.esc(d.label)}</div>
             <div class="ct-value">${U.fmt(value)} <span class="ct-unit">تومان</span></div>
             <div class="ct-extra">${U.toFa((ratio * 100).toFixed(1))}٪</div>`);
        });
        seg.addEventListener('mouseleave', () => {
          seg.style.opacity = '1';
          seg.style.transform = 'scale(1)';
          hideTooltip(host);
        });

        s.appendChild(seg);
      }

      angle = angleEnd;
    });

    /* متن مرکز */
    const centerLabel = opts.centerLabel || 'جمع';
    const centerValue = opts.centerValue != null ? opts.centerValue : total;

    const cLabel = svg('text', {
      x: centerX, y: centerY - 6,
      'text-anchor': 'middle',
      'font-size': '11.5', 'font-weight': '700',
      fill: 'currentColor', 'fill-opacity': '.5',
      'font-family': 'Vazirmatn, Tahoma, sans-serif'
    });
    cLabel.textContent = centerLabel;
    s.appendChild(cLabel);

    const cValue = svg('text', {
      x: centerX, y: centerY + 14,
      'text-anchor': 'middle',
      'font-size': '17', 'font-weight': '800',
      fill: 'currentColor',
      'font-family': 'Vazirmatn, Tahoma, sans-serif'
    });
    cValue.textContent = U.shortMoney(centerValue);
    s.appendChild(cValue);

    host.appendChild(s);
  }

  /* =========================================================
     ۴) Sparkline — نمودار خطی کوچک برای داخل کارت
     ========================================================= */
  function sparkline(host, values, opts = {}) {
    if (!host) return;
    host.innerHTML = '';

    if (!values || !values.length) return;

    const W = opts.width || 100;
    const H = opts.height || 32;
    const color = opts.color || 'var(--brand-500)';

    let max = Math.max(...values);
    let min = Math.min(...values);
    if (max === min) { max += 1; min = Math.max(0, min - 1); }
    const span = max - min;
    const pad = 4;

    const X = i => pad + i * (W - pad * 2) / Math.max(1, values.length - 1);
    const Y = v => H - pad - ((v - min) / span) * (H - pad * 2);

    const s = svg('svg', {
      viewBox: `0 0 ${W} ${H}`,
      width: '100%', height: H,
      class: 'chart-svg sparkline-svg',
      preserveAspectRatio: 'none'
    });

    const pts = values.map((v, i) => ({ x: X(i), y: Y(v) }));
    const d = smoothPath(pts, 0.4);

    s.appendChild(svg('path', {
      d: d + ` L${X(values.length - 1)},${H} L${X(0)},${H} Z`,
      fill: color,
      'fill-opacity': '.15'
    }));

    s.appendChild(svg('path', {
      d, fill: 'none',
      stroke: color,
      'stroke-width': 1.8,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round'
    }));

    /* نقطه پایان */
    const lastP = pts[pts.length - 1];
    s.appendChild(svg('circle', {
      cx: lastP.x, cy: lastP.y, r: 2.4,
      fill: color,
      stroke: 'var(--panel)',
      'stroke-width': 1.6
    }));

    host.appendChild(s);
  }

  /* =========================================================
     Export
     ========================================================= */
  return { line, bars, donut, sparkline };
})();