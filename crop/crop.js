// REDZ.UI, crop (a package of the release, linked apart): REDZ.ui.crop(file, options) opens a photo full screen, dark,
// to frame it, in one of three modes.
// - paper, unless told: a frame of four corners the library placed on the paper's edges, or around the whole photo
//   when it found none. A corner or an edge is dragged, a loupe above the finger showing what the finger hides; or
//   pressed, and then the spot it goes to is tapped; or moved by the arrow keys, by 10 with Shift. An edge moves across
//   itself. A toggle takes the whole photo or the found frame again. Done straightens the frame into a rectangle - the
//   longer of each pair of opposite edges - read from a copy at most twice its size so small text stays clean; what is
//   transparent in the photo turns white. 600 px, a JPEG at 0.6, unless told.
// - avatar: a circle stands in the middle and the photo moves under it - dragged, zoomed by two fingers, the wheel, a
//   slider or plus and minus, moved by the arrow keys - from the whole photo inside the circle to six times the circle
//   covered. The result is the circle's square: 512 px, a JPEG at 0.85, unless told; outside the photo it is white in a
//   JPEG, clear in a PNG or a WebP.
// - photo: a rectangle over the photo, of options.ratio or free, dragged by its corners and edges, moved by dragging it
//   or by the arrow keys. 1600 px, a JPEG at 0.85, unless told.
// No side of a frame gets shorter than a handle. Rotate turns the photo by 90, Retake calls the page's options.retake,
// Escape cancels. The long side is at most options.max and never enlarged past the photo's own pixels. The promise
// answers {blob, width, height, points}: points are the frame's corners in the photo's own pixels, upright as the photo
// shows, the result's top left first, so a turn is in their order; options.points opens the frame there again. The
// photo is read through an img, which stands it upright by its EXIF, and worked on at most 4096 px. An input
// type="file" with data-crop - "avatar" or "photo" for those modes - opens it on its change, data-crop-ratio,
// data-crop-max, data-crop-quality and data-crop-type its options, and puts the cropped file back into the input, then
// fires redz:crop with the answer and the original file on it; a photo the browser cannot open empties the input and
// says so in a toast.
import {text} from '../js/text.js';

const WORK = 4096;
const DETECT = 256;
const INSET = 24;
const LOUPE = 112;
const ZOOM = 2.5;
// The shortest side a frame keeps on the screen, a handle's size: two corners never sit on one another.
const SIDE = 44;
// The deepest an avatar's photo is zoomed, in times the circle covered.
const DEEP = 6;
const MODES = {
	paper: {max: 600, type: 'image/jpeg', quality: 0.6},
	avatar: {max: 512, type: 'image/jpeg', quality: 0.85},
	photo: {max: 1600, type: 'image/jpeg', quality: 0.85},
};
const WORDS = {
	paper: {title: 'crop.title', hint: 'crop.hint', keys: 'crop.keys', frame: 'crop.frame'},
	avatar: {title: 'crop.avatar.title', hint: 'crop.avatar.hint', keys: 'crop.avatar.keys', frame: 'crop.avatar.frame'},
	photo: {title: 'crop.photo.title', hint: 'crop.photo.hint', keys: 'crop.photo.keys', frame: 'crop.photo.frame'},
};
// The corners clockwise from the top left, then the edges from the top: edge k joins corners k - 4 and k - 3.
const NAMES = ['crop.top_left', 'crop.top_right', 'crop.bottom_right', 'crop.bottom_left', 'crop.top', 'crop.right', 'crop.bottom', 'crop.left'];
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
let made = 0;

/** An element with its attributes and children. */
const make = (tag, attrs = {}, ...children) => {
	const node = document.createElement(tag);
	for (const [name, value] of Object.entries(attrs)) {
		node.setAttribute(name, value);
	}
	node.append(...children);
	return node;
};

/** An SVG element with its attributes. */
const vector = (tag, attrs) => {
	const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
	for (const [name, value] of Object.entries(attrs)) {
		node.setAttribute(name, value);
	}
	return node;
};

const icon = (name) => make('i', {class: 'bi ' + name, 'aria-hidden': 'true'});
const canvasOf = (width, height) => Object.assign(document.createElement('canvas'), {width, height});

/** Gives a canvas's memory back at once: Safari counts a dropped canvas against its cap until it is emptied. */
const release = (canvas) => {
	if (canvas) {
		canvas.width = 0;
		canvas.height = 0;
	}
};

/** The image on a new canvas whose long side is at most max, shrunk by at most half a step so small text stays clean. */
const shrink = (image, max) => {
	let from = image;
	let width = image.naturalWidth || image.width;
	let height = image.naturalHeight || image.height;
	const goal = Math.max(1, Math.floor(max) || 1);
	for (;;) {
		// Each step takes the long side down to the goal or to half of itself, so it ends: a goal between two whole pixels,
		// rounded back up at every step, drew the same canvas without end.
		const long = Math.max(width, height);
		const step = Math.min(long, Math.max(goal, Math.ceil(long / 2))) / long;
		width = Math.max(1, Math.round(width * step));
		height = Math.max(1, Math.round(height * step));
		const to = canvasOf(width, height);
		const context = to.getContext('2d');
		context.imageSmoothingQuality = 'high';
		context.drawImage(from, 0, 0, width, height);
		if (from !== image) {
			release(from);
		}
		from = to;
		if (step === 1 || Math.max(width, height) <= goal) {
			return to;
		}
	}
};

/** The file's photo upright - an img applies its EXIF orientation - on a canvas of at most WORK px, and its own size. */
const load = async (file) => {
	const url = URL.createObjectURL(file);
	try {
		const image = new Image();
		image.src = url;
		await image.decode();
		if (!image.naturalWidth || !image.naturalHeight) {
			throw new RangeError('The image has no size of its own');
		}
		return {photo: shrink(image, WORK), width: image.naturalWidth, height: image.naturalHeight};
	} finally {
		URL.revokeObjectURL(url);
	}
};

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const area = (points) => points.reduce((sum, p, i) => sum + cross([0, 0], p, points[(i + 1) % points.length]), 0) / 2;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const farthest = (points, measure) => points.reduce((best, p) => measure(p) > measure(best) ? p : best);
const copy = (points) => points.map((p) => [...p]);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** Whether four points, clockwise on the screen, make a convex frame. */
const convex = (q) => q.every((p, i) => cross(q[(i + 3) % 4], p, q[(i + 1) % 4]) > 0);

