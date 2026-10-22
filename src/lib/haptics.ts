let iosSwitch: HTMLLabelElement | null = null;

/**
 * Light tap on touch devices. Android: Vibration API. iOS Safari has no Vibration API, but toggling a
 * native `<input type="checkbox" switch>` (iOS 18+) plays the system haptic, so a hidden one is clicked.
 * Silent no-op everywhere else, and when the viewer prefers reduced motion.
 */
export function tap(): void {
  if (!matchMedia('(pointer: coarse)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof navigator.vibrate === 'function') { navigator.vibrate(10); return; }
  if (!iosSwitch) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    iosSwitch = document.createElement('label');
    iosSwitch.className = 'sr';
    iosSwitch.setAttribute('aria-hidden', 'true');
    iosSwitch.append(input);
    document.body.append(iosSwitch);
  }
  iosSwitch.click();
}
