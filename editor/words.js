// REDZ.UI editor, its words: every one comes from the page's texts, editor.*.
import {text, textCount} from '../js/text.js';

/** The words of an island text of the editor. */
export const say = (key, args) => text('editor.' + key, args);

/** The words of a count, in the form its language asks for. */
export const sayCount = (key, count) => textCount('editor.' + key, count);
