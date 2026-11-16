// REDZ.UI, the QR package's types for an editor: REDZ.ui.qr, added to interface RedzUi of js/redz-ui.d.ts. A browser
// never loads this file.

interface RedzUi {
	/** Draws the QR code of the text into the element as one SVG path in its text color, or empties it for null: false
	 *  when the text is longer than version 40 holds at the level, which marks the element data-qr-error. The level of
	 *  error correction is M by default, the quiet zone 4 modules; a TypeError for a level, a quiet zone or a text the
	 *  call cannot take. */
	qr(element: Element, text: string | null, options?: {level?: 'L' | 'M' | 'Q' | 'H'; quiet?: number}): boolean;
}
