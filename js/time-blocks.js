// ═══════════════════════════════════════════════════════════════════
// TIME BLOCKS for the daily-checklist card in the barn-walk modal
// -------------------------------------------------------------------
// Splits the 10 daily-checklist tasks into 3 time blocks based on
// the shift's two breaks (9 AM and lunch). Each block:
//   • shows expected vs. elapsed time
//   • starts its timer the first time any task in it is reviewed
//   • auto-closes when every task in the block is Pass/Fail-reviewed
//
// Tasks can be re-assigned between blocks via the "↕ Move" button on
// each row. Block assignments + timestamps persist in localStorage so
// they survive a page reload during the shift.
//
// Implementation: pure-additive — wraps existing global functions
// (bwSetCheck / bwInitChecklist / bwSaveDraft / bwRestoreFromData)
// instead of editing them.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const BLOCKS = [
    { id:'b1',
      label:'BLOCK 1 — START → 9 AM BREAK',
      shortLabel:'Block 1',
      window:'~7:00 – 9:00 AM',
      color:'#7ad07a', bg:'#0a2010', border:'#2a5a2a',
      defaultTasks:['fwv','birdcheck','flycheck','rodentcheck'] },
    { id:'b2',
      label:'BLOCK 2 — 9 AM → LUNCH',
      shortLabel:'Block 2',
      window:'~9:00 AM – 12:00 PM',
      color:'#e0b048', bg:'#1a1200', border:'#4a3500',
      defaultTasks:['watertubes','frontofhouse','undercages'] },
    { id:'b3',
      label:'BLOCK 3 — LUNCH → END OF SHIFT',
      shortLabel:'Block 3',
      window:'~12:30 PM – End',
      color:'#5aa8f8', bg:'#0d1f3a', border:'#1e3a6a',
      defaultTasks:['blowoff','wheelbarrow','hallways'] },
  ];

  // task short id → blockId currently assigned
  const _taskBlock = {};
  // blockId → { startedAt, closedAt }  (epoch millis)
  let   _state = {};
  let   _tickHandle = null;

  function rowKey(row)        { return row.id.replace(/^bw-cl-/, ''); }
  function findRowByKey(key)  { return document.getElementById('bw-cl-' + key); }

  // ── DOM construction ────────────────────────────────────────────
  function buildBlocks() {
    const root = document.getElementById('bw-checklist-items');
    if (!root || root.dataset.blocked === '1') return;
    root.dataset.blocked = '1';

    // Helper banner above the rows
    const helpBanner = document.createElement('div');
    helpBanner.style.cssText = 'background:#0a1a0a;border:1px dashed #2a4a2a;border-radius:8px;padding:8px 10px;margin:0 0 10px;font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#7a9a7a;line-height:1.45;';
    helpBanner.innerHTML = '🕒 <strong style="color:#9ad0a0;">Tasks are split by shift breaks</strong> — work through Block&nbsp;1 before the 9 AM break, Block&nbsp;2 before lunch, and Block&nbsp;3 before end of shift. Use <strong>↕&nbsp;Move</strong> on a task to shift it into another block.';
    root.parentNode.insertBefore(helpBanner, root);

    // Snapshot the existing rows in DOM order
    const rows = Array.from(root.querySelectorAll(':scope > .bw-cl-row'));
    const taskByKey = {};
    rows.forEach(r => { taskByKey[rowKey(r)] = r; });

    // Build the 3 block containers
    BLOCKS.forEach(b => {
      const block = document.createElement('div');
      block.className = 'bw-cl-block';
      block.dataset.block = b.id;
      block.style.cssText = 'background:#050f05;border:1.5px solid ' + b.border + ';border-radius:12px;padding:10px 12px;margin:0 0 14px;';
      block.innerHTML =
        '<div class="bw-cl-block-header" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid ' + b.border + ';">' +
          '<div>' +
            '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;color:' + b.color + ';letter-spacing:1.5px;">' + b.label + '</div>' +
            '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#5a8a5a;margin-top:3px;">' + b.window + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">' +
            '<span class="bw-block-elapsed" data-block-elapsed="' + b.id + '" style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#5a8a5a;background:#0a1a0a;border:1px solid #1a3a1a;border-radius:8px;padding:3px 8px;">⏱ —</span>' +
            '<span class="bw-block-status" data-block-status="' + b.id + '" style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#5a8a5a;background:#0a1a0a;border:1px solid #1a3a1a;border-radius:8px;padding:3px 8px;">○ open</span>' +
          '</div>' +
        '</div>' +
        '<div class="bw-cl-block-body" data-block-body="' + b.id + '"></div>';
      root.appendChild(block);
    });

    // Distribute the existing rows into blocks (default schedule)
    BLOCKS.forEach(b => {
      const body = root.querySelector('[data-block-body="' + b.id + '"]');
      if (!body) return;
      b.defaultTasks.forEach(k => {
        const row = taskByKey[k];
        if (!row) return;
        body.appendChild(row);
        row.dataset.block = b.id;
        _taskBlock[k] = b.id;
        decorateRow(row);
      });
    });

    // Any unassigned rows fall through to the last block
    rows.forEach(r => {
      const k = rowKey(r);
      if (_taskBlock[k]) return;
      const body = root.querySelector('[data-block-body="b3"]');
      if (!body) return;
      body.appendChild(r);
      r.dataset.block = 'b3';
      _taskBlock[k] = 'b3';
      decorateRow(r);
    });

    updateAllBlocks();
    if (!_tickHandle) _tickHandle = setInterval(updateAllBlocks, 30000); // refresh elapsed every 30s
  }

  // ── Row decoration: add the "↕ Move" button ─────────────────────
  function decorateRow(row) {
    const btnRow = row.querySelector('.bw-cl-btns');
    if (!btnRow || btnRow.querySelector('.bw-cl-move-btn')) return;
    const k = rowKey(row);
    const btn = document.createElement('button');
    btn.className = 'bw-cl-move-btn';
    btn.title = 'Move to a different time block';
    btn.style.cssText = 'padding:5px 8px;border-radius:6px;border:1px solid #3a3a5a;background:#0a0a1f;color:#9a9ad0;font-family:\'IBM Plex Mono\',monospace;font-size:9px;font-weight:700;cursor:pointer;white-space:nowrap;margin-left:4px;touch-action:manipulation;min-width:44px;min-height:44px;';
    btn.textContent = '↕ Move';
    btn.onclick = function (e) { e.stopPropagation(); openMoveMenu(k, btn); };
    btnRow.appendChild(btn);
  }

  function openMoveMenu(key, anchorBtn) {
    document.getElementById('bw-cl-move-menu')?.remove();
    const menu = document.createElement('div');
    menu.id = 'bw-cl-move-menu';
    menu.style.cssText = 'position:absolute;background:#0a1a0a;border:1.5px solid #2a5a2a;border-radius:10px;padding:8px;box-shadow:0 6px 24px rgba(0,0,0,0.6);z-index:11000;min-width:240px;';
    BLOCKS.forEach(b => {
      const isCurrent = _taskBlock[key] === b.id;
      const opt = document.createElement('button');
      opt.style.cssText = 'display:block;width:100%;text-align:left;padding:9px 10px;margin:0 0 4px;background:' + (isCurrent ? '#1a3a1a' : '#050f05') + ';border:1px solid ' + b.color + '55;border-radius:7px;color:#f0ead8;font-family:\'IBM Plex Mono\',monospace;font-size:11px;cursor:' + (isCurrent ? 'default' : 'pointer') + ';';
      opt.innerHTML =
        '<span style="color:' + b.color + ';font-weight:700;">' + b.shortLabel + '</span><br>' +
        '<span style="font-size:9px;color:#7a9a7a;">' + b.window + (isCurrent ? ' · current' : '') + '</span>';
      if (!isCurrent) opt.onclick = function () { moveTask(key, b.id); menu.remove(); };
      menu.appendChild(opt);
    });
    document.body.appendChild(menu);
    // Position relative to the trigger button
    const r = anchorBtn.getBoundingClientRect();
    const top  = Math.min(window.innerHeight - menu.offsetHeight - 8, r.bottom + 6) + window.scrollY;
    const left = Math.max(8, Math.min(window.innerWidth - menu.offsetWidth - 8, r.left)) + window.scrollX;
    menu.style.top  = top  + 'px';
    menu.style.left = left + 'px';
    setTimeout(function () {
      const off = function (e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', off, true);
        }
      };
      document.addEventListener('click', off, true);
    }, 0);
  }

  function moveTask(key, toBlock) {
    const row  = findRowByKey(key);
    const body = document.querySelector('[data-block-body="' + toBlock + '"]');
    if (!row || !body) return;
    body.appendChild(row);
    row.dataset.block = toBlock;
    _taskBlock[key]   = toBlock;
    touchBlock(toBlock);  // moving INTO a block counts as touching it
    updateAllBlocks();
    saveBlockState();
  }

  // ── Block timer state ───────────────────────────────────────────
  function touchBlock(blockId) {
    if (!_state[blockId]) _state[blockId] = {};
    if (!_state[blockId].startedAt) _state[blockId].startedAt = Date.now();
  }

  function blockTaskKeys(blockId) {
    return Array.from(document.querySelectorAll('[data-block-body="' + blockId + '"] > .bw-cl-row')).map(rowKey);
  }

  function blockReviewedCount(blockId) {
    const checks = window._bwChecklist || {};
    return blockTaskKeys(blockId).filter(k => checks[k] === 'pass' || checks[k] === 'fail').length;
  }

  function blockExpectedMinutes(blockId) {
    return Array.from(document.querySelectorAll('[data-block-body="' + blockId + '"] > .bw-cl-row'))
      .reduce((s, r) => s + (parseInt(r.dataset.minutes || '0') || 0), 0);
  }

  function fmt(min) {
    if (min < 1) return '<1m';
    if (min < 60) return Math.round(min) + 'm';
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return m ? h + 'h ' + m + 'm' : h + 'h';
  }

  function updateBlock(blockId) {
    const elap = document.querySelector('[data-block-elapsed="' + blockId + '"]');
    const stat = document.querySelector('[data-block-status="' + blockId + '"]');
    const blkEl = document.querySelector('.bw-cl-block[data-block="' + blockId + '"]');
    if (!elap || !stat) return;
    const tasks    = blockTaskKeys(blockId);
    const reviewed = blockReviewedCount(blockId);
    const expected = blockExpectedMinutes(blockId);
    const st       = _state[blockId] || {};

    if (tasks.length === 0) {
      elap.textContent = '⏱ no tasks';
      stat.textContent = '— empty';
      stat.style.color = '#5a7a5a'; stat.style.borderColor = '#1a3a1a'; stat.style.background = '#0a1a0a';
      if (blkEl) blkEl.style.opacity = '0.55';
      return;
    }
    if (blkEl) blkEl.style.opacity = '1';

    // Closed
    if (st.closedAt) {
      const min = Math.round((st.closedAt - (st.startedAt || st.closedAt)) / 60000);
      stat.textContent = '✓ closed · ' + fmt(min) + ' actual';
      stat.style.color = '#4caf50'; stat.style.borderColor = '#2a5a2a'; stat.style.background = '#0a2a0a';
      elap.textContent = '⏱ planned ' + fmt(expected) + ' · actual ' + fmt(min);
      elap.style.color = (min <= expected) ? '#4caf50' : '#d69e2e';
      elap.style.borderColor = '#2a5a2a'; elap.style.background = '#0a2a0a';
      return;
    }

    // Open status
    stat.textContent = reviewed + '/' + tasks.length + ' reviewed';
    if (reviewed === 0) {
      stat.style.color = '#5a7a5a'; stat.style.borderColor = '#1a3a1a'; stat.style.background = '#0a1a0a';
    } else if (reviewed < tasks.length) {
      stat.style.color = '#d69e2e'; stat.style.borderColor = '#4a3500'; stat.style.background = '#1a1200';
    } else {
      stat.style.color = '#4caf50'; stat.style.borderColor = '#2a5a2a'; stat.style.background = '#0a2a0a';
    }

    if (st.startedAt) {
      const mins = (Date.now() - st.startedAt) / 60000;
      elap.textContent = '⏱ ' + fmt(mins) + ' elapsed · planned ' + fmt(expected);
      if (mins > expected && expected > 0) {
        elap.style.color = '#e07070'; elap.style.borderColor = '#5a2020'; elap.style.background = '#1a0505';
      } else {
        elap.style.color = '#7ab07a'; elap.style.borderColor = '#1a4a1a'; elap.style.background = '#0a2a0a';
      }
    } else {
      elap.textContent = '⏱ planned ' + fmt(expected) + ' · not started';
      elap.style.color = '#5a8a5a'; elap.style.borderColor = '#1a3a1a'; elap.style.background = '#0a1a0a';
    }
  }

  function updateAllBlocks() {
    BLOCKS.forEach(b => updateBlock(b.id));
    autoCloseFullBlocks();
  }

  function autoCloseFullBlocks() {
    const checks = window._bwChecklist || {};
    BLOCKS.forEach(b => {
      const tasks = blockTaskKeys(b.id);
      if (!tasks.length) return;
      const all = tasks.every(k => checks[k] === 'pass' || checks[k] === 'fail');
      if (!_state[b.id]) _state[b.id] = {};
      const st = _state[b.id];
      if (all && !st.closedAt) {
        if (!st.startedAt) st.startedAt = Date.now();
        st.closedAt = Date.now();
        updateBlock(b.id);
        saveBlockState();
      } else if (!all && st.closedAt) {
        // user un-reviewed a task — re-open the block
        st.closedAt = null;
        updateBlock(b.id);
        saveBlockState();
      }
    });
  }

  // ── Persistence ─────────────────────────────────────────────────
  function blockKey() {
    const farm  = window._bwFarm;
    const house = window._bwHouse;
    if (!farm || !house) return null;
    return 'bwBlocks-' + farm + '-' + house + '-' + new Date().toISOString().slice(0, 10);
  }

  function saveBlockState() {
    try {
      const k = blockKey();
      if (!k) return;
      localStorage.setItem(k, JSON.stringify({ state: _state, taskBlock: _taskBlock, ts: Date.now() }));
    } catch (e) { /* quota / private mode — ignore */ }
  }

  function loadBlockState() {
    try {
      const k = blockKey();
      if (!k) return;
      const raw = localStorage.getItem(k);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj.state)     _state = obj.state;
      if (obj.taskBlock) {
        Object.entries(obj.taskBlock).forEach(([taskK, blkId]) => {
          const row  = findRowByKey(taskK);
          const body = document.querySelector('[data-block-body="' + blkId + '"]');
          if (row && body) {
            body.appendChild(row);
            row.dataset.block = blkId;
            _taskBlock[taskK] = blkId;
          }
        });
      }
    } catch (e) { /* ignore */ }
  }

  function resetState() {
    _state = {};
    BLOCKS.forEach(b => { _state[b.id] = {}; });
  }

  // ── Hook existing globals (additive — never replaces) ───────────
  function wrap(name, after) {
    const orig = window[name];
    if (typeof orig !== 'function') return false;
    window[name] = function () {
      const r = orig.apply(this, arguments);
      try { after.apply(this, arguments); } catch (e) { console.error('[time-blocks] hook ' + name + ':', e); }
      return r;
    };
    return true;
  }

  function installHooks() {
    // Pass/Fail click on a task: mark its block as touched + recompute
    wrap('bwSetCheck', function (key) {
      const blockId = _taskBlock[key];
      if (blockId) touchBlock(blockId);
      updateAllBlocks();
      saveBlockState();
    });

    // Modal open / state reset
    wrap('bwInitChecklist', function () {
      resetState();
      // Then attempt to load any saved block state for this farm/house/date
      // (runs once _bwFarm/_bwHouse are set, which happens before bwInitChecklist
      //  is called from openBarnWalk)
      loadBlockState();
      updateAllBlocks();
    });

    // After a draft restore, also restore block state
    wrap('bwRestoreFromData', function () {
      loadBlockState();
      updateAllBlocks();
    });
  }

  // ── Boot ────────────────────────────────────────────────────────
  function init() {
    buildBlocks();
    installHooks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
