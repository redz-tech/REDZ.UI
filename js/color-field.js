// REDZ.UI, colour fields: a text field with data-color-for naming an input type="color" is its hex twin - each follows the
// other as it is typed or picked. A twin that holds no colour - #rgb or #rrggbb, the # optional - is aria-invalid and
// leaves the picker as it was; the picker always sends a colour.
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** The colour picker the text field names, or null. */
const pickerOf = (twin) => {
	const picker = document.getElementById(twin.dataset.colorFor || '');
	return picker instanceof HTMLInputElement && picker.type === 'color' ? picker : null;
};

/** The text fields that are the picker's twins. */
const twinsOf = (picker) => picker.id === '' ? [] : [...document.querySelectorAll('input[data-color-for="' + CSS.escape(picker.id) + '"]')];

/** #rrggbb of a hex the twin holds, or '' when it holds none. */
const hexOf = (value) => {
	const match = HEX.exec(value.trim());
	if (match === null) {
		return '';
	}
	const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join('') : match[1];
	return '#' + digits.toLowerCase();
};

for (const twin of document.querySelectorAll('input[data-color-for]')) {
	const picker = pickerOf(twin);
	if (picker !== null && twin.value === '') {
		twin.value = picker.value;
	}
}

document.addEventListener('input', (event) => {
	const field = event.target;
	if (!(field instanceof HTMLInputElement)) {
		return;
	}
	if (field.type === 'color') {
		for (const twin of twinsOf(field)) {
			twin.value = field.value;
			twin.removeAttribute('aria-invalid');
		}
		return;
	}
	const picker = 'colorFor' in field.dataset ? pickerOf(field) : null;
	if (picker === null) {
		return;
	}
	const hex = hexOf(field.value);
	if (hex === '') {
		field.setAttribute('aria-invalid', 'true');
		return;
	}
	field.removeAttribute('aria-invalid');
	if (picker.value !== hex) {
		picker.value = hex;
		picker.dispatchEvent(new Event('change', {bubbles: true}));
	}
});

document.addEventListener('change', (event) => {
	const field = event.target;
	if (field instanceof HTMLInputElement && 'colorFor' in field.dataset && hexOf(field.value) !== '') {
		field.value = hexOf(field.value);
	}
});
