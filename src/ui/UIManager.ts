import { getIconSvg, IconKey } from '../assets/icons';
import { ITEMS, WATERING_CAN_MAX } from '../config/farmConfig';
import { InventorySystem } from '../game/InventorySystem';
import { TaskSystem } from '../game/TaskSystem';
import { InteractionInfo, ItemId, TimeOfDayInfo } from '../types';

export interface UICallbacks {
  onPlayClick: () => void;
  onToggleSpeed: () => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onToggleVfx: () => void;
  onSensitivityChange: (value: number) => void;
  onTimePreset: (preset: 'morning' | 'noon' | 'sunset' | 'night') => void;
  onSelectHotbar: (idx: number) => void;
  onEquipFromBag: (id: ItemId) => void;
  onInventoryOpenChange: (open: boolean) => void;
}

export class UIManager {
  private timeIconEl = document.getElementById('time-icon')!;
  private dayLabelEl = document.getElementById('day-label')!;
  private phaseLabelEl = document.getElementById('phase-label')!;
  private clockLabelEl = document.getElementById('clock-label')!;
  private btnSpeed = document.getElementById('btn-speed')!;
  private btnSound = document.getElementById('btn-sound')!;
  private btnBag = document.getElementById('btn-bag')!;
  private btnMenu = document.getElementById('btn-menu')!;

  private waterMiniIcon = document.getElementById('water-mini-icon')!;
  private waterMeterFill = document.getElementById('water-meter-fill')!;
  private waterMeterText = document.getElementById('water-meter-text')!;
  private coinMiniIcon = document.getElementById('coin-mini-icon')!;
  private coinCountEl = document.getElementById('coin-count')!;

  private taskHeaderTitle = document.getElementById('task-header-title')!;
  private taskCounter = document.getElementById('task-counter')!;
  private taskListEl = document.getElementById('task-list')!;

  private crosshairEl = document.getElementById('crosshair')!;
  private interactCard = document.getElementById('interact-card')!;
  private interactIcon = document.getElementById('interact-icon')!;
  private interactTitle = document.getElementById('interact-title')!;
  private interactBadge = document.getElementById('interact-badge')!;
  private interactSubtitle = document.getElementById('interact-subtitle')!;
  private cropProgressWrap = document.getElementById('crop-progress-wrap')!;
  private cropProgressLabel = document.getElementById('crop-progress-label')!;
  private cropProgressPct = document.getElementById('crop-progress-pct')!;
  private cropProgressFill = document.getElementById('crop-progress-fill')!;
  private moistureWrap = document.getElementById('moisture-wrap')!;
  private moistureFill = document.getElementById('moisture-fill')!;
  private interactAction = document.getElementById('interact-action')!;
  private interactActionText = document.getElementById('interact-action-text')!;
  private interactHint = document.getElementById('interact-hint')!;

  private toastContainer = document.getElementById('toast-container')!;
  private harvestStrip = document.getElementById('harvest-strip')!;
  private selectedItemLabel = document.getElementById('selected-item-label')!;
  private hotbarEl = document.getElementById('hotbar')!;

  private menuOverlay = document.getElementById('menu-overlay')!;
  private menuTitle = document.getElementById('menu-title')!;
  private menuSubtitle = document.getElementById('menu-subtitle')!;
  private btnPlay = document.getElementById('btn-play')!;
  private btnToggleMusic = document.getElementById('btn-toggle-music')!;
  private btnToggleMute = document.getElementById('btn-toggle-mute')!;
  private btnToggleVfx = document.getElementById('btn-toggle-vfx')!;
  private inputSensitivity = document.getElementById('input-sensitivity') as HTMLInputElement;
  private sensValueEl = document.getElementById('sens-value')!;

  private invModal = document.getElementById('inventory-modal')!;
  private invGridSupplies = document.getElementById('inv-grid-supplies')!;
  private invGridHarvest = document.getElementById('inv-grid-harvest')!;
  private btnCloseInv = document.getElementById('btn-close-inv')!;
  private btnResumeFromInv = document.getElementById('btn-resume-from-inv')!;

