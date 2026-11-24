export interface VirtualInputState {
  moveX: number; // -1 (left) .. +1 (right)
  moveY: number; // -1 (backward) .. +1 (forward)
  sprint: boolean;
  brakeOrJumpHeld: boolean;
}

export class MobileControls {
  private container = document.getElementById('mobile-controls')!;
  private joystickEl = document.getElementById('mobile-joystick')!;
  private knobEl = document.getElementById('mobile-joystick-knob')!;
  private btnInteract = document.getElementById('btn-m-interact')!;
  private btnJump = document.getElementById('btn-m-jump')!;
  private btnSprint = document.getElementById('btn-m-sprint')!;
  private btnToggle = document.getElementById('btn-touch')!;

  public enabled = false;
  public state: VirtualInputState = {
    moveX: 0,
    moveY: 0,
    sprint: false,
    brakeOrJumpHeld: false,
  };

  private joyPointerId: number | null = null;
  private joyCenterX = 0;
  private joyCenterY = 0;
  private readonly maxRadius = 46;

  constructor(
    private callbacks: {
      onInteract: () => void;
      onJumpPress: () => void;
    }
  ) {
    const isTouch =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches;
    this.setEnabled(isTouch);
    this.bindEvents();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.container.classList.toggle('hidden', !enabled);
    document.body.classList.toggle('touch-mode', enabled);
    this.btnToggle.classList.toggle('active-touch', enabled);
    if (!enabled) {
      this.resetJoystick();
      this.state.sprint = false;
      this.state.brakeOrJumpHeld = false;
      this.btnSprint.classList.remove('active');
    }
  }

  public setDrivingMode(driving: boolean): void {
    const interactIco = this.btnInteract.querySelector('.m-ico')!;
    const interactLbl = this.btnInteract.querySelector('.m-lbl')!;
    const jumpIco = this.btnJump.querySelector('.m-ico')!;
    const jumpLbl = this.btnJump.querySelector('.m-lbl')!;
    const sprintLbl = this.btnSprint.querySelector('.m-lbl')!;

    if (driving) {
      interactIco.textContent = '🚗';
      interactLbl.textContent = 'Exit';
      jumpIco.textContent = '📯';
      jumpLbl.textContent = 'Horn';
      sprintLbl.textContent = 'Turbo';
    } else {
      interactIco.textContent = '✋';
      interactLbl.textContent = 'Action';
      jumpIco.textContent = '⬆️';
      jumpLbl.textContent = 'Jump';
      sprintLbl.textContent = 'Sprint';
    }
  }

  private resetJoystick(): void {
    this.joyPointerId = null;
    this.state.moveX = 0;
    this.state.moveY = 0;
    this.knobEl.style.transform = 'translate(-50%, -50%)';
  }

  private updateJoystick(clientX: number, clientY: number): void {
    const dx = clientX - this.joyCenterX;
    const dy = clientY - this.joyCenterY;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, this.maxRadius);
    const angle = Math.atan2(dy, dx);
    const ox = Math.cos(angle) * clamped;
    const oy = Math.sin(angle) * clamped;

    this.knobEl.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))`;

    const norm = clamped / this.maxRadius;
    if (norm < 0.14) {
      this.state.moveX = 0;
      this.state.moveY = 0;
    } else {
      this.state.moveX = ox / this.maxRadius;
      this.state.moveY = -oy / this.maxRadius; // Up on screen = +forward!
    }
  }

  private bindEvents(): void {
    this.btnToggle.addEventListener('click', () => {
      this.setEnabled(!this.enabled);
    });

    // Multi-touch virtual joystick
    this.joystickEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = this.joystickEl.getBoundingClientRect();
      this.joyPointerId = e.pointerId;
      this.joyCenterX = rect.left + rect.width * 0.5;
      this.joyCenterY = rect.top + rect.height * 0.5;
      try {
        this.joystickEl.setPointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
      this.updateJoystick(e.clientX, e.clientY);
    });

    this.joystickEl.addEventListener('pointermove', (e) => {
      if (this.joyPointerId !== e.pointerId) return;
      e.preventDefault();
      e.stopPropagation();
      this.updateJoystick(e.clientX, e.clientY);
    });

    const endJoy = (e: PointerEvent) => {
      if (this.joyPointerId !== e.pointerId) return;
      e.stopPropagation();
      try {
        if (this.joystickEl.hasPointerCapture(e.pointerId)) {
          this.joystickEl.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      this.resetJoystick();
    };
    this.joystickEl.addEventListener('pointerup', endJoy);
    this.joystickEl.addEventListener('pointercancel', endJoy);

    // Action / Interact / Fish / Shoot / Enter-Exit Truck button
    this.btnInteract.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.btnInteract.classList.add('pressed');
      this.callbacks.onInteract();
    });
    const endInteract = () => this.btnInteract.classList.remove('pressed');
    this.btnInteract.addEventListener('pointerup', endInteract);
    this.btnInteract.addEventListener('pointercancel', endInteract);

    // Jump / Brake+Horn button
    this.btnJump.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.state.brakeOrJumpHeld = true;
      this.btnJump.classList.add('pressed');
      this.callbacks.onJumpPress();
    });
    const endJump = () => {
      this.state.brakeOrJumpHeld = false;
      this.btnJump.classList.remove('pressed');
    };
    this.btnJump.addEventListener('pointerup', endJump);
    this.btnJump.addEventListener('pointercancel', endJump);

    // Toggleable Sprint / Turbo button (tap once to stay sprinting/boosting!)
    this.btnSprint.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.state.sprint = !this.state.sprint;
      this.btnSprint.classList.toggle('active', this.state.sprint);
    });
  }
}
