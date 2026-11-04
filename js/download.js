// REDZ.UI, download: a button with command="--download" and aria-controls naming a QR tile - any element holding an svg,
// an img or a canvas - downloads its picture as a PNG on white: data-file names it (code.png by default), data-size is
// its side in pixels (512). An svg goes through a blob: image, so the page's CSP needs img-src blob:. Like --toggle, the
// button has no commandfor.

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

document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest('button[command="--download"][aria-controls]') : null;
	const source = button === null || button.disabled || button.getAttribute('aria-disabled') === 'true' ? null : document.getElementById(button.getAttribute('aria-controls'))?.querySelector('svg, img, canvas');
	if (!source) {
		return;
	}
	const side = Number(button.dataset.size) || 512;
	pictureOf(source).then(([picture, done]) => {
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
			const link = Object.assign(document.createElement('a'), {href: URL.createObjectURL(blob), download: button.dataset.file || 'code.png'});
			link.click();
			setTimeout(() => URL.revokeObjectURL(link.href), 1000);
		}, 'image/png');
	}).catch((error) => console.error('REDZ.UI: the picture cannot be downloaded', error));
});