  public isInventoryOpen = false;
  public isMenuVisible = true;
  private hasEnteredOnce = false;

  constructor(
    private inventory: InventorySystem,
    private tasks: TaskSystem,
    private callbacks: UICallbacks
  ) {
    this.waterMiniIcon.innerHTML = getIconSvg('water');
    this.coinMiniIcon.innerHTML = getIconSvg('coin');

    this.bindButtons();
    this.renderHotbar();
    this.renderTasks();
  }

  private bindButtons(): void {
    this.btnPlay.addEventListener('click', () => {
      this.hasEnteredOnce = true;
      this.setMenuVisible(false);
      this.callbacks.onPlayClick();
    });

    this.btnSpeed.addEventListener('click', () => this.callbacks.onToggleSpeed());
    this.btnSound.addEventListener('click', () => this.callbacks.onToggleMute());
    this.btnBag.addEventListener('click', () => this.toggleInventory());
    this.btnMenu.addEventListener('click', () => {
      if (this.isInventoryOpen) this.setInventoryOpen(false);
      this.setMenuVisible(!this.isMenuVisible);
    });
    this.btnCloseInv.addEventListener('click', () => this.setInventoryOpen(false));
    this.btnResumeFromInv.addEventListener('click', () => {
      this.setInventoryOpen(false);
      this.callbacks.onPlayClick();
    });

    this.btnToggleMusic.addEventListener('click', () => this.callbacks.onToggleMusic());
    this.btnToggleMute.addEventListener('click', () => this.callbacks.onToggleMute());
    this.btnToggleVfx.addEventListener('click', () => this.callbacks.onToggleVfx());
    this.inputSensitivity.addEventListener('input', () => {
      const v = parseFloat(this.inputSensitivity.value);
      this.sensValueEl.textContent = `${v.toFixed(1)}×`;
      this.callbacks.onSensitivityChange(v);
    });

    document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.time as 'morning' | 'noon' | 'sunset' | 'night';
        this.callbacks.onTimePreset(preset);
      });
    });
  }

  public setMenuVisible(visible: boolean): void {
    this.isMenuVisible = visible;
    this.menuOverlay.classList.toggle('hidden', !visible);
    if (visible && this.hasEnteredOnce) {
      this.menuTitle.textContent = 'Farm Paused';
      this.menuSubtitle.textContent =
        'Take a peaceful breath, adjust the time of day or cozy soundtrack, and jump right back in whenever you are ready.';
      this.btnPlay.textContent = 'Resume Sunnybrook Farm';
    }
  }

  public toggleInventory(): void {
    this.setInventoryOpen(!this.isInventoryOpen);
  }

  public setInventoryOpen(open: boolean): void {
    this.isInventoryOpen = open;
    this.invModal.classList.toggle('hidden', !open);
    if (open) {
      this.renderInventoryModal();
    }
    this.callbacks.onInventoryOpenChange(open);
  }

  public updateTime(info: TimeOfDayInfo, speedMult: number): void {
    this.dayLabelEl.textContent = `Day ${info.day}`;
    this.phaseLabelEl.textContent = info.phase;
    this.clockLabelEl.textContent = info.formattedTime;
    this.btnSpeed.textContent = `${speedMult}×`;

    const iconKey: IconKey =
      info.phase === 'Night' || info.phase === 'Twilight'
        ? 'moon'
        : info.phase === 'Sunset' || info.phase === 'Dawn'
          ? 'sunset'
          : 'sun';
    if (this.timeIconEl.dataset.key !== iconKey) {
      this.timeIconEl.dataset.key = iconKey;
      this.timeIconEl.innerHTML = getIconSvg(iconKey);
    }
  }

  public updateAudioButtons(muted: boolean, musicOn: boolean): void {
    this.btnSound.textContent = muted ? '🔇' : '🔊';
    this.btnToggleMute.textContent = muted ? '🔇 All Audio: Off' : '🔊 All Audio: On';
    this.btnToggleMute.classList.toggle('active', !muted);
    this.btnToggleMusic.textContent = musicOn ? '🎵 Cozy Music: On' : '🎵 Cozy Music: Off';
    this.btnToggleMusic.classList.toggle('active', musicOn);
  }

  public updateVfxButton(enabled: boolean): void {
    this.btnToggleVfx.textContent = enabled ? '✨ Dreamy Lighting: On' : '✨ Dreamy Lighting: Off';
    this.btnToggleVfx.classList.toggle('active', enabled);
  }

  public syncSensitivity(value: number): void {
    this.inputSensitivity.value = value.toFixed(1);
    this.sensValueEl.textContent = `${value.toFixed(1)}×`;
  }

  public renderHotbar(): void {
    // Update Water level & coins
    const waterPct = Math.round((this.inventory.waterLevel / WATERING_CAN_MAX) * 100);
    this.waterMeterFill.style.width = `${waterPct}%`;
    this.waterMeterText.textContent = `${waterPct}%`;
    this.coinCountEl.textContent = String(this.inventory.coins);

    // Selected item title
    const selId = this.inventory.getSelectedItemId();
    const selDef = ITEMS[selId];
    const selQty = this.inventory.getCount(selId);
    this.selectedItemLabel.textContent =
      selDef.category === 'tool'
        ? selId === 'watering_can'
          ? `${selDef.name} (${waterPct}% Water)`
          : selDef.name
        : `${selDef.name} × ${selQty}`;

    // Build 9 hotbar slots
    this.hotbarEl.innerHTML = '';
    this.inventory.hotbar.forEach((itemId, idx) => {
      const def = ITEMS[itemId];
      const qty = this.inventory.getCount(itemId);
      const isTool = def.category === 'tool';
      const slot = document.createElement('button');
      slot.className = `hotbar-slot${idx === this.inventory.selectedSlot ? ' selected' : ''}${
        !isTool && qty <= 0 ? ' empty-qty' : ''
      }`;
      slot.title = `${def.name} (${idx + 1})`;
      slot.innerHTML = `
        <span class="slot-num">${idx + 1}</span>
        <span class="slot-icon">${getIconSvg(itemId)}</span>
        ${
          itemId === 'watering_can'
            ? `<div class="slot-water-bar"><div class="slot-water-fill" style="width:${waterPct}%"></div></div>`
            : !isTool
              ? `<span class="slot-count">${qty}</span>`
              : ''
        }
      `;
      slot.addEventListener('click', () => this.callbacks.onSelectHotbar(idx));
      this.hotbarEl.appendChild(slot);
    });

    // Live Harvested Crops & Products quick strip above hotbar
    const harvested = this.inventory.getHarvestedSummary().filter((h) => h.count > 0);
    this.harvestStrip.innerHTML = '';
    for (const h of harvested) {
      const chip = document.createElement('div');
      chip.className = 'harvest-chip';
      chip.title = ITEMS[h.id].name;
      chip.innerHTML = `${getIconSvg(h.id)}<span>${h.count}</span>`;
      this.harvestStrip.appendChild(chip);
    }

    if (this.isInventoryOpen) {
      this.renderInventoryModal();
    }
  }

  private renderInventoryModal(): void {
    const supplyIds: ItemId[] = [
      'hoe',
      'watering_can',
      'seed_carrot',
      'seed_radish',
      'seed_tomato',
      'seed_pumpkin',
      'animal_feed',
    ];
    const harvestIds: ItemId[] = [
      'crop_carrot',
      'crop_radish',
      'crop_tomato',
      'crop_pumpkin',
      'prod_egg',
      'prod_milk',
      'prod_wool',
      'prod_truffle',
    ];

    const renderList = (container: HTMLElement, ids: ItemId[]) => {
      container.innerHTML = '';
      for (const id of ids) {
        const def = ITEMS[id];
        const qty = this.inventory.getCount(id);
        const card = document.createElement('button');
        card.className = `inv-item${def.category !== 'tool' && qty === 0 ? ' zero' : ''}`;
        const sub =
          id === 'watering_can'
            ? `${Math.round((this.inventory.waterLevel / WATERING_CAN_MAX) * 100)}% Water`
            : def.category === 'tool'
              ? 'Farm Tool'
              : `Qty: ${qty}`;
        card.innerHTML = `
          <div class="inv-item-icon">${getIconSvg(id)}</div>
          <div>
            <div class="inv-item-name">${def.name}</div>
            <div class="inv-item-qty">${sub}</div>
          </div>
        `;
        card.addEventListener('click', () => {
          this.callbacks.onEquipFromBag(id);
          this.setInventoryOpen(false);
        });
        container.appendChild(card);
      }
    };

    renderList(this.invGridSupplies, supplyIds);
    renderList(this.invGridHarvest, harvestIds);
  }

  public renderTasks(): void {
    const list = this.tasks.getVisibleTasks();
    const doneCount = list.filter((t) => t.completed).length;

    this.taskHeaderTitle.textContent = this.tasks.tutorialCompleted
      ? '🌼 Cozy Farm Goals'
      : '🌱 Farm Welcome Guide';
    this.taskCounter.textContent = `${doneCount}/${list.length}`;

    this.taskListEl.innerHTML = '';
    for (const task of list) {
      const li = document.createElement('li');
      li.className = `task-item${task.completed ? ' done' : ''}`;
      li.innerHTML = `
        <span class="task-check">${task.completed ? '✓' : ''}</span>
        <div>
          <div class="task-title">${task.title}</div>
          ${!task.completed ? `<div class="task-hint">${task.hint}</div>` : ''}
        </div>
      `;
      this.taskListEl.appendChild(li);
    }
  }

  public updateInteraction(info: InteractionInfo | null): void {
    this.crosshairEl.classList.toggle('active', Boolean(info && info.canAct));
    if (!info || this.isMenuVisible || this.isInventoryOpen) {
      this.interactCard.classList.add('hidden');
      return;
    }

    this.interactCard.classList.remove('hidden');
    this.interactIcon.innerHTML = getIconSvg(info.iconId as IconKey);
    this.interactTitle.textContent = info.title;
    this.interactSubtitle.textContent = info.subtitle ?? '';

    if (info.badge) {
      this.interactBadge.className = `status-badge tone-${info.badge.tone}`;
      this.interactBadge.textContent = info.badge.text;
    } else {
      this.interactBadge.className = 'status-badge hidden';
    }

    if (typeof info.progress === 'number') {
      const pct = Math.round(info.progress * 100);
      this.cropProgressWrap.classList.remove('hidden');
      this.cropProgressLabel.textContent = info.progressLabel ?? 'Growth';
      this.cropProgressPct.textContent = `${pct}%`;
      this.cropProgressFill.style.width = `${pct}%`;
    } else {
      this.cropProgressWrap.classList.add('hidden');
    }

    if (typeof info.moisture === 'number') {
      this.moistureWrap.classList.remove('hidden');
      this.moistureFill.style.width = `${Math.round(info.moisture * 100)}%`;
    } else {
      this.moistureWrap.classList.add('hidden');
    }

    this.interactAction.classList.toggle('disabled', !info.canAct);
    this.interactActionText.textContent = info.actionText;

    if (info.hintText) {
      this.interactHint.textContent = info.hintText;
      this.interactHint.classList.remove('hidden');
    } else {
      this.interactHint.classList.add('hidden');
    }
  }

  public showToast(text: string, tone: 'default' | 'success' | 'info' | 'celebrate' = 'default'): void {
    const el = document.createElement('div');
    el.className = `toast tone-${tone}`;
    el.textContent = text;
    this.toastContainer.appendChild(el);

    const life = tone === 'celebrate' ? 4200 : 2800;
    window.setTimeout(() => {
      el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-8px)';
      window.setTimeout(() => el.remove(), 320);
    }, life);
  }
}