/** The threshold that splits the histogram's two classes best (Otsu). */
const otsu = (histogram, total) => {
	let sum = 0;
	histogram.forEach((count, level) => {
		sum += level * count;
	});
	let below = 0;
	let belowSum = 0;
	let best = 0;
	let cut = 0;
	for (let level = 0; level < 256; level++) {
		below += histogram[level];
		belowSum += level * histogram[level];
		const above = total - below;
		if (below && above) {
			const spread = below * above * (belowSum / below - (sum - belowSum) / above) ** 2;
			if (spread > best) {
				best = spread;
				cut = level;
			}
		}
	}
	return cut;
};

/** The convex hull of the points (Andrew's monotone chain). */
const hullOf = (points) => {
	const half = (list) => {
		const chain = [];
		for (const p of list) {
			while (chain.length > 1 && cross(chain.at(-2), chain.at(-1), p) <= 0) {
				chain.pop();
			}
			chain.push(p);
		}
		chain.pop();
		return chain;
	};
	points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	return [...half(points), ...half([...points].reverse())];
};

/** The hull's four corners, clockwise from the top left: the point farthest from the center, the one farthest from it,
 *  and the farthest on each side of the line between them. */
const cornersOf = (hull, center) => {
	const a = farthest(hull, (p) => distance(p, center));
	const b = farthest(hull, (p) => distance(p, a));
	const quad = [a, farthest(hull, (p) => cross(a, b, p)), b, farthest(hull, (p) => -cross(a, b, p))];
	if (area(quad) < 0) {
		quad.reverse();
	}
	const off = (p) => {
		const turn = Math.atan2(p[1] - center[1], p[0] - center[0]) + 0.75 * Math.PI;
		return -Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn)));
	};
	const start = quad.indexOf(farthest(quad, off));
	return [...quad.slice(start), ...quad.slice(0, start)];
};

/** The paper's four corners in the photo, or null: at 256 px, bright and grey pixels split by Otsu, the largest region
 *  near the center, its hull's corners, kept only when they make a plain sheet. */
const detect = (photo) => {
	const small = shrink(photo, DETECT);
	const {width: w, height: h} = small;
	const rgba = small.getContext('2d').getImageData(0, 0, w, h).data;
	release(small);
	const n = w * h;
	const score = new Uint8Array(n);
	const histogram = new Uint32Array(256);
	for (let i = 0; i < n; i++) {
		const r = rgba[i * 4];
		const g = rgba[i * 4 + 1];
		const b = rgba[i * 4 + 2];
		const s = Math.max(0, ((r * 77 + g * 150 + b * 29) >> 8) - Math.max(r, g, b) + Math.min(r, g, b));
		score[i] = s;
		histogram[s]++;
	}
	const cut = otsu(histogram, n);
	const region = new Int32Array(n);
	const stack = new Int32Array(n);
	let best = 0;
	let weight = 0;
	let count = 0;
	let center = null;
	for (let start = 0, id = 1; start < n; start++) {
		if (score[start] <= cut || region[start]) {
			continue;
		}
		let top = 0;
		let size = 0;
		let sx = 0;
		let sy = 0;
		stack[top++] = start;
		region[start] = id;
		while (top) {
			const p = stack[--top];
			const x = p % w;
			const y = (p - x) / w;
			size++;
			sx += x;
			sy += y;
			for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
				if (q >= 0 && score[q] > cut && !region[q]) {
					region[q] = id;
					stack[top++] = q;
				}
			}
		}
		const middle = [sx / size + 0.5, sy / size + 0.5];
		const near = size * (1 - distance(middle, [w / 2, h / 2]) / Math.hypot(w / 2, h / 2));
		if (near > weight) {
			[best, weight, count, center] = [id, near, size, middle];
		}
		id++;
	}
	if (!best) {
		return null;
	}
	const outline = [];
	for (let y = 0; y < h; y++) {
		let first = -1;
		let last = -1;
		for (let x = 0; x < w; x++) {
			if (region[y * w + x] === best) {
				first = first < 0 ? x : first;
				last = x;
			}
		}
		if (first >= 0) {
			outline.push([first, y + 0.5], [last + 1, y + 0.5]);
		}
	}
	for (let x = 0; x < w; x++) {
		let first = -1;
		let last = -1;
		for (let y = 0; y < h; y++) {
			if (region[y * w + x] === best) {
				first = first < 0 ? y : first;
				last = y;
			}
		}
		if (first >= 0) {
			outline.push([x + 0.5, first], [x + 0.5, last + 1]);
		}
	}
	const hull = hullOf(outline);
	const quad = cornersOf(hull, center);
	const size = area(quad);
	const square = quad.every((p, i) => {
		const a = quad[(i + 3) % 4];
		const b = quad[(i + 1) % 4];
		const angle = Math.acos(((a[0] - p[0]) * (b[0] - p[0]) + (a[1] - p[1]) * (b[1] - p[1])) / (distance(a, p) * distance(b, p))) * 180 / Math.PI;
		return angle > 40 && angle < 140;
	});
	if (!square || size < 0.2 * n || size > 0.95 * n || Math.abs(area(hull)) > 1.1 * size || count < 0.6 * size) {
		return null;
	}
	return quad.map(([x, y]) => [x * photo.width / w, y * photo.height / h]);
};

