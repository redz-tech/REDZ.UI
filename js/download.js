// REDZ.UI, download: a button with command="--download" and aria-controls naming an element downloads what it holds. A
// QR tile - any element holding an svg, an img or a canvas - gives its picture as a PNG on white: data-file names it
// (code.png by default), data-size is its side in pixels (512); an svg goes through a blob: image, so the page's CSP
// needs img-src blob:. A field, a textarea or any other element gives its value or its text as a file: data-file names
// it (download.txt), data-type is its type (text/plain), and a text/csv file starts with a UTF-8 byte order mark, so a
// spreadsheet reads its letters right, unless data-bom="false". REDZ.ui.download({text, file, type, bom}) or
// ({blob, file}) does it from code. Each download is said politely, in the page's text "downloaded". Like --toggle,
// the button has no commandfor.
import {text} from './text.js';
import {announce} from './say.js';

/** Hands the blob to the browser as a file of the name, and says so. */
const save = (blob, file) => {
	const link = Object.assign(document.createElement('a'), {href: URL.createObjectURL(blob), download: file});
	link.click();
	setTimeout(() => URL.revokeObjectURL(link.href), 10000);
	announce(text('downloaded', {name: file}));
};

/** Downloads {text, file, type, bom} - a CSV with a UTF-8 byte order mark unless bom is false - or {blob, file}. */
export const download = ({text: words = '', blob = null, file = 'download.txt', type = 'text/plain', bom = true} = {}) => {
	const kind = /;\s*charset=/i.test(type) ? type : type + ';charset=utf-8';
	const mark = bom && /^text\/csv\b/i.test(type) ? String.fromCharCode(0xfeff) : '';
	save(blob ?? new Blob([mark + words], {type: kind}), file);
};

/** The picture as an image or a canvas drawImage takes, once loaded. */
const pictureOf = (source) => {
	if (source.localName === 'canvas') {
		return Promise.resolve([source, () => {}]);
	}
	const url = source.localName === 'svg' ? URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(source)], {type: 'image/svg+xml'})) : source.currentSrc || source.src;
	const image = new Image();
	image.src = url;
	return image.decode().then(() => [image, () => url.startsWith('blob:') && URL.revokeObjectURL(url)]);
};

/** Downloads the picture as a PNG on white, SIDE pixels square. */
const png = (source, side, file) => pictureOf(source).then(([picture, done]) => {
	const canvas = Object.assign(document.createElement('canvas'), {width: side, height: side});
	const paint = canvas.getContext('2d');
	paint.fillStyle = '#fff';
	paint.fillRect(0, 0, side, side);
	paint.imageSmoothingEnabled = false;
	paint.drawImage(picture, 0, 0, side, side);
	done();
	canvas.toBlob((blob) => {
		if (blob === null) {
			console.error('REDZ.UI: the picture cannot be downloaded: the browser made no PNG of it');
			return;
		}
		save(blob, file);
	}, 'image/png');
}).catch((error) => console.error('REDZ.UI: the picture cannot be downloaded', error));

document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest('button[command="--download"][aria-controls]') : null;
	const target = button === null || button.disabled || button.getAttribute('aria-disabled') === 'true' ? null : document.getElementById(button.getAttribute('aria-controls'));
	if (target === null) {
		return;
	}
	const picture = target.matches('svg, img, canvas') ? target : target.querySelector('svg, img, canvas');
	if (picture !== null) {
		png(picture, Number(button.dataset.size) || 512, button.dataset.file || 'code.png');
		return;
	}
	download({text: target.matches('input, textarea, select') ? target.value : target.textContent, file: button.dataset.file || 'download.txt', type: button.dataset.type || 'text/plain', bom: button.dataset.bom !== 'false'});
});
