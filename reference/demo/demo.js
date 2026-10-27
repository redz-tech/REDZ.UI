(() => {
	const root = document.documentElement;
	const params = new URLSearchParams(location.search);
	const axes = {theme: 'system', dir: 'ltr', density: 'comfortable'};
	const fixed = Object.keys(axes).some((axis) => params.has(axis));
	const read = (key) => {
		try {
			return localStorage.getItem('redz-ui.demo.' + key);
		} catch {
			return null;
		}
	};
	const write = (key, value) => {
		if (fixed) {
			return;
		}
		try {
			localStorage.setItem('redz-ui.demo.' + key, value);
		} catch {
		}
	};
	const state = {};
	for (const axis of Object.keys(axes)) {
		state[axis] = params.get(axis) || read(axis) || axes[axis];
	}
	const mark = (name, value, on) => {
		if (on) {
			root.setAttribute(name, value);
		} else {
			root.removeAttribute(name);
		}
	};
	const paint = () => {
		for (const axis of Object.keys(axes)) {
			document.querySelectorAll('.demo-switch [data-demo-' + axis + ']').forEach((button) => {
				button.setAttribute('aria-pressed', String(button.getAttribute('data-demo-' + axis) === state[axis]));
			});
		}
	};
	const apply = () => {
		mark('data-theme', state.theme, state.theme === 'light' || state.theme === 'dark');
		root.dir = state.dir === 'rtl' ? 'rtl' : 'ltr';
		mark('data-density', 'compact', state.density === 'compact');
		paint();
	};
	apply();
	document.addEventListener('DOMContentLoaded', paint);
	document.addEventListener('click', (event) => {
		const button = event.target.closest('.demo-switch button');
		if (!button) {
			return;
		}
		for (const axis of Object.keys(axes)) {
			const value = button.getAttribute('data-demo-' + axis);
			if (value) {
				state[axis] = value;
				write(axis, value);
			}
		}
		apply();
	});
})();