/** The homography that maps the unit square onto the quad (Heckbert's square to quad): [a, b, c, d, e, f, g, h]. */
const squareToQuad = ([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) => {
	const dx1 = x1 - x2;
	const dx2 = x3 - x2;
	const dx3 = x0 - x1 + x2 - x3;
	const dy1 = y1 - y2;
	const dy2 = y3 - y2;
	const dy3 = y0 - y1 + y2 - y3;
	const det = dx1 * dy2 - dx2 * dy1;
	const g = (dx3 * dy2 - dx2 * dy3) / det;
	const h = (dx1 * dy3 - dx3 * dy1) / det;
	return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h];
};

/** The quad of the photo straightened onto a width by height canvas: each pixel mapped back into the photo, one division
 *  per pixel, and read between its four neighbours. */
const warp = (photo, quad, width, height) => {
	const left = clamp(Math.floor(Math.min(...quad.map((p) => p[0]))), 0, photo.width - 1);
	const top = clamp(Math.floor(Math.min(...quad.map((p) => p[1]))), 0, photo.height - 1);
	const sw = clamp(Math.ceil(Math.max(...quad.map((p) => p[0]))), left + 1, photo.width) - left;
	const sh = clamp(Math.ceil(Math.max(...quad.map((p) => p[1]))), top + 1, photo.height) - top;
	const source = photo.getContext('2d').getImageData(left, top, sw, sh).data;
	const [a, b, c, d, e, f, g, h] = squareToQuad(quad.map(([x, y]) => [x - left, y - top]));
	const out = canvasOf(width, height);
	const context = out.getContext('2d');
	const image = context.createImageData(width, height);
	const target = image.data;
	const du = 1 / width;
	const maxX = sw - 1;
	const maxY = sh - 1;
	const row = sw * 4;
	const value = [0, 0, 0, 0];
	let o = 0;
	for (let j = 0; j < height; j++) {
		const v = (j + 0.5) / height;
		let X = a * du / 2 + b * v + c;
		let Y = d * du / 2 + e * v + f;
		let Z = g * du / 2 + h * v + 1;
		for (let i = 0; i < width; i++, X += a * du, Y += d * du, Z += g * du, o += 4) {
			const x = clamp(X / Z - 0.5, 0, maxX);
			const y = clamp(Y / Z - 0.5, 0, maxY);
			const x0 = x | 0;
			const y0 = y | 0;
			const fx = x - x0;
			const fy = y - y0;
			const p = y0 * row + x0 * 4;
			const right = x0 < maxX ? 4 : 0;
			const down = y0 < maxY ? row : 0;
			for (let k = 0; k < 4; k++) {
				const upper = source[p + k] + (source[p + right + k] - source[p + k]) * fx;
				const lower = source[p + down + k] + (source[p + down + right + k] - source[p + down + k]) * fx;
				value[k] = upper + (lower - upper) * fy;
			}
			// What is clear in the photo lies on white: a paper is never see-through.
			const opaque = value[3] / 255;
			target[o] = value[0] * opaque + 255 - value[3];
			target[o + 1] = value[1] * opaque + 255 - value[3];
			target[o + 2] = value[2] * opaque + 255 - value[3];
			target[o + 3] = 255;
		}
	}
	context.putImageData(image, 0, 0);
	return out;
};

/** The result's size: the longer of each pair of opposite edges, the long side at most max and never enlarged. */
const sizeOf = (q, max) => {
	const width = Math.max(distance(q[0], q[1]), distance(q[3], q[2]));
	const height = Math.max(distance(q[0], q[3]), distance(q[1], q[2]));
	const k = Math.min(1, max / Math.max(width, height));
	return [Math.max(1, Math.round(width * k)), Math.max(1, Math.round(height * k))];
};

/** A point of a photo turned by 90 degrees clockwise, the turned photo's width given, back on the photo before the turn. */
const unturn = ([x, y], width) => [y, width - x];

/** A ratio given as a number or as "4/3", "4:3" or "1.5"; 0, free, for anything else. */
const ratioOf = (value) => {
	const [a, b = 1] = String(value ?? '').split(/[/:]/).map(Number);
	const ratio = a / b;
	return Number.isFinite(ratio) && ratio > 0 ? ratio : 0;
};

/** A rectangle's box from its corners, and the corners of a box, clockwise from the top left. */
const boxOf = (q) => ({x: q[0][0], y: q[0][1], w: q[2][0] - q[0][0], h: q[2][1] - q[0][1]});
const rectOf = ({x, y, w, h}) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

/** Opens the file's photo to frame - a paper, an avatar or a photo; answers {blob, width, height, points}, or null when
 *  cancelled. */
