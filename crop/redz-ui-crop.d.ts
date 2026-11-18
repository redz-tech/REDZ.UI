// REDZ.UI, the crop package's types for an editor: REDZ.ui.crop, added to interface RedzUi of js/redz-ui.d.ts, and its
// event redz:crop. A browser never loads this file.

/** A cropped photo: the straightened frame as a file's data, its size, and the frame's corners in the photo's own
 *  pixels, upright as the photo shows, the result's top left first. */
interface RedzCrop {
	blob: Blob;
	width: number;
	height: number;
	points: [number, number][];
}

interface RedzUi {
	/** Opens the photo full screen under a frame placed on the paper's edges, or around the whole photo, for the person to
	 *  set and straighten: the long side at most max, 600 unless told, never enlarged, as type, a JPEG unless told, at
	 *  quality, 0.6 unless told; points opens the frame there again, retake gives the screen a Retake button. Answers
	 *  null when cancelled; rejects for a file the browser cannot open as an image. */
	crop(file: Blob, options?: {max?: number; type?: string; quality?: number; points?: [number, number][]; retake?: () => void}): Promise<RedzCrop | null>;
}

interface RedzEventMap {
	/** An input with data-crop holds the cropped photo now. */
	'redz:crop': CustomEvent<RedzCrop>;
}
