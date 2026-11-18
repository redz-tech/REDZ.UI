// REDZ.UI, the crop package's types for an editor: REDZ.ui.crop, added to interface RedzUi of js/redz-ui.d.ts, and its
// event redz:crop. A browser never loads this file.

/** A cropped photo: the frame as a file's data, its size, and the frame's corners in the photo's own pixels, upright as
 *  the photo shows, the result's top left first. */
interface RedzCrop {
	blob: Blob;
	width: number;
	height: number;
	points: [number, number][];
}

/** A data-crop field's answer: the crop's, and the file as it was picked. */
interface RedzCropDetail extends RedzCrop {
	original: File;
}

interface RedzUi {
	/** Opens the photo full screen to frame: a paper under four corners placed on its edges, straightened (the mode
	 *  unless told); an avatar under a circle, the photo moved and zoomed; a photo under a frame of ratio, free unless
	 *  told. The long side at most max - 600, 512 or 1600 by the mode unless told - never enlarged, as type, a JPEG
	 *  unless told, at quality, 0.6 or 0.85 by the mode unless told; points opens the frame there again, retake gives the
	 *  screen a Retake button. Answers null when cancelled; rejects for a file the browser cannot open as an image. */
	crop(file: Blob, options?: {mode?: 'paper' | 'avatar' | 'photo'; ratio?: number | string; max?: number; type?: string; quality?: number; points?: [number, number][]; retake?: () => void}): Promise<RedzCrop | null>;
}

interface RedzEventMap {
	/** An input with data-crop holds the cropped photo now. */
	'redz:crop': CustomEvent<RedzCropDetail>;
}
