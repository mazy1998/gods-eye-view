import { t } from '../../i18n/index.js';

/** Native embedding adapter for the layer's existing presentation and actions. */
export function createNativeMissionPanels({ roster, host, actions }) {
  const doc = (host || roster).ownerDocument;
  const removers = [];
  const listen = (node, type, fn) => {
    node?.addEventListener(type, fn);
    removers.push(() => node?.removeEventListener(type, fn));
  };
  const make = (tag, text, parent, className = '', attr = null) => {
    const node = doc.createElement(tag);
    node.textContent = text;
    node.className = className;
    if (attr) node.setAttribute(attr, '');
    parent?.append(node);
    return node;
  };
  const button = (label, parent, attribute) => {
    const node = make(
      'button',
      label,
      parent,
      'mission-focus-button',
      attribute,
    );
    node.type = 'button';
    return node;
  };
  let disposed = false;
  let revision = -1;
  let detailId = null;
  let count;
  let list;
  const ownedRosterNodes = [];
  const own = (node) => {
    ownedRosterNodes.push(node);
    return node;
  };
  if (roster) {
    let header = roster.querySelector('.space-mission-roster-header');
    if (!header) {
      header = own(make('div', '', roster, 'space-mission-roster-header'));
      make('strong', t('Available missions'), header);
    }
    count =
      roster.querySelector('[data-mission-roster-count]') ||
      own(make('output', '—', header, '', 'data-mission-roster-count'));
    list =
      roster.querySelector('[data-mission-roster-list]') ||
      own(
        make(
          'div',
          '',
          roster,
          'space-mission-roster-list',
          'data-mission-roster-list',
        ),
      );
    const continuation =
      roster.querySelector('[data-mission-roster-focus-continuation]') ||
      own(
        make(
          'p',
          t('Tab previews a mission; Enter or Space selects it'),
          roster,
          'space-mission-roster-focus-continuation',
          'data-mission-roster-focus-continuation',
        ),
      );
    continuation.tabIndex = -1;
    const row = (target) => target?.closest?.('[data-mission-roster-index]');
    listen(roster, 'click', (event) => {
      const node = row(event.target);
      if (node && roster.contains(node))
        actions.select(Number(node.dataset.missionRosterIndex));
    });
    listen(roster, 'mouseover', (event) => {
      const node = row(event.target);
      if (node && node !== row(event.relatedTarget))
        actions.pointerEnter(Number(node.dataset.missionRosterIndex));
    });
    listen(roster, 'mouseout', (event) => {
      const node = row(event.target);
      if (node && node !== row(event.relatedTarget)) actions.pointerLeave();
    });
    listen(roster, 'focusin', (event) => {
      const node = row(event.target);
      if (node) actions.focus(Number(node.dataset.missionRosterIndex));
    });
    listen(roster, 'focusout', (event) => {
      const next = row(event.relatedTarget);
      actions.blur(
        next && roster.contains(next)
          ? Number(next.dataset.missionRosterIndex)
          : null,
      );
    });
  }
  const panel = host ? make('aside', '', host, 'space-mission-panel') : null;
  if (panel) {
    panel.id = 'space-mission-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', t('Selected Space Mission'));
    listen(panel, 'click', (event) => {
      const node = event.target.closest('button');
      if (!node || node.disabled || !panel.contains(node)) return;
      for (const [attr, action] of Object.entries({
        'data-mission-close': 'deselect',
        'data-mission-show-all': 'deselect',
        'data-mission-focus': 'focusSite',
        'data-mission-replay': 'replay',
        'data-mission-replay-toggle': 'togglePause',
        'data-mission-replay-cancel': 'cancelReplay',
        'data-mission-prev': 'previous',
        'data-mission-next': 'next',
      }))
        if (node.hasAttribute(attr)) actions[action]();
    });
    listen(panel, 'input', (event) => {
      if (event.target.matches('[data-mission-replay-speed]'))
        actions.setReplaySpeed(event.target.value);
    });
  }
  const text = (attr, value) => {
    const node = panel?.querySelector(`[${attr}]`);
    if (node) node.textContent = value || '';
  };
  const table = (rows, attr, columns, parent) => {
    const element = make('table', '', parent, 'mission-data-table');
    const heading = make('tr', '', make('thead', '', element));
    const labels =
      attr === 'data-mission-stages'
        ? [t('Stage'), t('Status'), t('Final position')]
        : [t('Name'), t('Type'), t('Destination')];
    columns = columns.filter((key) => key !== 'position');
    labels.forEach((label) => {
      make('th', label, heading).scope = 'col';
    });
    const body = make('tbody', '', element, '', attr);
    for (const row of rows) {
      const tr = make('tr', '', body);
      for (const key of columns) {
        const cell = make('td', row[key] || '', tr);
        if (key === 'name' && row.detail) make('small', row.detail, cell);
        if (key === 'destination' && row.position)
          make('small', row.position, cell);
      }
    }
    if (!rows.length)
      make(
        'td',
        attr === 'data-mission-stages'
          ? t('No stage re-entry or recovery data')
          : t('No payload data'),
        make('tr', '', body),
      ).colSpan = 3;
  };
  return {
    update({ roster: model, detail, replay }) {
      if (disposed) return;
      if (roster && revision !== model.revision) {
        revision = model.revision;
        count.textContent = model.loaded
          ? t('{count} in 30 days', { count: model.count })
          : '—';
        list.replaceChildren();
        if (!model.items.length)
          make(
            'div',
            model.loaded
              ? t('No missions in the last 30 days')
              : t('Loading missions from the last 30 days'),
            list,
            'space-mission-roster-empty',
          );
        for (const item of model.items) {
          const row = button('', list, 'data-mission-roster-index');
          row.className = 'space-mission-roster-item';
          row.dataset.missionRosterIndex = item.index;
          row.dataset.missionRosterId = item.id;
          row.setAttribute(
            'aria-label',
            t('Select {mission}', { mission: item.label }),
          );
          make('strong', item.label, row);
          make('small', `${item.provider} · ${item.date}`, row);
        }
      }
      if (!panel) return;
      panel.hidden = !detail;
      if (!detail) {
        panel.replaceChildren();
        detailId = null;
        return;
      }
      const structure = JSON.stringify([
        detail.id,
        detail.payloads,
        detail.stages,
        detail.morePayloads,
      ]);
      if (detailId !== structure) {
        detailId = structure;
        panel.replaceChildren();
        const header = make('div', '', panel, 'space-mission-view-header');
        make('strong', '', header, '', 'data-mission-title');
        button('×', header, 'data-mission-close').setAttribute(
          'aria-label',
          t('Deselect mission'),
        );
        const fields = make('div', '', panel, 'space-mission-detail');
        for (const [key, label] of Object.entries({
          provider: t('Operator'),
          status: t('Status'),
          site: t('Launch site'),
          time: t('Launch time'),
          orbit: t('Orbit'),
          'ascent-source': t('Ascent path'),
          distance: t('Distance from Earth'),
          speed: t('Satellite speed'),
        })) {
          const field = make('span', '', fields, '', 'data-mission-field');
          make('small', label, field);
          make('b', '', field, '', `data-mission-${key}`);
        }
        const payload = make('section', '', panel, 'mission-data-section');
        make('h4', t('Payload'), payload);
        table(
          detail.payloads,
          'data-mission-payloads',
          ['name', 'type', 'destination'],
          payload,
        );
        if (detail.morePayloads) make('p', detail.morePayloads, payload);
        if (detail.stages.length) {
          const stages = make(
            'section',
            '',
            panel,
            'mission-data-section',
            'data-mission-stages-section',
          );
          make('h4', t('Stages and recovery'), stages);
          table(
            detail.stages,
            'data-mission-stages',
            ['name', 'status', 'destination', 'position'],
            stages,
          );
        }
        const speed = make('div', '', panel, 'mission-replay-speed-control');
        make('label', t('Replay speed'), speed).htmlFor =
          'space-mission-replay-speed';
        make('output', '', speed, '', 'data-mission-replay-speed-output');
        const slider = make(
          'input',
          '',
          speed,
          'gev-quantitative-slider',
          'data-mission-replay-speed',
        );
        slider.id = 'space-mission-replay-speed';
        slider.type = 'range';
        slider.min = '0.25';
        slider.max = '4';
        slider.step = '0.25';
        slider.setAttribute('aria-label', t('Replay speed multiplier'));
        const controls = make('div', '', panel, 'mission-action-row');
        button(t('Focus'), controls, 'data-mission-focus');
        button(t('Replay ascent'), controls, 'data-mission-replay');
        const transport = make(
          'div',
          '',
          controls,
          'mission-replay-transport',
          'data-mission-replay-transport',
        );
        button('Ⅱ', transport, 'data-mission-replay-toggle');
        button('×', transport, 'data-mission-replay-cancel').setAttribute(
          'aria-label',
          t('Cancel replay'),
        );
        const navigation = make('div', '', panel, 'space-mission-nav');
        button(t('Previous'), navigation, 'data-mission-prev');
        make('span', '', navigation, 'mission-nav-index', 'data-mission-index');
        button(t('Next'), navigation, 'data-mission-next');
        button(t('Show all missions'), panel, 'data-mission-show-all');
      }
      for (const [attr, value] of Object.entries({
        title: detail.title,
        provider: detail.provider,
        status: detail.status,
        site: detail.site,
        time: detail.time,
        orbit: detail.orbit,
        'ascent-source': detail.ascent,
        distance: detail.distance,
        speed: detail.speed,
        index: detail.position,
        'replay-speed-output': replay.speedText,
      }))
        text(`data-mission-${attr}`, value);
      panel.querySelector('[data-mission-speed]').title =
        detail.speedTitle || '';
      for (const [attr, disabled] of [
        ['prev', !detail.canPrevious],
        ['next', !detail.canNext],
      ])
        panel.querySelector(`[data-mission-${attr}]`).disabled = disabled;
      const replayButton = panel.querySelector('[data-mission-replay]');
      replayButton.hidden = replay.active || !replay.available;
      replayButton.disabled = !replay.available;
      replayButton.setAttribute('aria-pressed', String(replay.active));
      const transport = panel.querySelector('[data-mission-replay-transport]');
      transport.hidden = !replay.active;
      transport.classList.toggle('is-paused', replay.active && replay.paused);
      const pause = panel.querySelector('[data-mission-replay-toggle]');
      pause.textContent = replay.paused ? '▶' : 'Ⅱ';
      pause.disabled = !replay.active;
      pause.setAttribute(
        'aria-label',
        replay.paused ? t('Resume replay') : t('Pause replay'),
      );
      const speed = panel.querySelector('[data-mission-replay-speed]');
      if (doc.activeElement !== speed) speed.value = replay.speed;
      speed.parentElement.hidden = !replay.available;
      speed.style.setProperty('--replay-speed-progress', replay.progress);
    },
    dispose({ clearHost = false } = {}) {
      if (disposed) return;
      disposed = true;
      for (const remove of removers.splice(0)) remove();
      if (clearHost) roster?.replaceChildren();
      else {
        list?.replaceChildren();
        for (const node of ownedRosterNodes) node.remove();
      }
      panel?.remove();
    },
  };
}
