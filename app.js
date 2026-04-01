/**
 * Hash-based router and screen renderers.
 */
const App = {
  container: null,
  currentScreen: null,

  screens: {
    home:     { tab: 'home',      render: null },
    workout:  { tab: null,        render: null },
    exercise: { tab: null,        render: null },
    prep:     { tab: null,        render: null },
    nutrition:{ tab: 'nutrition',  render: null },
    body:     { tab: 'body',      render: null },
    compare:  { tab: 'body',      render: null },
    ai:       { tab: 'ai',        render: null },
    'body-add':  { tab: null, render: null },
    'body-edit': { tab: null, render: null },
    settings: { tab: null,        render: null },
  },

  init() {
    this.container = document.getElementById('screen-container');

    // Telegram WebApp setup
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.BackButton.onClick(() => history.back());
    }

    // Tab bar clicks
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const route = tab.dataset.route;
        location.hash = '#' + route;
        if (tg) tg.HapticFeedback.impactOccurred('light');
      });
    });

    // Route on hash change
    window.addEventListener('hashchange', () => this.route());
    this.route();
  },

  route() {
    const hash = location.hash.slice(1) || 'home';
    const parts = hash.split('/');
    const screenName = parts[0];
    const param = parts[1] ? decodeURIComponent(parts[1]) : null;

    const screen = this.screens[screenName];
    if (!screen) {
      location.hash = '#home';
      return;
    }

    // Tab bar: show on main tabs, hide on sub-screens
    const isSubScreen = !screen.tab;
    document.body.classList.toggle('hide-tabs', isSubScreen);

    // Update active tab
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.route === (screen.tab || screenName));
    });

    // Telegram BackButton
    const tg = window.Telegram?.WebApp;
    if (tg) {
      if (isSubScreen) tg.BackButton.show();
      else tg.BackButton.hide();
    }

    // Render screen
    this.currentScreen = screenName;
    if (screen.render) {
      screen.render(this.container, param);
    } else {
      this.container.innerHTML = `
        <div class="loading">
          <p>${screenName}</p>
          <p style="color: var(--text-tertiary); font-size: 13px; margin-top: 8px;">В разработке</p>
        </div>`;
    }
  }
};

App.screens.home.render = async function(container) {
  container.innerHTML = '<div class="loading"><i class="ph ph-circle-notch" style="animation: spin 1s linear infinite;"></i></div>';
  try {
    const data = await API.get('/api/overview');
    container.innerHTML = renderHome(data);
  } catch (e) {
    container.innerHTML = '<div class="loading" style="color:var(--red)">Ошибка загрузки</div>';
  }
};

function volumeZoneClass(sets) {
  if (sets <= 0) return 'z0';
  if (sets < 4) return 'zr';
  if (sets <= 10) return 'zg';
  return 'zo';
}

