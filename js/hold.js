// REDZ.UI, who holds a button: busy() and a cooldown each hold a button's aria-disabled while they run. The first to
// take it keeps the state the button had; the last to let go puts that state back, so neither wakes the other's wait.
const holds = new WeakMap();

/** Takes the button's aria-disabled for the holder. */
export const take = (button, holder) => {
	const hold = holds.get(button) ?? {was: button.getAttribute('aria-disabled'), by: new Map()};
	holds.set(button, hold);
	hold.by.set(holder, (hold.by.get(holder) ?? 0) + 1);
	button.setAttribute('aria-disabled', 'true');
};

/** Lets go of the button's aria-disabled for the holder; the last to let go puts the state from before back. */
export const leave = (button, holder) => {
	const hold = holds.get(button);
	const count = hold?.by.get(holder) ?? 0;
	if (count === 0) {
		return;
	}
	if (count > 1) {
		hold.by.set(holder, count - 1);
		return;
	}
	hold.by.delete(holder);
	if (hold.by.size > 0) {
		return;
	}
	holds.delete(button);
	if (hold.was === null) {
		button.removeAttribute('aria-disabled');
	} else {
		button.setAttribute('aria-disabled', hold.was);
	}
};