export const crop = (file, options = {}) => new Promise((resolve, reject) => {
	const kind = Object.hasOwn(MODES, options.mode) ? options.mode : 'paper';
	const paper = kind === 'paper';
	const {max, type, quality} = {...MODES[kind], ...Object.fromEntries(Object.entries(options).filter(([name, value]) => name in MODES.paper && value !== undefined && value !== null))};
	const ratio = kind === 'avatar' ? 1 : kind === 'photo' ? ratioOf(options.ratio) : 0;
	const label = WORDS[kind];
	const retake = typeof options.retake === 'function' ? options.retake : null;
	const opener = document.activeElement;
	const id = 'redz-crop-' + ++made;
	let work = null;
	let view = null;
	let found = null;
	let points = null;
	let mode = 'whole';
	let scale = 1;
	let left = 0;
	let top = 0;
	let armed = -1;
	let drag = null;
	let dragged = false;
	let working = false;
	let closed = false;
	let later = 0;
	let toggled = '';
	let turns = 0;
	// The photo's own size over the size worked on.
	let own = 1;
	// An avatar's circle on the screen, and the pointers on it.
	let frame = {x: 0, y: 0, w: 1, h: 1};
	const pointers = new Map();

	const button = (kind, name, label) => make('button', {class: 'btn ' + kind, type: 'button'}, icon(name), label);
	const cancel = make('button', {class: 'btn btn-icon btn-text', type: 'button', 'aria-label': text('crop.cancel')}, icon('bi-x-lg'));
	const dim = vector('path', {class: 'crop-dim'});
	const line = vector('path', {class: 'crop-line'});
	const shade = vector('svg', {class: 'crop-shade', 'aria-hidden': 'true'});
	shade.append(dim, line);
	const handles = kind === 'avatar' ? [] : NAMES.map((name, i) => make('button', {class: 'crop-handle', type: 'button', 'aria-label': text(name), 'aria-pressed': 'false', 'data-index': i, ...(i > 3 ? {'data-edge': ''} : {})}));
	const mover = kind === 'photo' ? make('button', {class: 'crop-move', type: 'button', 'aria-label': text(label.frame)}) : null;
	const layer = make('div', {class: 'crop-handles', role: 'application', 'aria-label': text(label.frame), 'aria-describedby': id + '-keys', ...(kind === 'avatar' ? {tabindex: '0', 'data-pan': ''} : {})}, ...[mover, ...handles].filter(Boolean));
	const loupe = paper ? make('canvas', {class: 'crop-loupe', 'aria-hidden': 'true', hidden: ''}) : null;
	const wait = make('div', {class: 'crop-wait'}, make('span', {class: 'spinner-border', 'aria-hidden': 'true'}));
	const stage = make('div', {class: 'crop-stage'}, ...[wait, shade, layer, loupe].filter(Boolean));
	const range = kind === 'avatar' ? make('input', {class: 'form-range', type: 'range', min: '0', max: '1000', step: '1', 'aria-label': text('crop.zoom')}) : null;
	const smaller = range ? make('button', {class: 'btn btn-icon btn-text', type: 'button', 'aria-label': text('crop.zoom_out')}, icon('bi-zoom-out')) : null;
	const larger = range ? make('button', {class: 'btn btn-icon btn-text', type: 'button', 'aria-label': text('crop.zoom_in')}, icon('bi-zoom-in')) : null;
	const again = retake ? button('btn-text', 'bi-camera', text('crop.retake')) : null;
	const rotate = button('btn-text', 'bi-arrow-clockwise', text('crop.rotate'));
	const toggle = paper ? button('btn-text', 'bi-fullscreen', text('crop.whole')) : null;
	const done = button('btn-primary', 'bi-check-lg', text('crop.done'));
	const live = make('p', {class: 'visually-hidden', 'aria-live': 'polite'});
	const dialog = make('dialog', {class: 'crop', 'data-mode': kind, 'aria-labelledby': id + '-title', 'aria-describedby': id + '-hint'},
		make('div', {class: 'crop-head'}, cancel, make('h2', {class: 'crop-title', id: id + '-title'}, text(label.title)), make('p', {class: 'crop-hint', id: id + '-hint'}, text(label.hint))),
		stage,
		make('p', {class: 'visually-hidden', id: id + '-keys'}, text(label.keys)),
		make('div', {class: 'crop-bar'}, ...[again, rotate, toggle, range && make('div', {class: 'crop-zoom'}, smaller, range, larger), done].filter(Boolean)),
		live);

	const say = (words) => {
		live.textContent = words;
	};
	const sayLater = (words) => {
		clearTimeout(later);
		later = setTimeout(() => say(words()), 500);
	};
	const whole = () => [[0, 0], [work.width, 0], [work.width, work.height], [0, work.height]];
	const at = (p) => [left + p[0] * scale, top + p[1] * scale];
	const spot = (i) => i < 4 ? points[i] : points[i - 4].map((v, k) => (v + points[(i - 3) % 4][k]) / 2);
	const where = (i) => text('crop.at', {name: text(NAMES[i]), x: Math.round(spot(i)[0] / work.width * 100), y: Math.round(spot(i)[1] / work.height * 100)});
	const placed = () => text('crop.at', {name: text(label.frame), x: Math.round(points[0][0] / work.width * 100), y: Math.round(points[0][1] / work.height * 100)});

	// An avatar's frame on the photo: the widest inside it, the narrowest holding it whole, a sixth of the widest at most deep.
	const cover = () => Math.min(work.width, work.height * ratio);
	const contain = () => Math.max(work.width, work.height * ratio);
	const zoomed = () => text('crop.zoomed', {n: Math.round(cover() / boxOf(points).w * 100)});

	/** An avatar's frame held to its zooms and on the photo, or around it when it is wider than the photo. */
	const held = ({x, y, w}) => {
		const width = clamp(w, cover() / DEEP, contain());
		const along = (at, size, room) => clamp(at, Math.min(0, room - size), Math.max(0, room - size));
		return {x: along(x, width, work.width), y: along(y, width / ratio, work.height), w: width, h: width / ratio};
	};

	/** A rectangle of the ratio as large as the photo holds, in its middle; the whole photo when the ratio is free. */
	const fitted = () => {
		const w = ratio ? cover() : work.width;
		const h = ratio ? w / ratio : work.height;
		return rectOf({x: (work.width - w) / 2, y: (work.height - h) / 2, w, h});
	};

	const draw = () => {
		if (kind === 'avatar') {
			const b = boxOf(points);
			scale = frame.w / b.w;
			left = frame.x - b.x * scale;
			top = frame.y - b.y * scale;
			view.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
			const r = frame.w / 2;
			const circle = `M${frame.x} ${frame.y + r}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
			dim.setAttribute('d', `M0 0H${stage.clientWidth}V${stage.clientHeight}H0Z${circle}`);
			line.setAttribute('d', circle);
			range.value = String(Math.round(Math.log(contain() / b.w) / Math.log(contain() * DEEP / cover()) * 1000));
			range.setAttribute('aria-valuetext', zoomed());
			return;
		}
		const screen = points.map(at);
		const path = 'M' + screen.map((p) => p.join(' ')).join('L') + 'Z';
		dim.setAttribute('d', `M${left} ${top}h${work.width * scale}v${work.height * scale}h${-work.width * scale}Z${path}`);
		line.setAttribute('d', path);
		handles.forEach((handle, i) => {
			const [x, y] = at(spot(i));
			handle.style.translate = `${x}px ${y}px`;
			if (i > 3) {
				const [a, b] = [screen[i - 4], screen[(i - 3) % 4]];
				handle.style.setProperty('--crop-turn', Math.atan2(b[1] - a[1], b[0] - a[0]) + 'rad');
				// An edge's handle gives way to its corners on a short side.
				handle.toggleAttribute('data-short', distance(a, b) < 2 * SIDE);
			}
		});
		if (mover) {
			Object.assign(mover.style, {translate: `${screen[0][0]}px ${screen[0][1]}px`, width: screen[2][0] - screen[0][0] + 'px', height: screen[2][1] - screen[0][1] + 'px'});
		}
		if (toggle && (mode === 'whole') !== (toggled === 'whole')) {
			toggle.replaceChildren(icon(mode === 'whole' ? 'bi-magic' : 'bi-fullscreen'), text(mode === 'whole' ? 'crop.auto' : 'crop.whole'));
		}
		toggled = mode;
	};

	/** Fits the photo in the stage, inset so a handle and the screen's edge gestures stay apart, drawn small in halving
	 *  steps; an avatar's circle in the middle, over the photo worked on, which a transform moves and zooms. */
	const fit = () => {
		const {clientWidth: width, clientHeight: height} = stage;
		if (width <= 2 * INSET || height <= 2 * INSET) {
			return;
		}
		shade.setAttribute('viewBox', `0 0 ${width} ${height}`);
		if (kind === 'avatar') {
			const w = Math.min(width - 2 * INSET, (height - 2 * INSET) * ratio);
			frame = {x: (width - w) / 2, y: (height - w / ratio) / 2, w, h: w / ratio};
			if (view !== work) {
				work.className = 'crop-photo';
				work.style.width = work.width + 'px';
				work.style.height = work.height + 'px';
				if (view) {
					view.replaceWith(work);
				} else {
					stage.prepend(work);
				}
				view = work;
			}
			draw();
			return;
		}
		scale = Math.min((width - 2 * INSET) / work.width, (height - 2 * INSET) / work.height);
		left = (width - work.width * scale) / 2;
		top = (height - work.height * scale) / 2;
		const next = shrink(work, Math.max(work.width, work.height) * scale * devicePixelRatio);
		next.className = 'crop-photo';
		next.style.width = work.width * scale + 'px';
		next.style.height = work.height * scale + 'px';
		next.style.translate = `${left}px ${top}px`;
		if (view) {
			view.replaceWith(next);
		} else {
			stage.prepend(next);
		}
		release(view);
		view = next;
		draw();
	};

	/** A paper's frame with handle i moved by dx, dy px of the photo - an edge across itself -, or null when it would not
	 *  stay convex or a side would be shorter than a handle on the screen. */
	const moved = (from, i, dx, dy) => {
		const q = copy(from);
		const ends = i < 4 ? [i] : [i - 4, (i - 3) % 4];
		if (i > 3) {
			const [a, b] = ends.map((k) => q[k]);
			const length = distance(a, b) || 1;
			const across = (dx * (a[1] - b[1]) + dy * (b[0] - a[0])) / length;
			dx = across * (a[1] - b[1]) / length;
			dy = across * (b[0] - a[0]) / length;
		}
		for (const k of ends) {
			q[k] = [clamp(q[k][0] + dx, 0, work.width), clamp(q[k][1] + dy, 0, work.height)];
		}
		return convex(q) && q.every((p, k) => distance(p, q[(k + 1) % 4]) * scale >= SIDE) ? q : null;
	};

	/** A photo's frame with handle i moved by dx, dy px of the photo against the side or corner across from it, a ratio
	 *  kept about the middle of the other way; on the photo, no side shorter than a handle, or null. */
	const resized = (from, i, dx, dy) => {
		const b = boxOf(from);
		const least = SIDE / scale;
		// How each way moves: -1 its start, 1 its end, 0 neither.
		const sx = [-1, 1, 1, -1, 0, 1, 0, -1][i];
		const sy = [-1, -1, 1, 1, -1, 0, 1, 0][i];
		let [x0, y0, x1, y1] = [b.x, b.y, b.x + b.w, b.y + b.h];
		x0 = sx < 0 ? clamp(x0 + dx, 0, x1 - least) : x0;
		x1 = sx > 0 ? clamp(x1 + dx, x0 + least, work.width) : x1;
		y0 = sy < 0 ? clamp(y0 + dy, 0, y1 - least) : y0;
		y1 = sy > 0 ? clamp(y1 + dy, y0 + least, work.height) : y1;
		if (!ratio) {
			return rectOf({x: x0, y: y0, w: x1 - x0, h: y1 - y0});
		}
		const ax = sx < 0 ? x1 : sx > 0 ? x0 : (x0 + x1) / 2;
		const ay = sy < 0 ? y1 : sy > 0 ? y0 : (y0 + y1) / 2;
		const room = (a, s, size) => s < 0 ? a : s > 0 ? size - a : 2 * Math.min(a, size - a);
		const most = Math.min(room(ax, sx, work.width), room(ay, sy, work.height) * ratio);
		const fewest = least * Math.max(1, ratio);
		if (most < fewest) {
			return null;
		}
		const w = clamp(sx && sy ? Math.max(x1 - x0, (y1 - y0) * ratio) : sx ? x1 - x0 : (y1 - y0) * ratio, fewest, most);
		const h = w / ratio;
		return rectOf({x: sx < 0 ? ax - w : sx > 0 ? ax : ax - w / 2, y: sy < 0 ? ay - h : sy > 0 ? ay : ay - h / 2, w, h});
	};
	const moveHandle = (from, i, dx, dy) => paper ? moved(from, i, dx, dy) : resized(from, i, dx, dy);

	/** A photo's frame moved whole by dx, dy px of the photo, on the photo. */
	const shifted = (from, dx, dy) => {
		const b = boxOf(from);
		return rectOf({...b, x: clamp(b.x + dx, 0, work.width - b.w), y: clamp(b.y + dy, 0, work.height - b.h)});
	};

	/** A rectangle's frame from four points: their box, of the ratio about its middle, on the photo. */
	const settle = (q) => {
		const xs = q.map((p) => p[0]);
		const ys = q.map((p) => p[1]);
		let b = {x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys)};
		if (kind === 'avatar') {
			return rectOf(held(b));
		}
		if (ratio) {
			const w = Math.min(b.w, b.h * ratio);
			b = {x: b.x + (b.w - w) / 2, y: b.y + (b.h - w / ratio) / 2, w, h: w / ratio};
		}
		return b.w > work.width || b.h > work.height ? fitted() : rectOf({...b, x: clamp(b.x, 0, work.width - b.w), y: clamp(b.y, 0, work.height - b.h)});
	};

	/** An avatar's photo zoomed to a frame w px of the photo wide, the spot cx, cy of the stage staying where it is. */
	const zoomTo = (w, cx, cy) => {
		const b = boxOf(points);
		const x = b.x + (cx - frame.x) / scale;
		const y = b.y + (cy - frame.y) / scale;
		const width = clamp(w, cover() / DEEP, contain());
		const k = frame.w / width;
		points = rectOf(held({x: x - (cx - frame.x) / k, y: y - (cy - frame.y) / k, w: width}));
		draw();
	};
	const panBy = (dx, dy) => {
		const b = boxOf(points);
		points = rectOf(held({x: b.x - dx / scale, y: b.y - dy / scale, w: b.w}));
		draw();
	};
	const middle = () => [frame.x + frame.w / 2, frame.y + frame.h / 2];

	const place = (q) => {
		if (q) {
			points = q;
			mode = 'own';
			draw();
		}
	};

	const arm = (i) => {
		armed = i;
		handles.forEach((handle, k) => handle.setAttribute('aria-pressed', String(k === i)));
		stage.toggleAttribute('data-armed', i >= 0);
	};

	/** The loupe over handle i: above the finger, or beside it at the top edge. */
	const magnify = (i) => {
		const ratio = devicePixelRatio;
		const size = Math.round(LOUPE * ratio);
		if (loupe.width !== size) {
			loupe.width = loupe.height = size;
		}
		const p = spot(i);
		const [x, y] = at(p);
		let lx = x;
		let ly = y - LOUPE;
		if (ly < LOUPE / 2 + 4) {
			ly = Math.max(y, LOUPE / 2 + 4);
			lx = x + (x < stage.clientWidth / 2 ? LOUPE : -LOUPE);
		}
		loupe.style.translate = `${lx - LOUPE / 2}px ${ly - LOUPE / 2}px`;
		loupe.hidden = false;
		const context = loupe.getContext('2d');
		const m = ZOOM * scale * ratio;
		const c = size / 2;
		const r = c / m;
		const [x0, y0] = [Math.max(0, p[0] - r), Math.max(0, p[1] - r)];
		const [x1, y1] = [Math.min(work.width, p[0] + r), Math.min(work.height, p[1] + r)];
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.fillStyle = '#000';
		context.fillRect(0, 0, size, size);
		context.imageSmoothingQuality = 'high';
		context.drawImage(work, x0, y0, x1 - x0, y1 - y0, c + (x0 - p[0]) * m, c + (y0 - p[1]) * m, (x1 - x0) * m, (y1 - y0) * m);
		context.setTransform(m, 0, 0, m, c - p[0] * m, c - p[1] * m);
		context.beginPath();
		points.forEach(([px, py]) => context.lineTo(px, py));
		context.closePath();
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.lineWidth = 2 * ratio;
		context.strokeStyle = '#fff';
		context.stroke();
		for (const [color, thick] of [['#000', 3], ['#fff', 1.5]]) {
			context.beginPath();
			context.arc(c, c, 6 * ratio, 0, 2 * Math.PI);
			context.lineWidth = thick * ratio;
			context.strokeStyle = color;
			context.stroke();
		}
	};

	/** Turns the photo and its frames by 90 degrees clockwise. */
	const turn = () => {
		const {width, height} = work;
		const next = canvasOf(height, width);
		const context = next.getContext('2d');
		context.setTransform(0, 1, -1, 0, height, 0);
		context.drawImage(work, 0, 0);
		release(work);
		work = next;
		const spin = (q) => q && [q[3], q[0], q[1], q[2]].map(([x, y]) => [height - y, x]);
		points = spin(points);
		found = spin(found);
		turns = (turns + 1) % 4;
		arm(-1);
	};

	/** The frame in the photo's own pixels as it came, the result's top left first. */
	const ownPoints = () => {
		const [width, height] = turns % 2 === 0 ? [work.width, work.height] : [work.height, work.width];
		return points.map((p) => {
			let q = p;
			for (let k = turns; k > 0; k--) {
				q = unturn(q, k % 2 === 0 ? width : height);
			}
			return q.map((v) => Math.round(v * own * 10) / 10);
		});
	};

	const settled = () => new Promise((go) => requestAnimationFrame(() => setTimeout(go)));
	const written = async (out, width, height) => {
		const blob = await new Promise((go) => out.toBlob(go, type, quality));
		release(out);
		// A browser that writes no WebP gives a PNG, which keeps what is clear as a WebP would.
		if (blob?.type !== type && !(type === 'image/webp' && blob?.type === 'image/png')) {
			throw new Error(text('crop.failed'));
		}
		return {blob, width, height, points: ownPoints()};
	};

	/** A paper's frame straightened into the asked type. */
	const straighten = async () => {
		await settled();
		const [width, height] = sizeOf(points, max);
		const long = Math.max(distance(points[0], points[1]), distance(points[3], points[2]), distance(points[0], points[3]), distance(points[1], points[2]));
		// Read from a copy at most twice the result's size: one step of bilinear reading further down smears small text.
		const k = Math.min(1, 2 * Math.max(width, height) / long);
		const source = k < 1 ? shrink(work, Math.max(work.width, work.height) * k) : work;
		const fx = source.width / work.width;
		const fy = source.height / work.height;
		const out = warp(source, points.map(([x, y]) => [x * fx, y * fy]), width, height);
		if (source !== work) {
			release(source);
		}
		return written(out, width, height);
	};

	/** An avatar's or a photo's frame cut out as it shows, white under a JPEG where the photo is clear or absent. */
	const cut = async () => {
		await settled();
		const {x, y, w, h} = boxOf(points);
		// The result's pixels per pixel worked on: its long side at most max, never past the photo's own pixels.
		const k = Math.min(1, max / (Math.max(w, h) * own)) * own;
		const goal = Math.max(1, Math.round(Math.max(w, h) * k));
		// Drawn at the result's size when that is not smaller than the frame; else at most twice it, then halved down.
		const m = Math.max(k, Math.min(1, 2 * goal / Math.max(w, h)));
		let out = canvasOf(Math.max(1, Math.round(w * m)), Math.max(1, Math.round(h * m)));
		const context = out.getContext('2d');
		if (type === 'image/jpeg') {
			context.fillStyle = '#fff';
			context.fillRect(0, 0, out.width, out.height);
		}
		context.imageSmoothingQuality = 'high';
		context.setTransform(m, 0, 0, m, -x * m, -y * m);
		context.drawImage(work, 0, 0);
		if (m > k) {
			const big = out;
			out = shrink(big, goal);
			release(big);
		}
		return written(out, out.width, out.height);
	};

	const shut = () => {
		if (closed) {
			return false;
		}
		closed = true;
		clearTimeout(later);
		observer.disconnect();
		dialog.close();
		dialog.remove();
		release(work);
		release(view);
		release(loupe);
		if (opener?.isConnected) {
			opener.focus({preventScroll: true});
		}
		return true;
	};

	const finish = (result) => {
		if (shut()) {
			resolve(result);
		}
	};

	const local = (event) => {
		const box = stage.getBoundingClientRect();
		return [event.clientX - box.left, event.clientY - box.top];
	};

	layer.addEventListener('pointerdown', (event) => {
		if (event.button !== 0 || working || !work) {
			return;
		}
		if (kind === 'avatar') {
			layer.setPointerCapture(event.pointerId);
			pointers.set(event.pointerId, local(event));
			return;
		}
		const handle = event.target.closest('.crop-handle, .crop-move');
		if (!handle || drag) {
			return;
		}
		handle.setPointerCapture(event.pointerId);
		handle.focus({preventScroll: true});
		dragged = false;
		drag = {i: handle === mover ? -1 : +handle.dataset.index, id: event.pointerId, x: event.clientX, y: event.clientY, from: copy(points)};
	});

	layer.addEventListener('pointermove', (event) => {
		if (kind === 'avatar') {
			const was = pointers.get(event.pointerId);
			if (!was) {
				return;
			}
			const now = local(event);
			pointers.set(event.pointerId, now);
			const other = [...pointers].find(([key]) => key !== event.pointerId)?.[1];
			if (!other) {
				panBy(now[0] - was[0], now[1] - was[1]);
				return;
			}
			// Two fingers: the photo follows their middle and zooms by their spread about it.
			panBy((now[0] - was[0]) / 2, (now[1] - was[1]) / 2);
			const before = distance(was, other);
			const after = distance(now, other);
			if (before > 0 && after > 0) {
				zoomTo(boxOf(points).w * before / after, (now[0] + other[0]) / 2, (now[1] + other[1]) / 2);
			}
			return;
		}
		if (drag?.id !== event.pointerId) {
			return;
		}
		const dx = event.clientX - drag.x;
		const dy = event.clientY - drag.y;
		if (!dragged && Math.hypot(dx, dy) < 4) {
			return;
		}
		dragged = true;
		arm(-1);
		if (drag.i < 0) {
			place(shifted(drag.from, dx / scale, dy / scale));
			return;
		}
		place(moveHandle(drag.from, drag.i, dx / scale, dy / scale));
		if (paper) {
			magnify(drag.i);
		}
	});

	const drop = (event) => {
		if (kind === 'avatar') {
			if (pointers.size > 1 && pointers.delete(event.pointerId)) {
				sayLater(zoomed);
			}
			pointers.delete(event.pointerId);
			return;
		}
		if (drag?.id !== event.pointerId) {
			return;
		}
		const {i} = drag;
		drag = null;
		if (loupe) {
			loupe.hidden = true;
		}
		if (dragged) {
			say(i < 0 ? placed() : where(i));
		}
	};
	for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
		layer.addEventListener(name, drop);
	}

	layer.addEventListener('wheel', (event) => {
		if (kind !== 'avatar' || !work || working) {
			return;
		}
		event.preventDefault();
		const [x, y] = local(event);
		const delta = event.deltaY * [1, 16, 400][event.deltaMode];
		zoomTo(boxOf(points).w * Math.exp(delta * (event.ctrlKey ? 0.01 : 0.002)), x, y);
		sayLater(zoomed);
	}, {passive: false});

	layer.addEventListener('click', (event) => {
		const handle = event.target.closest('.crop-handle');
		if (!handle || working || (event.detail && dragged)) {
			return;
		}
		const i = +handle.dataset.index;
		arm(armed === i ? -1 : i);
		if (armed === i) {
			say(text('crop.picked', {name: text(NAMES[i])}));
		}
	});

	stage.addEventListener('click', (event) => {
		if (armed < 0 || event.target.closest('.crop-handle')) {
			return;
		}
		const [sx, sy] = spot(armed);
		const [x, y] = local(event);
		const i = armed;
		arm(-1);
		place(moveHandle(points, i, clamp((x - left) / scale, 0, work.width) - sx, clamp((y - top) / scale, 0, work.height) - sy));
		say(where(i));
	});

	layer.addEventListener('keydown', (event) => {
		const by = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
		if (working || !work) {
			return;
		}
		if (kind === 'avatar') {
			const zoom = {'+': 1 / 1.1, '=': 1 / 1.1, '-': 1.1, '_': 1.1}[event.key];
			if (by) {
				event.preventDefault();
				panBy(by[0] * (event.shiftKey ? 10 : 1), by[1] * (event.shiftKey ? 10 : 1));
			} else if (zoom) {
				event.preventDefault();
				zoomTo(boxOf(points).w * zoom, ...middle());
				sayLater(zoomed);
			}
			return;
		}
		const handle = event.target.closest('.crop-handle, .crop-move');
		if (!handle || !by) {
			return;
		}
		event.preventDefault();
		const step = (event.shiftKey ? 10 : 1) / scale;
		if (handle === mover) {
			place(shifted(points, by[0] * step, by[1] * step));
			sayLater(placed);
			return;
		}
		const i = +handle.dataset.index;
		place(moveHandle(points, i, by[0] * step, by[1] * step));
		sayLater(() => where(i));
	});

	range?.addEventListener('input', () => {
		if (work) {
			zoomTo(contain() / (contain() * DEEP / cover()) ** (Number(range.value) / 1000), ...middle());
		}
	});
	for (const [control, by] of [[smaller, 1.25], [larger, 1 / 1.25]]) {
		control?.addEventListener('click', () => {
			if (work && !working) {
				zoomTo(boxOf(points).w * by, ...middle());
				sayLater(zoomed);
			}
		});
	}

	dialog.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			if (armed >= 0) {
				arm(-1);
			} else {
				finish(null);
			}
		}
	});
	dialog.addEventListener('cancel', (event) => {
		event.preventDefault();
		finish(null);
	});
	cancel.addEventListener('click', () => finish(null));
	again?.addEventListener('click', () => {
		finish(null);
		retake();
	});
	rotate.addEventListener('click', () => {
		if (!work || working) {
			return;
		}
		turn();
		// A frame of a ratio stays of it: an avatar's square on the turned photo, a photo's as large as it holds.
		if (kind === 'avatar') {
			points = rectOf(held(boxOf(points)));
		} else if (ratio) {
			points = fitted();
		}
		fit();
		say(text('crop.turned'));
	});
	toggle?.addEventListener('click', () => {
		if (!work || working) {
			return;
		}
		if (mode !== 'whole') {
			[points, mode] = [whole(), 'whole'];
			say(text('crop.all'));
		} else if (found) {
			[points, mode] = [copy(found), 'auto'];
			say(text('crop.found'));
		} else {
			say(text('crop.none'));
		}
		arm(-1);
		draw();
	});
	done.addEventListener('click', () => {
		if (!work || working) {
			return;
		}
		working = true;
		globalThis.REDZ.ui.busy(done, paper ? straighten() : cut()).then(finish, (error) => {
			working = false;
			globalThis.REDZ.ui.toast({text: error.message, tone: 'danger'});
		});
	});

	const observer = new ResizeObserver(() => work && fit());
	observer.observe(stage);
	document.body.append(dialog);
	dialog.showModal();

	load(file).then(({photo, width}) => {
		if (closed) {
			release(photo);
			return;
		}
		work = photo;
		own = width / work.width;
		found = paper ? detect(work) : null;
		const given = Array.isArray(options.points) && options.points.length === 4
			? options.points.map(([x, y]) => paper ? [clamp(x / own, 0, work.width), clamp(y / own, 0, work.height)] : [x / own, y / own])
			: null;
		if (given !== null && convex(given)) {
			// The given frame's top left on the photo as it came tells how many turns made it: turn as many again.
			const first = given.indexOf(farthest(given, ([x, y]) => -x - y));
			points = [0, 1, 2, 3].map((k) => given[(k + first) % 4]);
			for (let k = 0; k < first; k++) {
				turn();
			}
			points = paper ? points : settle(points);
			mode = 'own';
		} else if (paper) {
			[points, mode] = [found ? copy(found) : whole(), found ? 'auto' : 'whole'];
		} else {
			points = fitted();
		}
		wait.remove();
		fit();
		dialog.toggleAttribute('data-ready', true);
		const told = mode === 'own' ? 'crop.again' : paper ? (found ? 'crop.found' : 'crop.none') : '';
		if (told) {
			later = setTimeout(() => say(text(told)), 300);
		}
	}, (error) => {
		shut();
		reject(error);
	});
});

document.addEventListener('change', (event) => {
	const input = event.target;
	const file = input instanceof HTMLInputElement && input.matches('input[type="file"][data-crop]') ? input.files[0] : null;
	if (!file) {
		return;
	}
	const number = (name) => {
		const value = parseFloat(input.getAttribute(name) ?? '');
		return Number.isFinite(value) && value > 0 ? value : undefined;
	};
	const retake = () => {
		input.value = '';
		input.click();
	};
	const type = input.getAttribute('data-crop-type');
	crop(file, {
		mode: input.getAttribute('data-crop'),
		ratio: input.getAttribute('data-crop-ratio'),
		type: TYPES.includes(type) ? type : undefined,
		retake,
		max: number('data-crop-max'),
		quality: number('data-crop-quality'),
	}).then((result) => {
		if (!result) {
			input.value = '';
			return;
		}
		const list = new DataTransfer();
		list.items.add(new File([result.blob], file.name.replace(/\.[^.]*$/, '') + '.' + result.blob.type.split('/')[1].replace('jpeg', 'jpg'), {type: result.blob.type}));
		input.files = list.files;
		input.dispatchEvent(new CustomEvent('redz:crop', {bubbles: true, detail: {...result, original: file}}));
	}, () => {
		input.value = '';
		globalThis.REDZ.ui.toast({text: text('crop.unreadable'), tone: 'danger'});
	});
});

globalThis.REDZ = Object.assign(globalThis.REDZ ?? {}, {ui: {...globalThis.REDZ?.ui, crop}});