function renderVolumeHistory(history) {
  if (!history || history.length === 0) return '';
  const catOrder = ['push', 'pull', 'legs', 'core'];
  const catLabels = {push: 'Толкающие', pull: 'Тянущие', legs: 'Ноги', core: 'Кор'};
  const CATS = {
    chest:'push', front_delt:'push', mid_delt:'push', triceps:'push',
    lats:'pull', upperBack:'pull', rear_delt:'pull', biceps:'pull', forearms:'pull',
    quads:'legs', hamstrings:'legs', calves:'legs', abs:'core'
  };
  const LABELS = {
    chest:'Грудь', lats:'Спина', upperBack:'Верх спины',
    front_delt:'Пер. дельта', mid_delt:'Ср. дельта', rear_delt:'Зад. дельта',
    biceps:'Бицепс', triceps:'Трицепс', forearms:'Предплечья',
    quads:'Квадрицепс', hamstrings:'Биц. бедра', calves:'Икры', abs:'Пресс'
  };
  const muscles = Object.keys(LABELS);

  const headers = history.map(w => {
    const isDim = w.workouts <= 1 && w.total < 20;
    return `<th${isDim ? ' class="dim"' : ''}>${w.label}<span class="wk-ct">${w.workouts} трен${isDim ? ' ⚠' : ''}</span></th>`;
  }).join('');

  let rows = '';
  for (const cat of catOrder) {
    rows += `<tr class="cat-row"><td colspan="${history.length + 1}">${catLabels[cat]}</td></tr>`;
    for (const m of muscles) {
      if (CATS[m] !== cat) continue;
      const cells = history.map(w => {
        const v = w.volume[m] || 0;
        const isDim = w.workouts <= 1 && w.total < 20;
        const cls = volumeZoneClass(v) + (isDim ? ' dim' : '');
        return `<td class="${cls}">${v > 0 ? v : '—'}</td>`;
      }).join('');
      rows += `<tr><td>${LABELS[m]}</td>${cells}</tr>`;
    }
  }
  const totals = history.map(w => {
    const isDim = w.workouts <= 1 && w.total < 20;
    return `<td${isDim ? ' class="dim"' : ''}>${w.total}</td>`;
  }).join('');
  rows += `<tr class="tot-row"><td>ВСЕГО</td>${totals}</tr>`;

  return `
    <div class="section-label">История объёмов</div>
    <div class="vol-legend">
      <span><span class="vol-legend-dot" style="background:rgba(255,69,58,0.4)"></span>&lt;4</span>
      <span><span class="vol-legend-dot" style="background:rgba(52,199,89,0.4)"></span>4–10</span>
      <span><span class="vol-legend-dot" style="background:rgba(255,159,10,0.4)"></span>&gt;10</span>
    </div>
    <table class="vol-hg">
      <thead><tr><th></th>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderVolumeRecommendations(recs) {
  if (!recs || recs.length === 0) return '';
  const LABELS = {
    chest:'Грудь', lats:'Спина', upperBack:'Верх спины',
    front_delt:'Пер. дельта', mid_delt:'Ср. дельта', rear_delt:'Зад. дельта',
    biceps:'Бицепс', triceps:'Трицепс', forearms:'Предплечья',
    quads:'Квадрицепс', hamstrings:'Биц. бедра', calves:'Икры', abs:'Пресс'
  };
  const below = recs.filter(r => r.sets < 4);
  const stalled = recs.filter(r => r.sets >= 4 && r.action === 'add');
  const reduce = recs.filter(r => r.action === 'reduce');

  let items = '';
  for (const r of stalled) {
    items += `<div class="vol-ai-row"><div class="vol-ai-dot a"></div><div><b>${LABELS[r.muscle] || r.muscle}: +1 подход.</b> ${r.reason_ru}</div></div>`;
  }
  if (below.length > 0) {
    const names = below.map(r => LABELS[r.muscle] || r.muscle).join(', ');
    items += `<div class="vol-ai-row"><div class="vol-ai-dot w"></div><div><b>${names}: добавь изоляцию.</b> Ниже 4 подх/нед — нет стимула для роста</div></div>`;
  }
  for (const r of reduce) {
    items += `<div class="vol-ai-row"><div class="vol-ai-dot g"></div><div><b>${LABELS[r.muscle] || r.muscle}:</b> ${r.reason_ru}</div></div>`;
  }
  if (!items) return '';

  return `
    <div class="vol-ai">
      <div class="vol-ai-hdr">✨ Что делать на этой неделе</div>
      ${items}
    </div>`;
}

function renderHome(d) {
  const streakDots = d.streak.dots.map(dot => {
    const cls = dot.status === 'done' ? 'dot-done' : dot.status === 'next' ? 'dot-next' : 'dot-pending';
    return `<span class="streak-dot ${cls}" ${dot.workout_id ? `onclick="location.hash='#workout/${dot.workout_id}'"` : ''}></span>`;
  }).join('');

  const weightDelta = d.stats.weight_change_weekly != null
    ? `<span style="color:${d.stats.weight_change_weekly >= 0 ? 'var(--green)' : 'var(--red)'}">
        ${d.stats.weight_change_weekly >= 0 ? '↑' : '↓'}${Math.abs(d.stats.weight_change_weekly)}</span>`
    : '';

  const templateCards = d.templates.map(t => {
    if (t.status === 'done') {
      return `<div class="card template-card" onclick="location.hash='#workout/${t.workout_id}'" style="cursor:pointer">
        <div style="display:flex;align-items:center;gap:10px">
          <i class="ph-fill ph-check-circle" style="color:var(--green);font-size:20px"></i>
          <div style="flex:1">
            <div style="font-weight:600">${t.name} <span style="color:var(--text-secondary);font-weight:400;font-size:13px">${t.date}</span></div>
            <div style="color:var(--text-secondary);font-size:13px;margin-top:2px">${t.exercises_summary}</div>
          </div>
          <span class="badge badge-green">готово</span>
        </div>
      </div>`;
    } else {
      const preview = (t.exercises_preview || []).map(e => `<div style="color:var(--text-secondary);font-size:13px">· ${e}</div>`).join('');
      return `<div class="card template-card" onclick="location.hash='#prep/${encodeURIComponent(t.name)}'" style="cursor:pointer">
        <div style="display:flex;align-items:center;gap:10px">
          <i class="ph ph-clipboard" style="color:var(--blue);font-size:20px"></i>
          <div style="flex:1">
            <div style="font-weight:600">${t.name} <span style="color:var(--blue);font-size:12px">→ подготовка</span></div>
            ${preview}
          </div>
        </div>
      </div>`;
    }
  }).join('');

  const categoryOrder = ['push', 'pull', 'legs', 'core'];
  const categoryLabels = {push: 'Толкающие', pull: 'Тянущие', legs: 'Ноги', core: 'Кор'};
  const MAX_SEGMENTS = 12;
  const MIN_TARGET = 4;
  const MAX_TARGET = 10;

  // Smart volume: show last week when current is empty
  const volumeSource = (d.show_last_week && d.last_week_volume) ? d.last_week_volume : d.volume;
  const lastWeekBanner = d.show_last_week
    ? `<div class="last-week-banner">← Прошлая неделя (${d.volume_history?.[0]?.label || ''}) · ${d.volume_history?.[0]?.workouts || 0} тренировок</div>`
    : '';

  // Group volumes by category
  const grouped = {};
  for (const v of volumeSource) {
    const cat = v.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(v);
  }

  const volumeHtml = categoryOrder.map(cat => {
    const muscles = grouped[cat];
    if (!muscles || muscles.length === 0) return '';

    const rows = muscles.map(v => {
      const sets = Math.round(v.sets * 10) / 10;
      const filledCount = Math.min(Math.round(sets), MAX_SEGMENTS);

      const segments = Array.from({length: MAX_SEGMENTS}, (_, i) => {
        if (i >= filledCount) return `<div class="volume-segment"></div>`;
        if (i < MIN_TARGET) return `<div class="volume-segment filled-low"></div>`;
        if (i < MAX_TARGET) return `<div class="volume-segment filled-ok"></div>`;
        return `<div class="volume-segment filled-high"></div>`;
      }).join('');

      return `<div class="volume-row">
        <span class="volume-row-name">${v.group}</span>
        <div class="volume-row-bar">${segments}</div>
        <span class="volume-row-value">${sets}</span>
      </div>`;
    }).join('');

    return `<div class="volume-category">
      <div class="volume-category-label">${categoryLabels[cat]}</div>
      ${rows}
    </div>`;
  }).join('');

  const aiBlock = d.ai_insight
    ? `<div class="ai-block"><i class="ph-fill ph-sparkle ai-icon"></i><p>${d.ai_insight}</p></div>`
    : '';

  return `
    <div class="screen-header" style="justify-content:space-between">
      <h1>GymTracker</h1>
      <div style="display:flex;align-items:center;gap:12px">
        <span style="color:var(--text-secondary);font-size:13px">${d.week_label}</span>
        <span onclick="location.hash='#settings'" style="cursor:pointer;color:var(--text-tertiary)"><i class="ph ph-gear" style="font-size:18px"></i></span>
      </div>
    </div>

    <div class="streak-bar card" style="display:flex;align-items:center;gap:8px;padding:10px 16px;margin-bottom:12px">
      <i class="ph-fill ph-fire" style="color:var(--orange);font-size:18px"></i>
      <span class="mono" style="font-size:16px">${d.streak.weeks}</span>
      <span style="color:var(--text-secondary);font-size:12px">нед</span>
      <div style="margin-left:auto;display:flex;gap:6px">${streakDots}</div>
    </div>

    <div class="stats-row" style="margin-bottom:16px">
      <div class="card" style="text-align:center;padding:12px 8px">
        <div class="stat-value" style="font-size:20px">${d.stats.workouts_done}/${d.stats.workouts_total}</div>
        <div class="section-label" style="margin:4px 0 0">тренировок</div>
      </div>
      <div class="card" style="text-align:center;padding:12px 8px">
        <div class="stat-value" style="font-size:20px">${d.stats.trend_weight_kg ?? '—'}</div>
        <div style="font-size:12px">кг ${weightDelta}</div>
      </div>
      <div class="card" style="text-align:center;padding:12px 8px">
        <div class="stat-value" style="font-size:20px">${d.stats.avg_daily_kcal ?? '—'}</div>
        <div class="section-label" style="margin:4px 0 0">ккал/д</div>
      </div>
    </div>

    <div class="section-label">Шаблоны</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">${templateCards}</div>

    ${lastWeekBanner}
    <div class="section-label">Объём за ${d.show_last_week ? 'прошлую неделю' : 'неделю'}</div>
    <div class="volume-section">${volumeHtml}</div>
    ${renderVolumeHistory(d.volume_history)}
    ${renderVolumeRecommendations(d.volume_recommendations)}

    ${aiBlock}
  `;
}


App.screens.workout.render = async function(container, workoutId) {
  container.innerHTML = '<div class="loading"><i class="ph ph-circle-notch" style="animation: spin 1s linear infinite;"></i></div>';
  try {
    const d = await API.get(`/api/workout/${workoutId}`);
    container.innerHTML = renderWorkout(d);
  } catch (e) {
    container.innerHTML = '<div class="loading" style="color:var(--red)">Тренировка не найдена</div>';
  }
};

function renderWorkout(d) {
  const exerciseCards = d.exercises.map(ex => {
    const repsStr = ex.sets.filter(s => s.type === 'working' || s.type === 'normal')
      .map(s => s.reps).join(', ') + ' повт';

    const decayBadge = ex.decay_pct != null
      ? `<span class="badge badge-${ex.decay_status === 'ok' ? 'green' : ex.decay_status === 'warning' ? 'orange' : 'red'}">${ex.decay_status === 'ok' ? '\u0441\u0442\u0430\u0431\u0438\u043b\u044c\u043d\u043e' : '\u043f\u0430\u0434\u0435\u043d\u0438\u0435 ' + ex.decay_pct + '%'}</span>`
      : '';

    const e1rmLine = (() => {
      const pct = ex.e1rm_change_pct || 0;
      if (!ex.e1rm_previous) return '';
      if (Math.abs(pct) < 1) return `<div style="font-size:12px;color:var(--text-tertiary)">стабильно</div>`;
      const arrow = pct > 0 ? '↑' : '↓';
      const color = pct > 0 ? 'var(--green)' : 'var(--red)';
      return `<div style="font-size:12px;color:${color}">Сила ${arrow}${Math.abs(pct)}%</div>`;
    })();

    const sparkSvg = ex.sparkline.length > 1 ? renderSparkline(ex.sparkline) : '';

    const recBadge = ex.recommendation
      ? `<div class="badge ${ex.recommendation.type === 'increase' ? 'badge-green' : 'badge-red'}" style="margin-top:6px">
          ${ex.recommendation.text}</div>`
      : '';

    return `<div class="card" style="cursor:pointer;margin-bottom:8px" onclick="location.hash='#exercise/${ex.id}'">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <div style="flex:1">
          <span style="font-weight:600;font-size:15px">${ex.name}</span>
          ${ex.original_name ? `<div style="font-size:11px;color:var(--text-tertiary)">${ex.original_name}</div>` : ""}
        </div>
        ${sparkSvg}
        <span class="mono" style="color:var(--blue);font-size:15px">${ex.working_weight_kg}кг</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="font-size:13px;color:var(--text-secondary)">${repsStr}</span>
        ${e1rmLine}
      </div>
      ${recBadge}
    </div>`;
  }).join('');

  const aiBlock = d.ai_summary
    ? `<div class="ai-block" style="margin-bottom:12px"><i class="ph-fill ph-sparkle ai-icon"></i><p>${d.ai_summary}</p></div>`
    : '';

  return `
    <div class="screen-header">
      <button class="back-btn" onclick="history.back()"><i class="ph ph-caret-left"></i></button>
      <h1>${d.template_name || 'Тренировка'}</h1>
      <span style="color:var(--text-secondary);font-size:13px;margin-left:auto">${d.date} · ${d.duration_min} мин</span>
    </div>
    ${aiBlock}
    ${exerciseCards}
  `;
}

function renderSparkline(values, w = 60, h = 20) {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) =>
    `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`
  ).join(' ');
  return `<svg width="${w}" height="${h}" style="flex-shrink:0">
    <polyline points="${points}" fill="none" stroke="var(--blue)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}


App.screens.exercise.render = async function(container, exerciseId) {
  container.innerHTML = '<div class="loading"><i class="ph ph-circle-notch" style="animation:spin 1s linear infinite"></i></div>';
  try {
    const d = await API.get(`/api/exercise/${exerciseId}`);
    container.innerHTML = renderExercise(d);
    if (d.chart_data.length > 1) Charts.renderE1rmChart('e1rm-chart', d.chart_data);
    // AI generate button handler
    const genBtn = container.querySelector('#gen-ai-btn');
    if (genBtn) {
      genBtn.addEventListener('click', async () => {
        genBtn.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:10px">
          <i class="ph ph-circle-notch" style="animation:spin 1s linear infinite;font-size:24px;color:var(--blue)"></i>
          <div style="font-size:13px;font-weight:600;color:var(--blue)">\u0413\u0435\u043d\u0435\u0440\u0438\u0440\u0443\u044e \u0430\u043d\u0430\u043b\u0438\u0437...</div>
          <div style="width:80%;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden"><div style="height:100%;background:var(--blue);border-radius:2px;animation:progress 6s ease-out forwards"></div></div>
          <div style="font-size:10px;color:var(--text-tertiary)">\u0410\u043d\u0430\u043b\u0438\u0437\u0438\u0440\u0443\u044e \u0438\u0441\u0442\u043e\u0440\u0438\u044e \u0438 \u0441\u0440\u0430\u0432\u043d\u0438\u0432\u0430\u044e \u0441 \u043d\u043e\u0440\u043c\u043e\u0439</div>
        </div>`;
        genBtn.style.cursor = 'default';
        try {
          // Force regeneration by calling API with cache bust
          const d2 = await API.get(`/api/exercise/${exerciseId}?force_ai=1`);
          // Wait a bit for background AI to generate
          await new Promise(r => setTimeout(r, 5000));
          // Fetch again to get cached AI
          const d3 = await API.get(`/api/exercise/${exerciseId}?t=${Date.now()}`);
          container.innerHTML = renderExercise(d3);
          if (d3.chart_data.length > 1) Charts.renderE1rmChart('e1rm-chart', d3.chart_data);
        } catch(e) {
          genBtn.innerHTML = '<div style="color:var(--red);font-size:12px">\u041e\u0448\u0438\u0431\u043a\u0430</div>';
        }
      });
    }
  } catch (e) {
    container.innerHTML = '<div class="loading" style="color:var(--red)">Упражнение не найдено</div>';
  }
};

function renderExercise(d) {
  // Helper: clamp
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  // 1. Muscle tags
  const muscleHtml = (d.muscles && d.muscles.length)
    ? `<div class="ex-muscles">
        ${d.muscles.map(m => {
          const cls = m.contribution >= 70 ? '' : ' secondary';
          return `<span class="ex-muscle${cls}">${m.name} ${m.contribution}%</span>`;
        }).join('')}
      </div>`
    : '';

  // 2. Recommendation card
  const rec = d.recommendation || {};
  const recClass = (rec.type || 'hold').replace('_', '-');
  const recIcon = recClass === 'increase' || recClass === 'rep-increase'
    ? '<i class="ph ph-trend-up"></i>'
    : recClass === 'decrease'
      ? '<i class="ph ph-trend-down"></i>'
      : '<i class="ph ph-barbell"></i>';
  const recText = (rec.text || '').replace(/^→\s*/, '');
  const recWhy = rec.fallback || (
    recClass === 'increase' ? 'Стабильные повторения — пора добавить вес'
    : recClass === 'rep-increase' ? 'Вес освоен — добавь повторения'
    : recClass === 'decrease' ? 'Снижение формы — откат поможет восстановиться'
    : 'Хорошая работа, удерживай этот уровень'
  );
  const recHtml = `<div class="ex-rec ${recClass}">
    <div class="ex-rec-label">${recIcon} → Следующая тренировка</div>
    <div class="ex-rec-main">${recText}</div>
    <div class="ex-rec-why">${recWhy}</div>
  </div>`;

  // 3. PR card
  const prDateStr = d.pr.date_human || d.pr.date || '';
  const perArmSpan = d.is_per_arm ? ' <span style="font-size:11px;color:var(--text-tertiary)">за руку</span>' : '';
  const prHtml = `<div class="card" style="margin-bottom:12px;text-align:center;border-left:3px solid var(--gold)">
    <i class="ph-fill ph-trophy" style="color:var(--gold);font-size:24px"></i>
    <div style="font-size:11px;color:var(--text-secondary);margin:4px 0">Лучший e1RM</div>
    <div class="mono" style="font-size:28px;color:var(--gold)">${d.pr.e1rm} кг</div>
    <div style="font-size:12px;color:var(--text-secondary)">${prDateStr} · ${d.pr.weight_kg}кг × ${d.pr.reps}${perArmSpan}</div>
  </div>`;

  // 4. History rows
  const historyRows = d.history.map(h => {
    const prIcon = h.is_pr ? '<i class="ph-fill ph-trophy" style="color:var(--gold)"></i>' : '';
    const dateStr = h.date_human || h.date;
    const reps = h.reps.join(', ');
    return `<tr>
      <td style="color:var(--text-secondary);padding:6px 8px">${dateStr}</td>
      <td class="mono" style="padding:6px 8px">${h.weight_kg} кг</td>
      <td class="mono" style="padding:6px 8px">${reps}</td>
      <td class="mono" style="padding:6px 8px;${h.is_pr ? 'color:var(--gold);font-weight:600' : ''}">${h.e1rm} ${prIcon}</td>
    </tr>`;
  }).join('');

  const perArmNote = d.is_per_arm
    ? `<div class="ex-history-note">вес указан за одну гантель</div>`
    : '';

  // 5. Rep records grid
  const rrKeys = ['1', '3', '5', '8', '10'];
  const rrLabels = { '1': '1ПМ', '3': '3ПМ', '5': '5ПМ', '8': '8ПМ', '10': '10ПМ' };
  const rrData = d.rep_records || {};
  // Find highest non-null value
  const rrValues = rrKeys.map(k => rrData[k]).filter(v => v != null);
  const rrMax = rrValues.length ? Math.max(...rrValues) : null;
  const rrCells = rrKeys.map(k => {
    const val = rrData[k];
    const isGold = val != null && val === rrMax;
    return `<div class="rr-cell">
      <div class="rr-label">${rrLabels[k]}</div>
      <div class="rr-val" style="${isGold ? 'color:var(--gold)' : ''}">${val != null ? val : '—'}</div>
    </div>`;
  }).join('');

  // 6. AI analysis card
  let aiHtml = '';
  const realPR = d.is_per_arm ? d.pr.e1rm * 2 : d.pr.e1rm;
  const bwRatio = realPR / (d.bodyweight || 75);
  const levelPct = clamp((bwRatio - 0.2) / (2.0 - 0.2) * 100, 0, 100);
  if (d.ai_analysis) {
    aiHtml = `<div class="ex-ai">
      <div class="ex-ai-label"><i class="ph ph-sparkle"></i> Тренер</div>
      <div class="ex-ai-text">${d.ai_analysis}</div>
      <div class="ex-ai-bar">
        <div class="ex-ai-bar-title">Уровень силы</div>
        <div class="ex-ai-track">
          <div class="ex-ai-fill"></div>
          <div class="ex-ai-marker" style="left:${levelPct}%">
            <div style="position:absolute;top:18px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:9px;color:var(--blue)">ты · ${bwRatio.toFixed(2)}× BW</div>
          </div>
        </div>
        <div class="ex-ai-bar-labels"><span>Новичок</span><span>Средний</span><span>Продвинутый</span></div>
      </div>
    </div>`;
  } else {
    aiHtml = `<div class="ex-ai" style="text-align:center;padding:20px 16px;cursor:pointer" id="gen-ai-btn">
      <i class="ph ph-sparkle" style="font-size:24px;color:var(--blue);opacity:0.5"></i>
      <div style="font-size:13px;font-weight:600;color:var(--blue);margin-top:8px">Сгенерировать AI анализ</div>
      <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">Сравнение с нормой, разбор прогресса, советы</div>
    </div>`;
  }

  // 7. Stats row
  const workingWeightLabel = d.is_per_arm
    ? `${d.stats.current_working_weight ?? '—'} кг <span style="font-size:11px;color:var(--text-tertiary)">за руку</span>`
    : `${d.stats.current_working_weight ?? '—'} кг`;

  return `
    <div class="screen-header">
      <button class="back-btn" onclick="history.back()"><i class="ph ph-caret-left"></i></button>
      <div>
        <h1>${d.name}</h1>
        ${d.original_name ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">${d.original_name}</div>` : ""}
      </div>
    </div>

    ${muscleHtml}
    ${recHtml}
    ${prHtml}

    <div class="section-label">Прогресс</div>
    <div id="e1rm-chart" class="ex-chart-glued"></div>
    <div class="ex-history-glued">
      ${perArmNote}
      <table style="width:100%;font-size:13px;border-collapse:collapse">
        <thead><tr style="color:var(--text-tertiary);font-size:11px;text-transform:uppercase">
          <th style="text-align:left;padding:6px 8px">Дата</th>
          <th style="text-align:left;padding:6px 8px">Вес</th>
          <th style="text-align:left;padding:6px 8px">Повторения</th>
          <th style="text-align:left;padding:6px 8px">Сила</th>
        </tr></thead>
        <tbody>${historyRows}</tbody>
      </table>
    </div>

    <div class="section-label">Рекорды по повторениям</div>
    <div class="rr-grid">${rrCells}</div>

    ${aiHtml}

    <div class="stats-row" style="grid-template-columns:1fr 1fr;margin-bottom:16px;margin-top:12px">
      <div class="card" style="text-align:center">
        <div class="mono" style="font-size:20px">${workingWeightLabel}</div>
        <div class="section-label" style="margin-top:4px">Рабочий вес</div>
      </div>
      <div class="card" style="text-align:center">
        <div class="mono" style="font-size:20px">${d.stats.progression_rate ?? '—'}</div>
        <div class="section-label" style="margin-top:4px">Прогрессия</div>
      </div>
    </div>
  `;
}


App.screens.prep.render = async function(container, templateName) {
  container.innerHTML = '<div class="loading"><i class="ph ph-circle-notch" style="animation:spin 1s linear infinite"></i></div>';
  try {
    const d = await API.get(`/api/prep/${encodeURIComponent(templateName)}`);
    container.innerHTML = renderPrep(d);
  } catch (e) {
    container.innerHTML = '<div class="loading" style="color:var(--red)">Шаблон не найден</div>';
  }
};

function renderPrep(d) {
  const cards = d.exercises.map(ex => {
    const prevLine = ex.previous
      ? `<div style="color:var(--text-secondary);font-size:13px">${ex.previous.weight_kg}кг · ${ex.previous.reps.join(', ')} · падение ${ex.previous.decay_pct ?? '—'}%</div>`
      : '<div style="color:var(--text-tertiary);font-size:13px">Нет данных</div>';

    const recColor = ex.recommendation.type === 'increase' ? 'var(--green)'
      : ex.recommendation.type === 'decrease' ? 'var(--red)' : 'var(--blue)';

    const fallback = ex.recommendation.fallback
      ? `<div style="color:var(--text-secondary);font-size:12px;font-style:italic;margin-top:4px">${ex.recommendation.fallback}</div>`
      : '';

    return `<div class="card-accent" style="margin-bottom:8px;cursor:pointer" onclick="location.hash='#exercise/${ex.id}'">
      <div style="font-weight:600;font-size:15px">${ex.name}</div>
      ${ex.original_name ? `<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px">${ex.original_name}</div>` : `<div style="margin-bottom:6px"></div>`}
      ${prevLine}
      <div style="color:${recColor};font-size:14px;margin-top:6px;font-weight:500">${ex.recommendation.text}</div>
      ${fallback}
    </div>`;
  }).join('');

  return `
    <div class="screen-header">
      <button class="back-btn" onclick="history.back()"><i class="ph ph-caret-left"></i></button>
      <h1>${d.template_name}</h1>
      <span class="badge badge-blue" style="margin-left:8px">план</span>
    </div>
    ${d.ai_intro ? `<div class="ai-block" style="margin-bottom:12px"><i class="ph-fill ph-sparkle ai-icon"></i><p>${d.ai_intro}</p></div>` : ''}
    ${cards}
  `;
}


App.screens.nutrition.render = async function(container) {
  container.innerHTML = '<div class="loading"><i class="ph ph-circle-notch" style="animation:spin 1s linear infinite"></i></div>';
  try {
    const d = await API.get('/api/nutrition');
    container.innerHTML = renderNutrition(d);
  } catch (e) {
    container.innerHTML = '<div class="loading" style="color:var(--red)">Ошибка загрузки</div>';
  }
};

function renderNutrition(d) {
  const s = d.settings;
  const today = new Date().toISOString().split('T')[0];

  // Weight chart
  const chartHtml = d.weight.chart_data.length > 1 ? renderWeightChart(d.weight, d.settings) : '';

  const changeBadge = d.weight.weekly_change_kg != null
    ? (() => {
        const cls = d.weight.assessment === 'on_track' ? 'badge-green'
          : d.weight.assessment === 'slow' ? 'badge-orange'
          : d.weight.assessment === 'fast' ? 'badge-red' : 'badge-blue';
        return `<span class="badge ${cls}">${d.weight.weekly_change_kg >= 0 ? '+' : ''}${d.weight.weekly_change_kg} кг/нед</span>`;
      })()
    : '';

  const assessLabels = {on_track: 'В НОРМЕ', slow: 'МЕДЛЕННО', fast: 'БЫСТРО', drifting: 'ДРЕЙФ', no_data: 'НЕТ ДАННЫХ'};
  const assessCls = {on_track: 'badge-green', slow: 'badge-orange', fast: 'badge-red', drifting: 'badge-orange', no_data: 'badge-blue'};
  const assessBadge = d.weight.assessment
    ? `<span class="badge ${assessCls[d.weight.assessment]}" style="font-size:9px">${assessLabels[d.weight.assessment]}</span>`
    : '';

  // Energy balance bars
  const maxCal = Math.max(...d.energy_balance.days.map(day => day.calories || 0), ...d.energy_balance.days.map(day => day.target));
  const ebBars = d.energy_balance.days.map(day => {
    const isToday = day.date === today;
    const pct = day.calories ? Math.round((day.calories / maxCal) * 100) : 0;
    const targetPct = Math.round((day.target / maxCal) * 100);

    let barClass = '';
    let barStyle = '';
    if (day.type === 'future') {
      barStyle = `height:4px;background:rgba(255,255,255,0.06);`;
    } else if (!day.valid) {
      barStyle = `height:18%;background:repeating-linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.06) 2px,transparent 2px,transparent 4px);border:1px dashed rgba(255,255,255,0.12);`;
    } else {
      barClass = day.type === 'training' ? 'training-day' : 'rest-day';
      barStyle = `height:${pct}%;`;
    }
    if (isToday && day.valid) barClass += ' today';

    const dayClass = isToday ? 'eb-day today' : day.type === 'future' ? 'eb-day' : 'eb-day';
    const dayOpacity = day.type === 'future' ? 'opacity:0.3' : !day.valid ? 'opacity:0.4' : '';

    return `<div class="eb-bar-wrap">
      <div class="eb-bar ${barClass}" style="${barStyle}"></div>
      <div class="${dayClass}" style="${dayOpacity}">${day.dow}</div>
    </div>`;
  }).join('');

  // Legend
  const legend = `<div style="display:flex;gap:10px;margin-bottom:6px">
    <div style="display:flex;align-items:center;gap:4px">
      <div style="width:8px;height:8px;border-radius:2px;background:linear-gradient(180deg,rgba(90,200,250,0.7),rgba(90,200,250,0.3))"></div>
      <span style="font-size:10px;color:var(--text-tertiary)">тренировка</span>
    </div>
    <div style="display:flex;align-items:center;gap:4px">
      <div style="width:8px;height:8px;border-radius:2px;background:linear-gradient(180deg,rgba(52,199,89,0.7),rgba(52,199,89,0.3))"></div>
      <span style="font-size:10px;color:var(--text-tertiary)">отдых</span>
    </div>
    <div style="display:flex;align-items:center;gap:4px">
      <div style="width:8px;height:8px;border-radius:2px;background:repeating-linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.08) 2px,transparent 2px,transparent 4px);border:1px dashed rgba(255,255,255,0.15)"></div>
      <span style="font-size:10px;color:var(--text-tertiary)">нет данных</span>
    </div>
  </div>`;

  // Weekly trend
  const trendBars = d.energy_balance.weekly_trend.length ? (() => {
    const maxS = Math.max(...d.energy_balance.weekly_trend.map(w => Math.abs(w.avg_surplus)), 1);
    const bars = d.energy_balance.weekly_trend.map(w => {
      const h = Math.max(Math.round(Math.abs(w.avg_surplus) / maxS * 100), 10);
      const color = w.avg_surplus >= 0 ? 'var(--green)' : 'var(--orange)';
      return `<div class="trend-mini-bar" style="height:${h}%;background:${color};opacity:0.5"></div>`;
    }).join('');
    return `<div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border-subtle)">
      <span style="font-size:10px;color:var(--text-tertiary)">4 нед:</span>
      <div class="trend-mini" style="flex:1">${bars}</div>
    </div>`;
  })() : '';

  // Protein ring
  const circumference = 157; // 2 * PI * 25
  const protPct = Math.min(d.protein.pct, 100);
  const offset = circumference - (protPct / 100) * circumference;
  const perKg = d.protein.goal_per_kg;

  const proteinDots = d.protein.adherence.dots.map(dot => {
    return `<div class="adh-dot ${dot}"></div>`;
  }).join('');

  // Fiber mini bars
  const maxFiber = Math.max(...d.fiber.daily.filter(v => v != null), d.fiber.goal_grams, 1);
  const fiberBars = d.fiber.daily.map((v, i) => {
    const isToday_f = i === new Date().getDay() - 1; // Mon=0
    if (v == null) {
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center">
        <div style="width:100%;height:2px;background:rgba(255,255,255,0.06);border-radius:2px"></div>
        <span style="font-size:7px;color:var(--text-tertiary);margin-top:1px;opacity:0.3">—</span>
      </div>`;
    }
    const pctF = Math.round((v / maxFiber) * 100);
    const h = Math.max(pctF * 0.2, 3);
    const fPct = v / d.fiber.goal_grams;
    const color = fPct >= 1 ? 'var(--green)' : fPct >= 0.5 ? 'var(--orange)' : 'var(--red)';
    const border = isToday_f ? 'border:1px solid rgba(90,200,250,0.3);' : '';
    const labelColor = isToday_f ? 'color:var(--blue)' : 'color:var(--text-tertiary)';
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center">
      <div style="width:100%;height:${h}px;background:linear-gradient(180deg,${color},${color}44);border-radius:2px;${border}"></div>
      <span style="font-size:7px;${labelColor};margin-top:1px">${v}</span>
    </div>`;
  }).join('');

  // Strength signals card
  let strengthHtml;
  if (d.strength_signals.has_enough_data && d.strength_signals.signals) {
    const sigs = d.strength_signals.signals;
    const tags = [];
    if (sigs.avg_carbs_recent != null && sigs.avg_carbs_previous != null) {
      const diff = sigs.avg_carbs_recent - sigs.avg_carbs_previous;
      if (Math.abs(diff) > 20) {
        const dir = diff < 0 ? '▼' : '▲';
        const cls = diff < 0 ? 'var(--red)' : 'var(--green)';
        tags.push(`<div style="display:flex;align-items:center;gap:3px;padding:3px 8px;background:${diff < 0 ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.1)'};border-radius:6px">
          <span style="font-size:9px;color:${cls}">${dir}</span>
          <span style="font-size:10px;color:${cls};font-weight:600">Углеводы ${Math.round(sigs.avg_carbs_recent)}г</span>
          <span style="font-size:9px;color:var(--text-tertiary)">(было ${Math.round(sigs.avg_carbs_previous)}г)</span>
        </div>`);
      }
    }
    if (sigs.e1rm_change_2w != null && Math.abs(sigs.e1rm_change_2w) > 1) {
      const cls2 = sigs.e1rm_change_2w < 0 ? 'var(--red)' : 'var(--green)';
      tags.push(`<div style="display:flex;align-items:center;gap:3px;padding:3px 8px;background:${sigs.e1rm_change_2w < 0 ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.1)'};border-radius:6px">
        <span style="font-size:9px;color:${cls2}">${sigs.e1rm_change_2w < 0 ? '▼' : '▲'}</span>
        <span style="font-size:10px;color:${cls2};font-weight:600">e1RM ${sigs.e1rm_change_2w > 0 ? '+' : ''}${sigs.e1rm_change_2w}%</span>
        <span style="font-size:9px;color:var(--text-tertiary)">за 2 нед</span>
      </div>`);
    }
    const tagsHtml = tags.length ? `<div style="display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap">${tags.join('')}</div>` : '';
    const aiText = d.strength_signals.ai_analysis
      ? `<div style="font-size:12px;line-height:1.55;color:rgba(255,255,255,0.8)">${d.strength_signals.ai_analysis}</div>`
      : `<div style="font-size:11px;color:var(--text-tertiary)">AI временно недоступен</div>`;
    strengthHtml = `<div class="ai-insight" style="padding:14px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
        <i class="ph ph-lightning" style="color:var(--purple);font-size:16px"></i>
        <span style="font-size:11px;font-weight:600">Питание → Сила</span>
        <span class="badge badge-purple" style="font-size:8px;margin-left:auto">AI</span>
      </div>
      ${tagsHtml}
      ${aiText}
    </div>`;
  } else {
    const wa = d.strength_signals.weeks_available || 0;
    const wr = d.strength_signals.weeks_required || 6;
    const pBar = Math.round((wa / wr) * 100);
    strengthHtml = `<div class="card" style="border-color:rgba(191,90,242,0.12);opacity:0.7">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
        <i class="ph ph-lightning" style="color:var(--purple);font-size:16px;opacity:0.5"></i>
        <span style="font-size:11px;font-weight:600;opacity:0.7">Питание → Сила</span>
      </div>
      <div style="text-align:center;padding:8px 0">
        <div style="font-size:24px;opacity:0.15;margin-bottom:4px"><i class="ph ph-hourglass-medium"></i></div>
        <div style="font-size:12px;color:var(--text-tertiary)">Мало данных для анализа</div>
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">
          <span class="mono" style="color:var(--purple)">${wa}</span> / ${wr} нед
          <span style="opacity:0.5">— логируй питание в Yazio</span>
        </div>
        <div style="height:3px;background:rgba(255,255,255,0.06);border-radius:2px;margin-top:8px;overflow:hidden;max-width:140px;margin-left:auto;margin-right:auto">
          <div style="width:${pBar}%;height:100%;background:linear-gradient(90deg,var(--purple),rgba(191,90,242,0.4));border-radius:2px"></div>
        </div>
      </div>
    </div>`;
  }

  return `
    <div class="screen-header" style="justify-content:space-between">
      <h1>Питание</h1>
      <button style="background:none;border:none;color:var(--text-secondary);font-size:20px;cursor:pointer;padding:4px" onclick="location.hash='#settings'"><i class="ph ph-gear"></i></button>
    </div>
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">
      Неделя ${d.week_label} · TDEE ~${d.summary.tdee} · ${d.valid_days_count} валидных дн.
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div class="mono" style="font-size:20px;font-weight:700">${d.weight.trend_kg ?? '—'}<span style="font-size:11px;color:var(--text-secondary)"> кг</span></div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:2px">
            ${changeBadge}
            <span style="font-size:10px;color:var(--text-secondary)">цель ${d.weight.target_range[0]}–${d.weight.target_range[1]}</span>
          </div>
        </div>
        <div style="text-align:right">${assessBadge}</div>
      </div>
      ${chartHtml}
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div>
          <div style="font-size:10px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px">Энергобаланс</div>
        </div>
        <div style="text-align:right">
          <span class="mono" style="font-size:15px;font-weight:700;color:${d.energy_balance.avg_surplus >= 0 ? 'var(--green)' : 'var(--orange)'}">${d.energy_balance.avg_surplus >= 0 ? '+' : ''}${d.energy_balance.avg_surplus}</span>
          <span style="font-size:10px;color:var(--text-secondary)"> ккал/д</span>
          <div style="font-size:10px;color:var(--text-tertiary);margin-top:1px">из ${d.valid_days_count} валидных дн.</div>
        </div>
      </div>
      ${legend}
      <div class="eb-chart">${ebBars}</div>
      ${trendBars}
    </div>

    <div class="card">
      <div class="protein-ring-wrap">
        <svg class="protein-ring" viewBox="0 0 60 60">
          <circle class="track" cx="30" cy="30" r="25" transform="rotate(-90 30 30)"/>
          <circle class="fill" cx="30" cy="30" r="25"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}"
            transform="rotate(-90 30 30)"/>
          <text x="30" y="28" text-anchor="middle" font-family="JetBrains Mono" font-size="12" font-weight="700" fill="#34C759">${perKg}</text>
          <text x="30" y="38" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="rgba(255,255,255,0.35)">г/кг</text>
        </svg>
        <div style="flex:1">
          <div style="display:flex;align-items:baseline;gap:4px">
            <span class="mono" style="font-size:15px;font-weight:700">${d.protein.avg_grams}</span>
            <span style="font-size:10px;color:var(--text-tertiary)">/ ${d.protein.goal_grams}г</span>
            <span class="badge badge-${d.protein.pct >= 90 ? 'green' : d.protein.pct >= 70 ? 'orange' : 'red'}" style="font-size:8px;margin-left:auto">${d.protein.pct}%</span>
          </div>
          <div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">Цель: ${perKg} г/кг × ${d.weight.trend_kg ?? '?'} кг = ${d.protein.goal_grams}г</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:6px">
            <span style="font-size:10px;color:var(--text-tertiary)">Пн–Вс:</span>
            <div class="adherence-row">${proteinDots}</div>
            <span class="mono" style="font-size:10px;color:var(--green)">${d.protein.adherence.hit}/${d.protein.adherence.total}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:6px">
          <i class="ph ph-leaf" style="color:var(--orange);font-size:16px"></i>
          <span style="font-size:11px;font-weight:600">Клетчатка</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:4px">
          <span class="mono" style="font-size:15px;font-weight:700;color:var(--orange)">${d.fiber.avg_grams}</span>
          <span style="font-size:10px;color:var(--text-tertiary)">/ ${d.fiber.goal_grams}г</span>
          <span class="badge badge-${d.fiber.pct >= 90 ? 'green' : d.fiber.pct >= 50 ? 'orange' : 'red'}" style="font-size:8px">${d.fiber.pct}%</span>
        </div>
      </div>
      <div class="fiber-track"><div class="fiber-fill" style="width:${Math.min(d.fiber.pct, 100)}%"></div></div>
      <div style="display:flex;justify-content:space-between;margin-top:6px">
        <span style="font-size:10px;color:var(--text-tertiary)">средн. за 7д</span>
        <span style="font-size:10px;color:var(--orange)">цель ≥ ${d.fiber.goal_grams}г</span>
      </div>
      <div style="display:flex;gap:4px;margin-top:8px;align-items:flex-end;height:20px">${fiberBars}</div>
    </div>

    ${strengthHtml}

    <div class="stat-row">
      <div class="stat-pill">
        <div class="stat-value" style="font-size:14px">${d.summary.tdee}</div>
        <div class="stat-label">TDEE</div>
      </div>
      <div class="stat-pill">
        <div class="stat-value" style="font-size:14px;color:var(--green)">${d.summary.avg_calories}</div>
        <div class="stat-label">Ср. ккал</div>
      </div>
      <div class="stat-pill">
        <div class="stat-value" style="font-size:14px;color:var(--blue)">${d.summary.calorie_adherence_pct}%</div>
        <div class="stat-label">Adherence</div>
      </div>
    </div>
  `;
}

function renderWeightChart(weight, settings) {
  if (!weight.chart_data || weight.chart_data.length < 2) return '';
  const data = weight.chart_data;
  const w = 358, h = 80, pad = 10;
  const weights = data.map(d => d.raw);
  const trends = data.map(d => d.trend);
  const allVals = [...weights, ...trends];
  const min = Math.min(...allVals) - 0.5;
  const max = Math.max(...allVals) + 0.5;
  const range = max - min || 1;

  const scaleX = (i) => pad + (i / (data.length - 1)) * (w - 2 * pad);
  const scaleY = (v) => h - pad - ((v - min) / range) * (h - 2 * pad);

  const lineColor = weight.assessment === 'on_track' ? '#34C759' : weight.assessment === 'slow' || weight.assessment === 'fast' ? '#FF9500' : '#5ac8fa';

  const dots = data.map((d, i) =>
    `<circle cx="${scaleX(i)}" cy="${scaleY(d.raw)}" r="2" fill="rgba(255,255,255,0.12)"/>`
  ).join('');

  const lastDot = `<circle cx="${scaleX(data.length-1)}" cy="${scaleY(data[data.length-1].trend)}" r="2.5" fill="${lineColor}" opacity="0.5"/>`;

  const trendPoints = data.map((d, i) => `${scaleX(i)},${scaleY(d.trend)}`).join(' ');
  const fillPoints = trendPoints + ` ${scaleX(data.length-1)},${h-pad} ${scaleX(0)},${h-pad}`;

  return `<svg viewBox="0 0 ${w} ${h}" fill="none" style="width:100%;height:auto;margin-top:4px">
    <defs>
      <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${lineColor}" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="${lineColor}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${dots}
    <polygon points="${fillPoints}" fill="url(#wGrad)"/>
    <polyline points="${trendPoints}" fill="none" stroke="${lineColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${lastDot}
  </svg>`;
}

/**
 * Delta coloring rules — extracted for future training cycle extension.
 */
function getDeltaColor(key, delta) {
  if (delta === 0) return 'var(--text-secondary)';
  const rules = {
    weight: null, shoulders: false, chest: false, arm: false, forearm: false,
    neck: false, waist: true, belly: true, hip: null, thigh: false,
    calf: false, ankle: null, wrist: null,
  };
  const downGood = rules[key];
  if (downGood === null || downGood === undefined) return 'var(--text-secondary)';
  const isGood = downGood ? delta < 0 : delta > 0;
  return isGood ? 'var(--green)' : 'var(--red)';
}

const BODY_FIELDS = [
  {key: 'weight', name: '\u0412\u0435\u0441', unit: '\u043a\u0433'},
  {key: 'shoulders', name: '\u041f\u043b\u0435\u0447\u0438', unit: '\u0441\u043c'},
  {key: 'chest', name: '\u0413\u0440\u0443\u0434\u044c', unit: '\u0441\u043c'},
  {key: 'arm', name: '\u0420\u0443\u043a\u0430', unit: '\u0441\u043c'},
  {key: 'forearm', name: '\u041f\u0440\u0435\u0434\u043f\u043b\u0435\u0447\u044c\u044f', unit: '\u0441\u043c'},
  {key: 'neck', name: '\u0428\u0435\u044f', unit: '\u0441\u043c'},
  {key: 'waist', name: '\u0422\u0430\u043b\u0438\u044f', unit: '\u0441\u043c'},
  {key: 'belly', name: '\u0416\u0438\u0432\u043e\u0442', unit: '\u0441\u043c'},
  {key: 'hip', name: '\u0422\u0430\u0437', unit: '\u0441\u043c'},
  {key: 'thigh', name: '\u0411\u0435\u0434\u0440\u043e', unit: '\u0441\u043c'},
  {key: 'calf', name: '\u0413\u043e\u043b\u0435\u043d\u044c', unit: '\u0441\u043c'},
  {key: 'ankle', name: '\u041b\u043e\u0434\u044b\u0436\u043a\u0430', unit: '\u0441\u043c'},
  {key: 'wrist', name: '\u0417\u0430\u043f\u044f\u0441\u0442\u044c\u0435', unit: '\u0441\u043c'},
];

App.screens.body.render = async function(container) {
  container.innerHTML = '<div class="loading"><i class="ph ph-circle-notch" style="animation:spin 1s linear infinite"></i></div>';
  try {
    const d = await API.get('/api/body');
    container.innerHTML = renderBody(d);
    container.querySelectorAll('.photo-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        window._bodyAngle = tab.dataset.angle;
        App.screens.body.render(container);
      });
    });
    container.querySelectorAll('.thumb').forEach(th => {
      th.addEventListener('click', () => {
        window._bodySelectedDate = th.dataset.date;
        App.screens.body.render(container);
      });
    });
  } catch (e) {
    container.innerHTML = '<div class="loading" style="color:var(--red)">\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438</div>';
  }
};

function renderBodyAnalysis(a) {
  if (!a || a.version !== 2) return '';
  const m = a.metrics || {};
  const comp = a.composition;
  function deltaColor(c) { return c === 'green' ? 'var(--green)' : c === 'orange' ? 'var(--orange)' : c === 'red' ? 'var(--red)' : 'var(--text-secondary)'; }
  const sentimentColor = {green: 'var(--green)', orange: 'var(--orange)', red: 'var(--red)', neutral: 'var(--text-tertiary)', blue: 'var(--blue)'};

  // Section 1: Key Metrics
  const gainRateColor = m.gain_rate >= 0.15 && m.gain_rate <= 0.5 ? 'var(--green)' : m.gain_rate > 0.5 ? 'var(--orange)' : 'var(--blue)';
  const gainRateSub = m.gain_rate >= 0.15 && m.gain_rate <= 0.5 ? '\u043d\u043e\u0440\u043c\u0430 0.2-0.5' : m.gain_rate > 0.5 ? '\u0431\u044b\u0441\u0442\u0440\u044b\u0439' : '\u043c\u0435\u0434\u043b\u0435\u043d\u043d\u044b\u0439';
  const s1 = `<div class="ba2-section">
    <div class="ba2-header"><i class="ph ph-chart-bar"></i> Ключевые метрики</div>
    <div class="ba2-metric-grid">
      <div class="ba2-metric">
        <div class="ba2-metric-label">\u041c\u0430\u0441\u0441\u0430</div>
        <div class="ba2-metric-value" style="color:var(--green)">${m.weight_delta != null ? (m.weight_delta > 0 ? '+' : '') + m.weight_delta : '\u2014'} \u043a\u0433</div>
        <div class="ba2-metric-sub">${m.weight_before ?? '?'} \u2192 ${m.weight_after ?? '?'} \u0437\u0430 ${m.months ?? '?'} мес</div>
      </div>
      <div class="ba2-metric">
        <div class="ba2-metric-label">Body Fat (Navy)</div>
        <div class="ba2-metric-value" style="color:${m.bf_current > 18 ? 'var(--orange)' : 'var(--blue)'}">~${m.bf_current ?? '\u2014'}%</div>
        <div class="ba2-metric-sub">${m.bf_previous ? '\u0431\u044b\u043b\u043e ~' + m.bf_previous + '%' : '\u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445'}</div>
      </div>
      <div class="ba2-metric">
        <div class="ba2-metric-label">V-Taper</div>
        <div class="ba2-metric-value" style="color:var(--blue)">${m.v_taper ?? '\u2014'}</div>
        <div class="ba2-metric-sub">\u043f\u043b\u0435\u0447\u0438 / \u0442\u0430\u043b\u0438\u044f (\u0446\u0435\u043b\u044c >1.6)</div>
      </div>
      <div class="ba2-metric">
        <div class="ba2-metric-label">\u0422\u0435\u043c\u043f \u043d\u0430\u0431\u043e\u0440\u0430</div>
        <div class="ba2-metric-value" style="color:${gainRateColor}">${m.gain_rate != null ? (m.gain_rate > 0 ? '+' : '') + m.gain_rate + ' \u043a\u0433/\u043d\u0435\u0434' : '\u2014'}</div>
        <div class="ba2-metric-sub">${m.gain_rate != null ? gainRateSub : ''}</div>
      </div>
    </div>
  </div>`;

  // Section 2: Composition
  let s2 = '';
  if (comp && comp.muscle_kg != null) {
    const pctLine = comp.muscle_pct != null && Math.abs(comp.muscle_pct) <= 100 ? `<div style="font-size:11px;color:var(--text-tertiary);text-align:center">\u041e\u0446\u0435\u043d\u043a\u0430 \u043f\u043e Navy + \u043e\u0431\u0445\u0432\u0430\u0442\u0430\u043c (\u00b15%)</div>` : '';
    s2 = `<div class="ba2-divider"></div>
    <div class="ba2-section">
      <div class="ba2-header"><i class="ph ph-scales"></i> Композиция набора</div>
      <div class="ba2-comp-row">
        <div class="ba2-comp-card">
          <div class="ba2-comp-val" style="color:var(--green)">~${comp.muscle_kg} \u043a\u0433</div>
          <div class="ba2-comp-label">\u041c\u044b\u0448\u0446\u044b${comp.muscle_pct != null && Math.abs(comp.muscle_pct) <= 100 ? ' (~' + comp.muscle_pct + '%)' : ''}</div>
        </div>
        <div class="ba2-comp-card">
          <div class="ba2-comp-val" style="color:var(--orange)">~${comp.fat_kg} \u043a\u0433</div>
          <div class="ba2-comp-label">\u0416\u0438\u0440${comp.fat_pct != null && Math.abs(comp.fat_pct) <= 100 ? ' (~' + comp.fat_pct + '%)' : ''}</div>
        </div>
      </div>
      ${pctLine}
    </div>`;
  }

  // Section 3: Progress
  const progRows = (a.progress || []).map(p =>
    `<div class="ba2-progress-row">
      <span class="ba2-progress-name">${p.name}</span>
      <span class="ba2-progress-vals">${p.previous} \u2192 ${p.current}</span>
      <span class="ba2-progress-delta" style="color:${deltaColor(p.color)}">${p.delta > 0 ? '+' : ''}${p.delta}</span>
    </div>`
  ).join('');
  const s3 = progRows ? `<div class="ba2-divider"></div>
    <div class="ba2-section">
      <div class="ba2-header"><i class="ph ph-barbell"></i> Прогресс по группам</div>
      <div class="card" style="padding:10px 12px">${progRows}</div>
    </div>` : '';

  // Section 4: Trends
  const trendRows = (a.trends || []).filter(t => Math.abs(t.per_month) >= 0.1 || t.direction === 'stable').slice(0, 6).map(t =>
    `<div class="ba2-trend-row">
      <div class="ba2-trend-dot" style="background:${sentimentColor[t.sentiment] || 'var(--text-tertiary)'}"></div>
      <span class="ba2-trend-text">${t.name} ${t.text}</span>
      <span class="ba2-trend-val" style="color:${sentimentColor[t.sentiment] || 'var(--text-tertiary)'}">${t.per_month > 0 ? '+' : ''}${t.per_month} \u0441\u043c/мес</span>
    </div>`
  ).join('');
  const s4 = trendRows ? `<div class="ba2-divider"></div>
    <div class="ba2-section">
      <div class="ba2-header"><i class="ph ph-trend-up"></i> Тренды (${m.months || '?'} мес)</div>
      <div class="card" style="padding:10px 12px">${trendRows}</div>
    </div>` : '';

  // Section 5: Vision Verdict
  let s5 = '';
  if (a.vision_verdict) {
    const vsLabel = a.date_previous ? a.date_previous.slice(8,10)+'.'+a.date_previous.slice(5,7) : '\u043f\u0440\u0435\u0434.';
    s5 = `<div class="ba2-divider"></div>
    <div class="ba2-section">
      <div class="ba2-header"><i class="ph ph-eye"></i> Визуальный анализ</div>
      <div class="ba2-verdict">
        <div class="ba2-verdict-title">\u2736 \u0412\u0435\u0440\u0434\u0438\u043a\u0442 <span style="font-weight:400;color:var(--text-tertiary);font-size:10px">vs ${vsLabel}</span></div>
        <div class="ba2-verdict-text">${a.vision_verdict}</div>
      </div>
    </div>`;
  }

  // Section 6: Recommendations
  const recs = (a.recommendations || []).map(r => {
    const bc = r.color === 'green' ? 'var(--green)' : r.color === 'orange' ? 'var(--orange)' : 'var(--blue)';
    return `<div class="ba2-rec" style="border-color:${bc}">
      <div class="ba2-rec-title" style="color:${bc}">${r.title}</div>
      <div class="ba2-rec-text">${r.text}</div>
    </div>`;
  }).join('');
  const s6 = recs ? `<div class="ba2-divider"></div>
    <div class="ba2-section">
      <div class="ba2-header"><i class="ph ph-target"></i> Рекомендации</div>
      ${recs}
    </div>` : '';

  // Next measurement
  let s7 = '';
  if (a.next_measurement) {
    const nd = new Date(a.next_measurement);
    const months = ['\u044f\u043d\u0432\u0430\u0440\u044f','\u0444\u0435\u0432\u0440\u0430\u043b\u044f','\u043c\u0430\u0440\u0442\u0430','\u0430\u043f\u0440\u0435\u043b\u044f','\u043c\u0430\u044f','\u0438\u044e\u043d\u044f','\u0438\u044e\u043b\u044f','\u0430\u0432\u0433\u0443\u0441\u0442\u0430','\u0441\u0435\u043d\u0442\u044f\u0431\u0440\u044f','\u043e\u043a\u0442\u044f\u0431\u0440\u044f','\u043d\u043e\u044f\u0431\u0440\u044f','\u0434\u0435\u043a\u0430\u0431\u0440\u044f'];
    const dd = nd.getDate() + ' ' + months[nd.getMonth()];
    const daysLeft = Math.round((nd - new Date()) / 86400000);
    s7 = `<div class="ba2-next" style="margin-top:8px">
      <div style="font-size:11px;color:var(--text-tertiary)">\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439 \u0437\u0430\u043c\u0435\u0440</div>
      <div style="font-size:15px;font-weight:700;color:var(--blue);margin-top:2px">${dd}</div>
      <div style="font-size:11px;color:var(--text-tertiary)">${daysLeft > 0 ? '\u0447\u0435\u0440\u0435\u0437 ' + daysLeft + ' \u0434\u043d' : '\u0441\u0435\u0433\u043e\u0434\u043d\u044f'}</div>
    </div>`;
  }

  return s1 + s2 + s3 + s4 + s5 + s6 + s7;
}

function renderBody(d) {
  if (!d.latest_measurements) {
    return `
      <div class="screen-header"><h1>\u0422\u0435\u043b\u043e</h1></div>
      <div class="body-empty">
        <i class="ph ph-person-arms-spread" style="font-size:56px;color:var(--blue);opacity:0.6"></i>
        <p style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:4px">\u041e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u0439 \u043f\u0440\u043e\u0433\u0440\u0435\u0441\u0441</p>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;max-width:260px;line-height:1.4">3 \u0444\u043e\u0442\u043e + \u043e\u0431\u0445\u0432\u0430\u0442\u044b \u2014 AI \u043f\u043e\u043a\u0430\u0436\u0435\u0442 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u0442\u0435\u043b\u0430 \u0437\u0430 2 \u043c\u0438\u043d\u0443\u0442\u044b</p>
        <button class="btn-primary" style="max-width:220px;margin:0 auto" onclick="location.hash='#body-add'">+ \u041f\u0435\u0440\u0432\u044b\u0439 \u0437\u0430\u043c\u0435\u0440</button>
      </div>`;
  }

  const angle = window._bodyAngle || 'front';
  const angles = [{id:'front',name:'\u0424\u0440\u043e\u043d\u0442'},{id:'side',name:'\u0411\u043e\u043a'},{id:'back',name:'\u0421\u043f\u0438\u043d\u0430'}];
  const selectedDate = window._bodySelectedDate || d.latest_measurements.date;

  const selected = d.measurement_history.find(m => m.date === selectedDate) || d.latest_measurements;
  const selectedIdx = d.measurement_history.findIndex(m => m.date === selectedDate);
  const prev = selectedIdx >= 0 && selectedIdx < d.measurement_history.length - 1 ? d.measurement_history[selectedIdx + 1] : null;

  const photo = d.photos.find(p => p.date === selectedDate && p.angle === angle);
  const photoHtml = photo
    ? `<img src="${API._baseUrl}/api/photos/${photo.filename}">`
    : '<i class="ph ph-user" style="font-size:48px;color:#3a3a3c;opacity:0.4"></i>';

  const angleTabs = angles.map(a =>
    `<div class="photo-tab ${a.id === angle ? 'active' : ''}" data-angle="${a.id}">${a.name}</div>`
  ).join('');

  const thumbs = d.measurement_history.slice(0, 10).map(m => {
    const isActive = m.date === selectedDate;
    const thumbPhoto = d.photos.find(p => p.date === m.date && p.angle === 'front');
    const dd = m.date.slice(8, 10) + '.' + m.date.slice(5, 7);
    const inner = thumbPhoto
      ? `<img src="${API._baseUrl}/api/photos/${thumbPhoto.filename}"><span>${dd}</span>`
      : `<i class="ph ph-user" style="font-size:16px;opacity:0.15"></i><span>${dd}</span>`;
    return `<div class="thumb ${isActive ? 'active' : ''}" data-date="${m.date}">${inner}</div>`;
  }).join('');

  const rows = BODY_FIELDS.map(f => {
    const val = selected[f.key];
    if (val == null) return '';
    let delta = '';
    if (prev && prev[f.key] != null) {
      const diff = +(val - prev[f.key]).toFixed(1);
      if (diff !== 0) {
        const color = getDeltaColor(f.key, diff);
        delta = `<span class="measure-delta" style="color:${color}">${diff > 0 ? '+' : ''}${diff}</span>`;
      }
    }
    return `<div class="measure-row">
      <span class="measure-name">${f.name}</span>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="measure-val mono">${val} ${f.unit}</span>
        ${delta}
      </div>
    </div>`;
  }).join('');

  const dd = selectedDate.slice(8, 10) + '.' + selectedDate.slice(5, 7);

  let aiHtml = '';
  if (d.ai_analysis && d.ai_analysis.version === 2) {
    aiHtml = renderBodyAnalysis(d.ai_analysis);
  } else if (d.ai_insight) {
    aiHtml = `<div class="ai-insight">
      <div class="ai-insight-label"><i class="ph ph-sparkle" style="color:var(--blue)"></i> AI \u0410\u043d\u0430\u043b\u0438\u0437 \u0442\u0435\u043b\u0430</div>
      <p>${d.ai_insight.text}</p>
    </div>`;
  } else if (d.measurement_history.length >= 2) {
    aiHtml = `<div class="ai-insight" style="opacity:0.5">
      <div class="ai-insight-label"><i class="ph ph-sparkle"></i> AI \u0410\u043d\u0430\u043b\u0438\u0437</div>
      <p>\u0414\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u0444\u043e\u0442\u043e \u0434\u043b\u044f AI \u0430\u043d\u0430\u043b\u0438\u0437\u0430 \u043f\u0440\u043e\u0433\u0440\u0435\u0441\u0441\u0430</p>
    </div>`;
  }

  const compareBtn = d.measurement_history.length >= 2
    ? `<button class="btn-secondary" style="margin-bottom:10px" onclick="location.hash='#compare'"><i class="ph ph-arrows-out-simple"></i> \u0421\u0440\u0430\u0432\u043d\u0438\u0442\u044c \u0437\u0430\u043c\u0435\u0440\u044b</button>`
    : '';

  return `
    <div class="screen-header" style="justify-content:space-between">
      <h1>\u0422\u0435\u043b\u043e</h1>
      <span style="color:var(--text-secondary);font-size:12px">\u0417\u0430\u043c\u0435\u0440\u044b \u0438 \u043f\u0440\u043e\u0433\u0440\u0435\u0441\u0441-\u0444\u043e\u0442\u043e</span>
    </div>

    <div class="photo-area">
      <div class="photo-tabs">${angleTabs}</div>
      ${photoHtml}
    </div>

    ${thumbs ? `<div class="thumb-row">${thumbs}</div>` : ''}

    <div class="card" style="margin-bottom:12px;cursor:pointer" onclick="location.hash='#body-edit/${selected.id}'">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-tertiary);font-weight:600;margin-bottom:4px">\u0417\u0430\u043c\u0435\u0440\u044b \u00b7 ${dd}</div>
      ${rows || '<div style="color:var(--text-tertiary);padding:8px">\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445</div>'}
    </div>

    ${aiHtml}
    ${compareBtn}

    <button class="btn-primary" onclick="location.hash='#body-add'">+ \u0417\u0430\u043c\u0435\u0440 \u0438 \u0444\u043e\u0442\u043e</button>
  `;
}

const FORM_GROUPS = [
  { label: '\u0412\u0435\u0440\u0445', fields: ['shoulders','chest','arm','forearm','neck'] },
  { label: '\u041a\u043e\u0440\u043f\u0443\u0441', fields: ['waist','belly','hip'] },
  { label: '\u041d\u0438\u0437', fields: ['thigh','calf','ankle','wrist'] },
];

function buildBodyForm(measurement, prev, existingPhotos) {
  const isEdit = !!measurement;
  const title = isEdit ? `\u0417\u0430\u043c\u0435\u0440 ${measurement.date.slice(8,10)}.${measurement.date.slice(5,7)}.${measurement.date.slice(0,4)}` : '\u041d\u043e\u0432\u044b\u0439 \u0437\u0430\u043c\u0435\u0440';
  const today = new Date().toISOString().slice(0, 10);
  const dateVal = isEdit ? measurement.date : today;
  const photos = existingPhotos || [];

  function photoZone(angle, label) {
    const existing = photos.find(p => p.angle === angle);
    if (existing) {
      return `<div class="photo-upload-zone" data-angle="${angle}">
        <img src="${API._baseUrl}/api/photos/${existing.filename}">
        <button class="photo-delete" data-filename="${existing.filename}" type="button">\u00d7</button>
        <input type="file" accept="image/*" style="display:none" data-angle="${angle}">
      </div>`;
    }
    return `<div class="photo-upload-zone" data-angle="${angle}" onclick="this.querySelector('input').click()">
      <i class="ph ph-camera upload-icon"></i>
      <span class="upload-label">${label}</span>
      <input type="file" accept="image/*" style="display:none" data-angle="${angle}">
    </div>`;
  }

  function fieldRow(key, name, unit) {
    const val = isEdit && measurement[key] != null ? measurement[key] : '';
    const prevVal = prev && prev[key] != null ? `<div class="form-prev" data-prev>\u043f\u0440\u0435\u0434: ${prev[key]}</div>` : '';
    return `<div class="form-row">
      <label>${name}</label>
      <div>
        <div style="display:flex;align-items:center;gap:8px">
          <input type="text" class="form-input" inputmode="decimal" name="${key}" value="${val}" placeholder="\u2014">
          <span class="form-unit">${unit}</span>
        </div>
        ${prevVal}
      </div>
    </div>`;
  }

  const groups = FORM_GROUPS.map(g => {
    const rows = g.fields.map(key => {
      const f = BODY_FIELDS.find(bf => bf.key === key);
      return fieldRow(key, f.name, f.unit);
    }).join('');
    return `<div class="form-group">
      <div class="form-group-label">${g.label}</div>
      <div class="card">${rows}</div>
    </div>`;
  }).join('');

  const weightPrev = prev && prev.weight != null ? `<div class="form-prev" data-prev>\u043f\u0440\u0435\u0434: ${prev.weight}</div>` : '';
  const weightVal = isEdit && measurement.weight != null ? measurement.weight : '';

  const prevDate = prev ? prev.date : '';

  const deleteBtn = isEdit ? `<button class="btn-danger" id="body-delete-btn" style="margin-top:8px">\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0437\u0430\u043c\u0435\u0440</button>` : '';
  const saveLabel = isEdit ? '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f' : '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c';

  return `
    <div class="screen-header">
      <button class="back-btn" onclick="history.back()"><i class="ph ph-caret-left"></i></button>
      <h1>${title}</h1>
    </div>

    <div class="form-group">
      <div class="card" style="padding:10px 14px">
        <div class="form-row" style="border:none;padding:0">
          <span style="font-weight:600;color:var(--text)"><i class="ph ph-calendar-blank" style="margin-right:6px;color:var(--blue)"></i>\u0414\u0430\u0442\u0430</span>
          <input type="date" class="form-input form-input-date" id="body-date" value="${dateVal}" data-prev-date="${prevDate}" ${isEdit ? 'disabled' : ''}>
        </div>
      </div>
    </div>

    <div class="form-group">
      <div class="form-group-label">\u0424\u043e\u0442\u043e</div>
      <div class="photo-upload-grid">
        ${photoZone('front', '\u0424\u0440\u043e\u043d\u0442')}
        ${photoZone('side', '\u0411\u043e\u043a')}
        ${photoZone('back', '\u0421\u043f\u0438\u043d\u0430')}
      </div>
      <div class="hint">\u041d\u0435\u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e \u00b7 EXIF \u0443\u0434\u0430\u043b\u044f\u0435\u0442\u0441\u044f \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438</div>
    </div>

    <div class="form-group">
      <div class="card" style="padding:10px 14px">
        <div class="form-row" style="border:none;padding:0">
          <span style="font-weight:600;color:var(--text)"><i class="ph ph-scales" style="margin-right:6px;color:var(--blue)"></i>\u0412\u0435\u0441</span>
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <input type="text" class="form-input" inputmode="decimal" name="weight" value="${weightVal}" placeholder="\u2014">
              <span class="form-unit">\u043a\u0433</span>
            </div>
            ${weightPrev}
          </div>
        </div>
      </div>
    </div>

    ${groups}

    <button class="btn-primary" id="body-save-btn" style="margin-bottom:8px">${saveLabel}</button>
    <button class="btn-secondary" onclick="history.back()">\u041e\u0442\u043c\u0435\u043d\u0430</button>
    ${deleteBtn}
  `;
}

function bindBodyForm(container, measurement) {
  const isEdit = !!measurement;

  // Hide "пред:" when selected date is before previous measurement
  const dateInput = container.querySelector('#body-date');
  if (dateInput && !isEdit) {
    const prevDate = dateInput.dataset.prevDate;
    function updatePrevVis() {
      const show = !prevDate || dateInput.value >= prevDate;
      container.querySelectorAll('[data-prev]').forEach(el => {
        el.style.display = show ? '' : 'none';
      });
    }
    dateInput.addEventListener('change', updatePrevVis);
    updatePrevVis();
  }

  container.querySelectorAll('.photo-upload-zone input[type="file"]').forEach(input => {
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const zone = input.closest('.photo-upload-zone');
      const reader = new FileReader();
      reader.onload = (ev) => {
        let img = zone.querySelector('img');
        if (!img) {
          img = document.createElement('img');
          zone.prepend(img);
        }
        img.src = ev.target.result;
        zone.dataset.newFile = 'true';
        const icon = zone.querySelector('.upload-icon');
        const label = zone.querySelector('.upload-label');
        if (icon) icon.style.display = 'none';
        if (label) label.style.display = 'none';
      };
      reader.readAsDataURL(file);
    });
  });

  container.querySelectorAll('.photo-upload-zone img').forEach(img => {
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      const zone = img.closest('.photo-upload-zone');
      zone.querySelector('input[type="file"]').click();
    });
  });

  container.querySelectorAll('.photo-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const filename = btn.dataset.filename;
      try {
        await API.del(`${API._baseUrl}/api/photos/${filename}`);
        const zone = btn.closest('.photo-upload-zone');
        zone.querySelector('img')?.remove();
        btn.remove();
        const angle = zone.dataset.angle;
        const labels = {front:'\u0424\u0440\u043e\u043d\u0442',side:'\u0411\u043e\u043a',back:'\u0421\u043f\u0438\u043d\u0430'};
        zone.innerHTML = `<i class="ph ph-camera upload-icon"></i>
          <span class="upload-label">${labels[angle]}</span>
          <input type="file" accept="image/*" style="display:none" data-angle="${angle}">`;
        zone.onclick = () => zone.querySelector('input').click();
        zone.querySelector('input').addEventListener('change', (e2) => {
          const file2 = e2.target.files[0];
          if (!file2) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            let img2 = zone.querySelector('img');
            if (!img2) { img2 = document.createElement('img'); zone.prepend(img2); }
            img2.src = ev.target.result;
            zone.dataset.newFile = 'true';
            zone.querySelector('.upload-icon').style.display = 'none';
            zone.querySelector('.upload-label').style.display = 'none';
          };
          reader.readAsDataURL(file2);
        });
      } catch (err) {
        alert('\u041e\u0448\u0438\u0431\u043a\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f \u0444\u043e\u0442\u043e: ' + err.message);
      }
    });
  });

  container.querySelector('#body-save-btn').addEventListener('click', async () => {
    const btn = container.querySelector('#body-save-btn');
    btn.disabled = true;
    btn.textContent = '\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u044e...';

    const date = container.querySelector('#body-date').value;
    const data = { date };
    let hasValue = false;
    const hasPhotos = container.querySelectorAll('.photo-upload-zone[data-new-file="true"]').length > 0;

    container.querySelectorAll('.form-input[name]').forEach(input => {
      const val = input.value.trim();
      if (val !== '') {
        data[input.name] = parseFloat(val.replace(',', '.'));
        hasValue = true;
      }
    });

    if (!hasValue && !hasPhotos) {
      alert('\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u0445\u043e\u0442\u044f \u0431\u044b \u043e\u0434\u043d\u043e \u043f\u043e\u043b\u0435');
      btn.disabled = false;
      btn.textContent = isEdit ? '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f' : '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c';
      return;
    }

    try {
      let savedId;
      if (hasValue) {
        if (isEdit) {
          await API.put(`/api/body/${measurement.id}`, data);
          savedId = measurement.id;
        } else {
          const resp = await API.post('/api/body', data);
          savedId = resp.id;
        }
      }

      const photoErrors = [];
      for (const zone of container.querySelectorAll('.photo-upload-zone[data-new-file="true"]')) {
        const fileInput = zone.querySelector('input[type="file"]');
        const file = fileInput?.files[0];
        if (!file) continue;
        const angle = zone.dataset.angle;
        const formData = new FormData();
        formData.append('date', date);
        formData.append('angle', angle);
        formData.append('file', file);
        try {
          await API.upload('/api/photos', formData);
        } catch (err) {
          photoErrors.push(`${angle}: ${err.message}`);
        }
      }

      if (photoErrors.length > 0) {
        alert('\u0417\u0430\u043c\u0435\u0440\u044b \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b, \u043d\u043e \u0444\u043e\u0442\u043e \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043b\u043e\u0441\u044c:\n' + photoErrors.join('\n'));
      }

      location.hash = '#body';
    } catch (err) {
      if (err.message.includes('409')) {
        alert('\u0417\u0430\u043c\u0435\u0440 \u043d\u0430 \u044d\u0442\u0443 \u0434\u0430\u0442\u0443 \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442. \u041e\u0442\u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u0443\u0439\u0442\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044e\u0449\u0438\u0439.');
      } else {
        alert('\u041e\u0448\u0438\u0431\u043a\u0430: ' + err.message);
      }
      btn.disabled = false;
      btn.textContent = isEdit ? '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f' : '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c';
    }
  });

  const deleteBtn = container.querySelector('#body-delete-btn');
  if (deleteBtn && isEdit) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0437\u0430\u043c\u0435\u0440 \u0438 \u0432\u0441\u0435 \u0444\u043e\u0442\u043e?')) return;
      try {
        await API.del(`/api/body/${measurement.id}`);
        location.hash = '#body';
      } catch (err) {
        alert('\u041e\u0448\u0438\u0431\u043a\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f: ' + err.message);
      }
    });
  }
}

async function renderBodyAdd(container) {
  container.innerHTML = '<div class="loading"><i class="ph ph-circle-notch" style="animation:spin 1s linear infinite"></i></div>';
  let prev = null;
  try {
    const d = await API.get('/api/body');
    prev = d.latest_measurements;
  } catch (e) { /* ok, no prev data */ }
  container.innerHTML = buildBodyForm(null, prev);
  bindBodyForm(container, null);
}
App.screens['body-add'].render = renderBodyAdd;

async function renderBodyEdit(container, param) {
  container.innerHTML = '<div class="loading"><i class="ph ph-circle-notch" style="animation:spin 1s linear infinite"></i></div>';
  try {
    const d = await API.get('/api/body');
    const measurement = d.measurement_history.find(m => m.id === parseInt(param));
    if (!measurement) { location.hash = '#body'; return; }
    const idx = d.measurement_history.indexOf(measurement);
    const prev = idx < d.measurement_history.length - 1 ? d.measurement_history[idx + 1] : null;
    const photos = d.photos.filter(p => p.date === measurement.date);
    container.innerHTML = buildBodyForm(measurement, prev, photos);
    bindBodyForm(container, measurement);
  } catch (e) {
    container.innerHTML = '<div class="loading" style="color:var(--red)">\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438</div>';
  }
}
App.screens['body-edit'].render = renderBodyEdit;

App.screens.compare.render = async function(container) {
  container.innerHTML = '<div class="loading"><i class="ph ph-circle-notch" style="animation:spin 1s linear infinite"></i></div>';
  try {
    const d = await API.get('/api/body');
    container.innerHTML = renderCompare(d);
    container.querySelectorAll('.compare-angle-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        window._compareAngle = tab.dataset.angle;
        App.screens.compare.render(container);
      });
    });
    // Init slider
    const slider = container.querySelector('.cmp-slider');
    if (slider) {
      const track = slider.closest('.cmp-photo-box');
      let dragging = false;
      function updateSlider(x) {
        const rect = track.getBoundingClientRect();
        let pct = Math.max(0, Math.min(100, (x - rect.left) / rect.width * 100));
        slider.style.left = pct + '%';
        track.querySelector('.cmp-before').style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
      }
      slider.addEventListener('touchstart', (e) => { dragging = true; e.preventDefault(); }, {passive: false});
      slider.addEventListener('mousedown', () => dragging = true);
      document.addEventListener('touchmove', (e) => { if (dragging) updateSlider(e.touches[0].clientX); }, {passive: true});
      document.addEventListener('mousemove', (e) => { if (dragging) updateSlider(e.clientX); });
      document.addEventListener('touchend', () => dragging = false);
      document.addEventListener('mouseup', () => dragging = false);
    }
  } catch (e) {
    container.innerHTML = '<div class="loading" style="color:var(--red)">Ошибка</div>';
  }
};

function renderCompare(d) {
  if (d.measurement_history.length < 2) {
    return `<div class="screen-header">
      <button class="back-btn" onclick="history.back()"><i class="ph ph-caret-left"></i></button>
      <h1>Сравнение</h1>
    </div>
    <div class="loading">Нужно минимум 2 замера</div>`;
  }

  const oldest = d.measurement_history[d.measurement_history.length - 1];
  const newest = d.measurement_history[0];
  const angle = window._compareAngle || 'front';
  const angles = [{id:'front',name:'Фронт'},{id:'side',name:'Бок'},{id:'back',name:'Спина'}];

  function photoUrl(date) {
    const p = d.photos.find(ph => ph.date === date && ph.angle === angle);
    return p ? `${API._baseUrl}/api/photos/${p.filename}` : null;
  }

  const angleTabs = angles.map(a =>
    `<button class="badge ${a.id === angle ? 'badge-blue' : ''} compare-angle-tab" style="cursor:pointer" data-angle="${a.id}">${a.name}</button>`
  ).join('');

  const beforeUrl = photoUrl(oldest.date);
  const afterUrl = photoUrl(newest.date);
  const hasPhotos = beforeUrl && afterUrl;

  const ddOld = oldest.date.slice(8,10) + '.' + oldest.date.slice(5,7) + '.' + oldest.date.slice(2,4);
  const ddNew = newest.date.slice(8,10) + '.' + newest.date.slice(5,7) + '.' + newest.date.slice(2,4);

  let sliderHtml = '';
  if (hasPhotos) {
    sliderHtml = `<div class="cmp-photo-box">
      <img class="cmp-after" src="${afterUrl}">
      <img class="cmp-before" src="${beforeUrl}" style="clip-path:inset(0 50% 0 0)">
      <div class="cmp-slider" style="left:50%">
        <div class="cmp-slider-line"></div>
        <div class="cmp-slider-handle"><i class="ph ph-arrows-out-line-horizontal" style="font-size:14px"></i></div>
      </div>
      <div class="cmp-label cmp-label-left">${ddOld}<br><span class="mono">${oldest.weight || '\u2014'} кг</span></div>
      <div class="cmp-label cmp-label-right">${ddNew}<br><span class="mono" style="color:var(--blue)">${newest.weight || '\u2014'} кг</span></div>
    </div>`;
  } else {
    sliderHtml = `<div class="compare-grid">
      <div class="compare-photo">${beforeUrl ? `<img src="${beforeUrl}">` : '<div style="padding:40px;opacity:0.2;text-align:center"><i class="ph ph-user" style="font-size:48px"></i></div>'}
        <div class="compare-label"><div style="color:var(--text-tertiary)">${ddOld}</div></div>
      </div>
      <div class="compare-photo">${afterUrl ? `<img src="${afterUrl}">` : '<div style="padding:40px;opacity:0.2;text-align:center"><i class="ph ph-user" style="font-size:48px"></i></div>'}
        <div class="compare-label"><div style="color:var(--blue)">${ddNew}</div></div>
      </div>
    </div>`;
  }

  // Delta rows with mini bars
  const allDeltas = BODY_FIELDS.map(f => {
    const o = oldest[f.key], n = newest[f.key];
    return (o != null && n != null) ? Math.abs(n - o) : 0;
  });
  const maxDelta = Math.max(...allDeltas, 0.1);

  const rows = BODY_FIELDS.map(f => {
    const oldVal = oldest[f.key];
    const newVal = newest[f.key];
    if (oldVal == null || newVal == null) return '';
    const delta = +(newVal - oldVal).toFixed(1);
    if (delta === 0) return '';
    const sign = delta > 0 ? '+' : '';
    const color = getDeltaColor(f.key, delta);
    const barW = Math.max(4, Math.abs(delta) / maxDelta * 60);
    return `<div class="cmp-delta-row">
      <span class="cmp-delta-name">${f.name}</span>
      <div class="cmp-delta-bar-wrap">
        <div class="cmp-delta-bar" style="width:${barW}px;background:${color}"></div>
      </div>
      <span class="cmp-delta-val mono" style="color:${color}">${sign}${delta}</span>
    </div>`;
  }).join('');

  return `
    <div class="screen-header">
      <button class="back-btn" onclick="history.back()"><i class="ph ph-caret-left"></i></button>
      <h1>Сравнение</h1>
    </div>

    <div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px">${angleTabs}</div>

    ${sliderHtml}

    <div class="card" style="margin-top:12px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-tertiary);font-weight:600;margin-bottom:8px">Изменения</div>
      ${rows || '<div style="color:var(--text-tertiary);font-size:13px">Нет изменений</div>'}
    </div>
  `;
}


App.screens.ai.render = async function(container) {
  container.innerHTML = '<div class="loading"><i class="ph ph-circle-notch" style="animation:spin 1s linear infinite"></i></div>';
  try {
    const d = await API.get('/api/ai-summary');
    container.innerHTML = renderAI(d);
    // Refresh button handler
    const refreshBtn = container.querySelector('#ai-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.innerHTML = '<i class="ph ph-circle-notch" style="animation:spin 1s linear infinite;margin-right:4px"></i>Обновляю...';
        refreshBtn.disabled = true;
        try {
          await API.post('/api/ai-refresh');
          // Wait for engine to finish (~15-20s)
          await new Promise(r => setTimeout(r, 18000));
          const d2 = await API.get('/api/ai-summary');
          container.innerHTML = renderAI(d2);
        } catch(e) {
          refreshBtn.innerHTML = '<i class="ph ph-warning"></i> Ошибка';
        }
      });
    }
  } catch (e) {
    container.innerHTML = '<div class="loading" style="color:var(--red)">Ошибка загрузки</div>';
  }
};


// ═══════════════════════════════════════════
// AI Screen V2 — Intelligence Engine
// ═══════════════════════════════════════════

function renderAIv2(d) {
  const r = d.report;
  const phase = r.phase || 'bulk';
  const phaseLabels = {bulk: 'Набор', cut: 'Сушка', maintenance: 'Поддержание'};
  const phaseClasses = {bulk: 'phase-bulk', cut: 'phase-cut', maintenance: 'phase-maintain'};
  const phaseIcons = {bulk: 'ph-trend-up', cut: 'ph-trend-down', maintenance: 'ph-equals'};

  // --- Readiness helpers ---
  const rd = r.readiness || {};
  const rdScore = rd.score;
  const hasRealScore = rdScore != null && rd.status !== 'unknown';
  const rdDisplay = hasRealScore ? rdScore : '—';
  const rdColor = hasRealScore ? (rdScore > 70 ? 'green' : rdScore >= 40 ? 'orange' : 'red') : 'neutral';

  function zClass(z) {
    if (z > 0.1) return 'positive';
    if (z < -0.1) return 'negative';
    return 'neutral';
  }
  function zText(z) {
    if (z > 0) return '+' + z.toFixed(1);
    return z.toFixed(1);
  }

  // --- Stale warning ---
  const staleHtml = d.stale ? `<div style="text-align:center;padding:8px;margin-bottom:12px;background:var(--orange-dim);border-radius:var(--radius-sm);font-size:12px;color:var(--orange)">
    <i class="ph ph-warning"></i> Данные тренировок устарели
  </div>` : '';

  // --- Phase bar with readiness badge ---
  const phaseHtml = `
    <div class="phase-bar-v2">
      <div class="phase-badge ${phaseClasses[phase] || 'phase-maintain'}">
        <i class="ph ${phaseIcons[phase] || 'ph-equals'}" style="font-size:12px"></i>
        ${phaseLabels[phase] || phase}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="week-label">Неделя ${r.week_number || '?'}</div>
        <div class="readiness-badge ${rdColor}">
          <i class="ph ph-heart-half" style="font-size:12px"></i> ${rdDisplay}
        </div>
      </div>
    </div>`;

  // --- Readiness Gauge ---
  const circumference = 2 * Math.PI * 58;
  const offset = hasRealScore ? circumference - (rdScore / 100) * circumference : circumference;
  const strokeColor = rdColor === 'green' ? 'var(--green)' : rdColor === 'orange' ? 'var(--orange)' : rdColor === 'neutral' ? 'var(--text-tertiary)' : 'var(--red)';

  const coldStartNote = rd.cold_start ? `
    <div class="cold-start-note">
      <i class="ph ph-info"></i> Мало данных (${rd.days_of_data || 0} дн.) — оценка приблизительная
    </div>` : '';

  const gaugeHtml = `
    <div class="readiness-gauge">
      <div class="readiness-ring">
        <svg viewBox="0 0 140 140">
          <circle class="track" cx="70" cy="70" r="58" />
          <circle class="fill" cx="70" cy="70" r="58"
            stroke="${strokeColor}"
            stroke-dasharray="${circumference.toFixed(1)}"
            stroke-dashoffset="${offset.toFixed(1)}" />
        </svg>
        <div class="readiness-score ${rdColor}">${rdDisplay}</div>
      </div>
      <div class="readiness-status">${rd.status_ru || ''}</div>
      <div class="readiness-action">${rd.action_ru || ''}</div>
      ${!hasRealScore ? '<button class="btn-refresh-ai" id="ai-refresh-btn" style="margin-top:12px;padding:8px 20px;border:1px solid var(--blue);border-radius:var(--radius-sm);background:transparent;color:var(--blue);font-size:13px;font-weight:600;cursor:pointer"><i class="ph ph-arrows-clockwise" style="margin-right:4px"></i>Обновить отчёт</button>' : ''}
      ${coldStartNote}
    </div>`;

  // --- Mini Dials (HRV / RHR / TSB) ---
  const comps = rd.components || {};
  function miniDial(label, key, unit) {
    const c = comps[key] || {};
    const z = c.z || 0;
    if (c.value == null) {
      return `<div class="mini-dial">
        <div class="mini-dial-label">${label}</div>
        <div class="mini-dial-value" style="color:var(--text-tertiary)">\u2014</div>
      </div>`;
    }
    const zLabel = z > 1 ? '\u041e\u0442\u043b\u0438\u0447\u043d\u043e' : z > 0.3 ? '\u0412 \u043d\u043e\u0440\u043c\u0435' : z > -0.5 ? '\u041d\u043e\u0440\u043c\u0430' : z > -1 ? '\u041d\u0438\u0436\u0435 \u043d\u043e\u0440\u043c\u044b' : '\u041d\u0438\u0437\u043a\u0438\u0439';
    const zColor = z > 0.3 ? 'var(--green)' : z > -0.5 ? 'var(--text-secondary)' : z > -1 ? 'var(--orange)' : 'var(--red)';
    const arrow = z > 0.3 ? '\u2191' : z > -0.5 ? '\u2192' : '\u2193';
    return `<div class="mini-dial">
      <div class="mini-dial-label">${label}</div>
      <div class="mini-dial-value" style="color:${zColor};font-size:14px">${arrow} ${zLabel}</div>
      <div class="mini-dial-z ${zClass(z)}">${zText(z)} \u03c3</div>
    </div>`;
  }
  function miniDialRHR(label, key) {
    const c = comps[key] || {};
    const z = c.z || 0;
    const rz = -z; // invert: lower RHR = better
    if (c.value == null) {
      return `<div class="mini-dial">
        <div class="mini-dial-label">${label}</div>
        <div class="mini-dial-value" style="color:var(--text-tertiary)">\u2014</div>
      </div>`;
    }
    const zLabel = rz > 1 ? '\u041e\u0442\u043b\u0438\u0447\u043d\u043e' : rz > 0.3 ? '\u0412 \u043d\u043e\u0440\u043c\u0435' : rz > -0.5 ? '\u041d\u043e\u0440\u043c\u0430' : rz > -1 ? '\u041d\u0438\u0436\u0435 \u043d\u043e\u0440\u043c\u044b' : '\u041d\u0438\u0437\u043a\u0438\u0439';
    const zColor = rz > 0.3 ? 'var(--green)' : rz > -0.5 ? 'var(--text-secondary)' : rz > -1 ? 'var(--orange)' : 'var(--red)';
    const arrow = rz > 0.3 ? '\u2191' : rz > -0.5 ? '\u2192' : '\u2193';
    return `<div class="mini-dial">
      <div class="mini-dial-label">${label}</div>
      <div class="mini-dial-value" style="color:${zColor};font-size:14px">${arrow} ${zLabel}</div>
      <div class="mini-dial-z ${zClass(rz)}">${zText(z)} \u03c3</div>
    </div>`;
  }
  const dialsHtml = `
    <div class="mini-dials">
      ${miniDial('HRV', 'hrv', 'мс')}
      ${miniDialRHR('ЧСС покоя', 'rhr')}

    </div>`;

  // --- Key Insight (hero card) ---
  let insightHtml = '';
  if (r.key_insight) {
    const ki = r.key_insight;
    const tierIcons = {1: 'ph-warning-octagon', 2: 'ph-warning', 3: 'ph-lightbulb', 4: 'ph-info'};
    insightHtml = `
      <div class="key-insight">
        <div class="key-insight-header">
          <div class="key-insight-icon"><i class="ph ${tierIcons[ki.tier] || 'ph-sparkle'}"></i></div>
          <div class="key-insight-title">${ki.title_ru || ''}</div>
        </div>
        <div class="key-insight-detail">${ki.detail_ru || ''}</div>
        ${ki.action_ru ? `<div class="key-insight-action"><i class="ph ph-arrow-right"></i> ${ki.action_ru}</div>` : ''}
      </div>`;
  }

  // --- Signal Cards ---
  let signalsHtml = '';
  const signals = r.signals || [];
  const kiType = r.key_insight ? r.key_insight.type : null;
  const filteredSignals = signals.filter(s => s.type !== kiType);
  if (filteredSignals.length > 0) {
    const cards = filteredSignals.map(s => {
      const tier = s.tier || 3;
      const level = tier <= 1 ? 'danger' : tier <= 2 ? 'warning' : 'info';
      const iconName = tier <= 1 ? 'ph-warning-octagon' : tier <= 2 ? 'ph-warning' : 'ph-info';
      return `<div class="signal-card ${level}">
        <div class="signal-icon ${level}"><i class="ph ${iconName}"></i></div>
        <div class="signal-body">
          <div class="signal-title">${s.title_ru || ''}</div>
          <div class="signal-detail">${s.detail_ru || ''}</div>
          ${s.action_ru ? `<div class="signal-action"><i class="ph ph-arrow-right" style="font-size:10px"></i> ${s.action_ru}</div>` : ''}
        </div>
      </div>`;
    }).join('');
    signalsHtml = `<div class="signals-section">${cards}</div>`;
  }

  // --- Template Actions ---
  let actionsHtml = '';
  const actions = r.template_actions || [];
  if (actions.length > 0) {
    actionsHtml = `<div class="v2-section-label"><i class="ph ph-barbell"></i> Рекомендации</div>`;
    actionsHtml += actions.map(tg => {
      const actCards = (tg.actions || []).map(act => {
        const isIncrease = act.action === 'increase';
        const exName = act.exercise_name_ru || act.exercise || '?';
        const actText = isIncrease
          ? `→ ${act.suggested_weight_kg}кг × 10 повт (сейчас ${act.current_weight_kg}кг)`
          : `→ снизь до ${act.suggested_weight_kg}кг`;
        return `<div class="action-card ${act.action || act.type}">
          <div class="action-icon ${isIncrease ? 'up' : 'down'}">
            <i class="ph ${isIncrease ? 'ph-trend-up' : 'ph-trend-down'}"></i>
          </div>
          <div class="action-text">
            <div class="action-exercise">${exName}</div>
            <div style="font-size:13px;color:var(--text)">${actText}</div>
            ${act.reason_ru ? `<div class="action-reason">${act.reason_ru}</div>` : ''}
          </div>
        </div>`;
      }).join('');
      return `<div class="template-group">
        <div class="template-header">
          <div class="template-day">${tg.template}</div>
        </div>
        ${actCards}
      </div>`;
    }).join('');
  }

  // --- Nutrition Summary ---
  let nutritionHtml = '';
  const nut = r.nutrition;
  if (nut) {
    const prot = nut.protein || {};
    const protAvg = prot.avg_7d || 0;
    const protTarget = prot.target || 175;
    const protPct = Math.min(100, Math.round((protAvg / protTarget) * 100));
    const protLow = protPct < 80;

    let calRecHtml = '';
    if (nut.calorie_rec && nut.calorie_rec.text_ru) {
      calRecHtml = `<div class="calorie-rec">
        <i class="ph ph-lightning"></i>
        <span>${nut.calorie_rec.text_ru}</span>
      </div>`;
    }

    nutritionHtml = `
      <div class="v2-section-label"><i class="ph ph-fork-knife"></i> Питание</div>
      <div class="nutrition-summary">
        <div class="nutrition-stat-row">
          <span class="nutrition-stat-label">TDEE (оценка)</span>
          <span class="nutrition-stat-value">${nut.tdee_estimate || '\u2014'} ккал</span>
        </div>
        <div class="nutrition-stat-row" style="font-size:12px;color:var(--text-secondary);margin-top:2px">
          <span>Трен: ${nut.training_calories || "—"} ккал</span>
          <span>Отдых: ${nut.rest_calories || "—"} ккал</span>
        </div>
        <div class="protein-progress-wrap">
          <div class="protein-progress-labels">
            <span>Белок (7д среднее): ${protAvg}г</span>
            <span>Цель: ${protTarget}г</span>
          </div>
          <div class="protein-progress-bar">
            <div class="protein-progress-fill ${protLow ? 'low' : ''}" style="width:${protPct}%"></div>
          </div>
        </div>
        ${calRecHtml}
      </div>`;
  }

  // --- Volume Bars V2 ---
  let volumeHtml = '';
  const vol = r.volume;
  if (vol && vol.by_muscle) {
    const muscles = Object.entries(vol.by_muscle);
    const muscleLabels = {
      chest: 'Грудь', back: 'Спина', shoulders: 'Плечи', biceps: 'Бицепс',
      triceps: 'Трицепс', quads: 'Квадрицепс', hamstrings: 'Бицепс бедра',
      glutes: 'Ягодицы', calves: 'Икры', abs: 'Пресс', forearms: 'Предплечья',
      traps: 'Трапеции', lats: 'Широчайшие', delts: 'Дельты',
      upperBack: 'Верх спины', UpperBack: 'Верх спины',
      front_delt: 'Передняя дельта', Front_delt: 'Передняя дельта',
      mid_delt: 'Средняя дельта', Mid_delt: 'Средняя дельта',
      rear_delt: 'Задняя дельта', Rear_delt: 'Задняя дельта',
    };

    const maxVal = Math.max(...muscles.map(([,m]) => Math.max(m.sets || 0, m.mav || 20)));

    const bars = muscles.map(([name, m]) => {
      const sets = m.sets || 0;
      const mev = m.mev || 0;
      const mav = m.mav || 20;
      const status = m.status || 'in_zone';
      const fillPct = Math.min(100, (sets / maxVal) * 100);
      const mevPct = (mev / maxVal) * 100;
      const mavPct = Math.min(100, (mav / maxVal) * 100);
      const statusLabels = {below_mev: 'Ниже MEV', optimal: 'В зоне', in_zone: 'В зоне', above_mav: 'Выше MAV', above_mrv: 'Выше MRV', unknown: 'Нет данных'};
      const label = muscleLabels[name] || name;
      const statusCss = status.replace(/_/g, '-');

      return `<div class="volume-bar-v2">
        <div class="volume-bar-v2-label">
          <span class="volume-bar-v2-name">${label}</span>
          <span class="volume-bar-v2-meta" style="font-size:9px;color:var(--text-tertiary);font-family:var(--font-mono)">${mev > 0 ? "MEV " + mev + " / " : ""}MAV ${mav}</span>
          <span class="volume-bar-v2-sets">${(Math.round(sets * 10) / 10).toFixed(1)}</span>
        </div>
        <div class="volume-bar-v2-track">
          <div class="volume-bar-v2-fill ${statusCss}" style="width:${fillPct.toFixed(1)}%"></div>
          <div class="volume-bar-v2-marker mev" style="left:${mevPct.toFixed(1)}%">
            <span class="volume-bar-v2-marker-label">MEV ${mev}</span>
          </div>
          <div class="volume-bar-v2-marker mav" style="left:${mavPct.toFixed(1)}%">
            <span class="volume-bar-v2-marker-label">MAV ${mav}</span>
          </div>
        </div>
        <div class="volume-bar-v2-status ${statusCss}">${statusLabels[status] || status}</div>
      </div>`;
    }).join('');

    let advisorHtml = '';
    const adv = vol.advisor;
    if (adv) {
      const details = (adv.details_ru || []).map(dt =>
        `<div class="volume-advisor-detail">${dt}</div>`
      ).join('');
      advisorHtml = `<div class="volume-advisor">
        <div class="volume-advisor-summary">${adv.summary_ru || ''}</div>
        ${details}
      </div>`;
    }

    volumeHtml = `
      <div class="v2-section-label"><i class="ph ph-chart-bar"></i> Объём по мышцам</div>
      <div style="font-size:11px;color:var(--text-tertiary);margin:0 0 8px;padding:0 4px">Рабочих подходов в неделю. MEV — мин. для роста, MAV — макс.</div>
      <div class="volume-v2-section">
        ${bars}
        ${advisorHtml}
      </div>`;
  }

  // --- ACWR Warnings ---
  let acwrHtml = '';
  const acwr = r.acwr;
  if (acwr && acwr.warnings && acwr.warnings.length > 0) {
    acwr.warnings = acwr.warnings.filter(w => w.acwr >= 1.5);
    const cards = acwr.warnings.map(w => {
      const isSpike = w.acwr >= 1.5;
      const levelCls = isSpike ? 'spike' : '';
      const valueCls = isSpike ? 'spike' : 'caution';
      return `<div class="acwr-warning ${levelCls}">
        <div class="acwr-icon"><i class="ph ph-warning"></i></div>
        <div class="acwr-body">
          <div class="acwr-muscle">${({
            chest: 'Грудь', back: 'Спина', shoulders: 'Плечи', biceps: 'Бицепс',
            triceps: 'Трицепс', quads: 'Квадрицепс', hamstrings: 'Бицепс бедра',
            glutes: 'Ягодицы', calves: 'Икры', abs: 'Пресс', forearms: 'Предплечья',
            lats: 'Широчайшие', upperBack: 'Верх спины', UpperBack: 'Верх спины',
            front_delt: 'Передняя дельта', Front_delt: 'Передняя дельта',
            mid_delt: 'Средняя дельта', Mid_delt: 'Средняя дельта',
            rear_delt: 'Задняя дельта', Rear_delt: 'Задняя дельта',
          })[w.muscle] || w.muscle}</div>
          <div class="acwr-text">${w.text_ru || ''}</div>
        </div>
        <div class="acwr-value ${valueCls}">${w.acwr ? w.acwr.toFixed(1) : ''}</div>
      </div>`;
    }).join('');
    acwrHtml = `
      <div class="v2-section-label"><i class="ph ph-activity"></i> Резкий рост нагрузки</div>
      <div style="font-size:11px;color:var(--text-tertiary);margin:0 0 8px;padding:0 4px">Объём этой недели / среднее за месяц. >1.5 = резкий скачок.</div>
      <div class="acwr-section">${cards}</div>`;
  }

  // --- Deload Status ---
  let deloadHtml = '';
  const dl = r.deload;
  if (dl) {
    const needed = dl.needed;
    const icon = needed ? 'ph-pause-circle' : 'ph-check-circle';
    deloadHtml = `
      <div class="deload-status ${needed ? 'needed' : ''}">
        <i class="ph ${icon}"></i>
        <span>${dl.text_ru || (needed ? 'Рекомендована разгрузочная неделя' : 'Разгрузка не требуется')}</span>
        ${dl.weeks_since != null ? `<span style="margin-left:auto;font-family:var(--font-mono);font-size:11px;color:var(--text-tertiary)">${dl.weeks_since} нед.</span>` : ''}
      </div>`;
  }

  // --- Praise ---
  let praiseHtml = '';
  const praise = r.praise;
  if (praise && praise.length > 0) {
    const items = (Array.isArray(praise) ? praise : [praise]).map(p => {
      let text;
      if (typeof p === 'string') text = p;
      else if (p.type === 'progression') text = `${p.exercise || '?'}: +${p.delta_kg || 0} кг за ${p.weeks || 4} нед.`;
      else if (p.type === 'streak') text = `${p.weeks || 0} недель подряд!`;
      else if (p.delta_kg) text = `${p.exercise || '?'}: +${p.delta_kg} кг за ${p.weeks || 4} нед.`;
      else if (p.streak_weeks) text = `${p.streak_weeks} недель подряд!`;
      else text = JSON.stringify(p);
      return `<div class="praise-v2-item"><i class="ph ph-star"></i> ${text}</div>`;
    }).join('');
    praiseHtml = `
      <div class="praise-v2">
        <div class="praise-v2-label"><i class="ph ph-trophy" style="font-size:12px"></i> Прогресс</div>
        ${items}
      </div>`;
  }

  // --- Updated at ---
  const updatedHtml = d.generated_at ? `
    <div class="updated-at">
      <i class="ph ph-clock" style="font-size:10px"></i>
      обновлено ${d.generated_at}
    </div>` : '';

  return `
    <div class="screen-header"><h1><i class="ph ph-sparkle" style="font-size:20px"></i> Тренер</h1></div>
    ${staleHtml}
    ${phaseHtml}
    ${gaugeHtml}
    ${dialsHtml}
    ${insightHtml}
    ${signalsHtml}
    ${actionsHtml}
    ${nutritionHtml}
    ${volumeHtml}
    ${acwrHtml}
    ${deloadHtml}
    ${praiseHtml}
    ${updatedHtml}
  `;
}


function renderAI(d) {
  // Pending state
  if (d.status === 'pending') {
    return `
      <div class="screen-header"><h1><i class="ph ph-sparkle" style="font-size:20px"></i> Тренер</h1></div>
      <div class="all-good">
        <span class="all-good-icon"><i class="ph ph-clock"></i></span>
        <div class="all-good-title">Отчёт готовится</div>
        <div class="all-good-sub">${d.message || 'Будет готов завтра утром'}</div>
      </div>`;
  }

  // V2 report: use new layout
  if (d.report_version === 2) return renderAIv2(d);

  const r = d.report;
  const phase = r.phase || 'bulk';
  const phaseLabels = {bulk: 'Набор', cut: 'Сушка', maintenance: 'Поддержание'};
  const phaseClasses = {bulk: 'phase-bulk', cut: 'phase-cut', maintenance: 'phase-maintain'};
  const phaseIcons = {bulk: 'ph-trend-up', cut: 'ph-trend-down', maintenance: 'ph-equals'};

  // Phase bar
  const phaseHtml = `
    <div class="phase-bar">
      <div class="phase-badge ${phaseClasses[phase] || 'phase-maintain'}">
        <i class="ph ${phaseIcons[phase] || 'ph-equals'}" style="font-size:12px"></i>
        ${phaseLabels[phase] || phase}
      </div>
      <div class="week-label">Неделя ${r.week_number || '?'}</div>
    </div>`;

  // Cross-domain alert
  let alertHtml = '';
  if (r.alert) {
    const level = r.alert_level || 'medium';
    const iconCls = level === 'high' ? 'crit' : 'warn';
    const iconName = level === 'high' ? 'ph-warning-circle' : 'ph-warning';
    alertHtml = `
      <div class="cross-alert cross-alert-${level}">
        <div class="alert-top">
          <div class="alert-icon-wrap ${iconCls}"><i class="ph ${iconName}"></i></div>
          <div class="alert-title">${r.alert.split('.')[0]}</div>
        </div>
        <div class="alert-body">${r.alert}</div>
      </div>`;
  }

  // Template actions
  let actionsHtml = '';
  const actions = r.template_actions || [];
  if (actions.length > 0) {
    actionsHtml = actions.map(tg => {
      const actCards = (tg.actions || []).map(act => {
        const isIncrease = act.type === 'increase';
        return `<div class="action-card ${act.type}">
          <div class="action-icon ${isIncrease ? 'up' : 'down'}">
            <i class="ph ${isIncrease ? 'ph-trend-up' : 'ph-trend-down'}"></i>
          </div>
          <div class="action-text">
            <div class="action-exercise">${act.exercise}</div>
            <div style="font-size:13px;color:var(--text)">${act.text}</div>
          </div>
        </div>`;
      }).join('');
      return `<div class="template-group">
        <div class="template-header">
          <div class="template-day">${tg.template}</div>
        </div>
        ${actCards}
      </div>`;
    }).join('');
  } else if (!r.alert) {
    // No alert, no actions → all good
    actionsHtml = `
      <div class="all-good">
        <span class="all-good-icon"><i class="ph ph-check-circle"></i></span>
        <div class="all-good-title">Всё по плану</div>
        <div class="all-good-sub">Держи текущие веса, продолжай в том же духе</div>
      </div>`;
  }

  // Praise
  let praiseHtml = '';
  if (r.praise) {
    praiseHtml = `
      <div class="praise-card">
        <div class="praise-label">
          <i class="ph ph-trophy" style="font-size:12px"></i> Прогресс
        </div>
        <div class="praise-main">${r.praise}</div>
      </div>`;
  }

  // Stale warning
  let staleHtml = '';
  if (d.stale) {
    staleHtml = `<div style="text-align:center;padding:8px;margin-bottom:12px;background:var(--orange-dim);border-radius:var(--radius-sm);font-size:12px;color:var(--orange)">
      <i class="ph ph-warning"></i> Данные тренировок устарели
    </div>`;
  }

  // Updated at
  const updatedHtml = d.generated_at ? `
    <div class="updated-at">
      <i class="ph ph-clock" style="font-size:10px"></i>
      обновлено ${d.generated_at}
    </div>` : '';

  return `
    <div class="screen-header"><h1><i class="ph ph-sparkle" style="font-size:20px"></i> Тренер</h1></div>
    ${staleHtml}
    ${phaseHtml}
    ${alertHtml}
    ${actionsHtml}
    ${praiseHtml}
    ${updatedHtml}
  `;
}

// Settings screen
App.screens.settings.render = async function(container) {
  container.innerHTML = '<div class="loading"><i class="ph ph-circle-notch" style="animation:spin 1s linear infinite"></i></div>';
  try {
    const d = await API.get('/api/settings');
    container.innerHTML = renderSettings(d);
    bindSettingsEvents(container);
  } catch (e) {
    container.innerHTML = '<div class="loading" style="color:var(--red)">Ошибка загрузки</div>';
  }
};

function renderSettings(d) {
  const phase = d.training_phase || 'bulk';
  const phaseActive = {bulk: 'active-bulk', cut: 'active-cut', maintenance: 'active-maint'};

  return `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <span style="color:var(--blue);cursor:pointer" onclick="history.back()"><i class="ph ph-caret-left" style="font-size:16px"></i></span>
      <h1 style="font-size:18px;font-weight:700"><i class="ph ph-gear" style="font-size:18px;color:var(--text-secondary)"></i> Настройки</h1>
    </div>

    <div class="settings-section">
      <div class="settings-label">Фаза тренировок</div>
      <div class="segment-control" id="phase-control">
        <div class="segment-btn ${phase === 'bulk' ? phaseActive.bulk : ''}" data-phase="bulk">Набор</div>
        <div class="segment-btn ${phase === 'cut' ? phaseActive.cut : ''}" data-phase="cut">Сушка</div>
        <div class="segment-btn ${phase === 'maintenance' ? phaseActive.maintenance : ''}" data-phase="maintenance">Поддержание</div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-label">День тренировки</div>
      <div class="input-card">
        <div class="input-group-header">
          <div class="input-group-icon" style="background:var(--blue-dim);color:var(--blue)">
            <i class="ph ph-barbell" style="font-size:12px"></i>
          </div>
          <div class="input-group-title">КБЖУ цель</div>
        </div>
        <div class="input-row">
          <span class="input-name">Калории</span>
          <div style="display:flex;align-items:baseline"><input class="input-value" style="color:var(--blue)" type="number" id="s-td-cal" value="${d.training_day_calories || 2650}"><span class="input-unit">ккал</span></div>
        </div>
        <div class="input-row">
          <span class="input-name">Белок</span>
          <div style="display:flex;align-items:baseline"><input class="input-value" type="number" id="s-td-prot" value="${d.training_day_protein || 175}"><span class="input-unit">г</span></div>
        </div>
        <div class="input-row">
          <span class="input-name">Жиры</span>
          <div style="display:flex;align-items:baseline"><input class="input-value" type="number" id="s-td-fat" value="${d.training_day_fat || 75}"><span class="input-unit">г</span></div>
        </div>
        <div class="input-row">
          <span class="input-name">Углеводы</span>
          <div style="display:flex;align-items:baseline"><input class="input-value" type="number" id="s-td-carbs" value="${d.training_day_carbs || 310}"><span class="input-unit">г</span></div>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-label">День отдыха</div>
      <div class="input-card">
        <div class="input-group-header">
          <div class="input-group-icon" style="background:var(--purple-dim);color:var(--purple)">
            <i class="ph ph-moon" style="font-size:12px"></i>
          </div>
          <div class="input-group-title">КБЖУ цель</div>
        </div>
        <div class="input-row">
          <span class="input-name">Калории</span>
          <div style="display:flex;align-items:baseline"><input class="input-value" style="color:var(--purple)" type="number" id="s-rd-cal" value="${d.rest_day_calories || 2350}"><span class="input-unit">ккал</span></div>
        </div>
        <div class="input-row">
          <span class="input-name">Белок</span>
          <div style="display:flex;align-items:baseline"><input class="input-value" type="number" id="s-rd-prot" value="${d.rest_day_protein || 168}"><span class="input-unit">г</span></div>
        </div>
        <div class="input-row">
          <span class="input-name">Жиры</span>
          <div style="display:flex;align-items:baseline"><input class="input-value" type="number" id="s-rd-fat" value="${d.rest_day_fat || 70}"><span class="input-unit">г</span></div>
        </div>
        <div class="input-row">
          <span class="input-name">Углеводы</span>
          <div style="display:flex;align-items:baseline"><input class="input-value" type="number" id="s-rd-carbs" value="${d.rest_day_carbs || 265}"><span class="input-unit">г</span></div>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-label">Общее</div>
      <div class="input-card">
        <div class="input-row">
          <span class="input-name">Клетчатка</span>
          <div style="display:flex;align-items:baseline"><input class="input-value" type="number" id="s-fiber" value="${d.fiber_goal || 30}"><span class="input-unit">г/день</span></div>
        </div>
      </div>
    </div>

    <button class="btn-save" id="settings-save">Сохранить</button>
  `;
}

function bindSettingsEvents(container) {
  // Phase segmented control
  const phaseActive = {bulk: 'active-bulk', cut: 'active-cut', maintenance: 'active-maint'};
  container.querySelectorAll('#phase-control .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('#phase-control .segment-btn').forEach(b => {
        b.className = 'segment-btn';
      });
      btn.classList.add(phaseActive[btn.dataset.phase] || 'active-maint');
    });
  });

  // Save button
  // КБЖУ sum indicators
  function updateCalSum(prefix) {
    const prot = parseInt(container.querySelector('#s-' + prefix + '-prot').value) || 0;
    const fat = parseInt(container.querySelector('#s-' + prefix + '-fat').value) || 0;
    const carbs = parseInt(container.querySelector('#s-' + prefix + '-carbs').value) || 0;
    const cal = parseInt(container.querySelector('#s-' + prefix + '-cal').value) || 0;
    const sum = prot * 4 + fat * 9 + carbs * 4;
    const diff = cal - sum;
    const el = container.querySelector('#sum-' + prefix);
    if (el) {
      el.textContent = `БЖУ = ${sum} ккал` + (Math.abs(diff) > 10 ? ` (${diff > 0 ? '+' : ''}${diff})` : ' ✓');
      el.style.color = Math.abs(diff) > 50 ? 'var(--orange)' : 'var(--green)';
    }
  }
  ['td', 'rd'].forEach(prefix => {
    ['prot', 'fat', 'carbs', 'cal'].forEach(field => {
      const el = container.querySelector('#s-' + prefix + '-' + field);
      if (el) el.addEventListener('input', () => updateCalSum(prefix));
    });
    // Add indicator element after the input card
    const calInput = container.querySelector('#s-' + prefix + '-carbs');
    if (calInput) {
      const card = calInput.closest('.input-card');
      if (card && !container.querySelector('#sum-' + prefix)) {
        const hint = document.createElement('div');
        hint.id = 'sum-' + prefix;
        hint.style.cssText = 'font-size:11px;font-family:var(--font-mono);text-align:right;padding:4px 4px 0;';
        card.after(hint);
        updateCalSum(prefix);
      }
    }
  });

  container.querySelector('#settings-save').addEventListener('click', async () => {
    const activePhase = container.querySelector('#phase-control .segment-btn[class*="active-"]');
    const phase = activePhase ? activePhase.dataset.phase : 'bulk';

    const body = {
      training_phase: phase,
      training_day_calories: parseInt(container.querySelector('#s-td-cal').value) || 0,
      training_day_protein: parseInt(container.querySelector('#s-td-prot').value) || 0,
      training_day_fat: parseInt(container.querySelector('#s-td-fat').value) || 0,
      training_day_carbs: parseInt(container.querySelector('#s-td-carbs').value) || 0,
      rest_day_calories: parseInt(container.querySelector('#s-rd-cal').value) || 0,
      rest_day_protein: parseInt(container.querySelector('#s-rd-prot').value) || 0,
      rest_day_fat: parseInt(container.querySelector('#s-rd-fat').value) || 0,
      rest_day_carbs: parseInt(container.querySelector('#s-rd-carbs').value) || 0,
      fiber_goal: parseInt(container.querySelector('#s-fiber').value) || 0,
    };

    try {
      await API.post('/api/settings', body);
      const btn = container.querySelector('#settings-save');
      btn.textContent = 'Сохранено ✓';
      btn.style.background = 'var(--green)';
      setTimeout(() => {
        btn.textContent = 'Сохранить';
        btn.style.background = '';
      }, 2000);
    } catch (e) {
      alert('Ошибка сохранения');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => App.init());
