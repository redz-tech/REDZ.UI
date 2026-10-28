// REDZ.UI: the library's scripts — the one module a page loads beside css/index.css; it sets REDZ.ui for calls from code.
import './commands.js';
import './menu.js';
import './menu-place.js';
import './tabs.js';
import './dialog.js';
import {toast} from './toast.js';
import {confirm} from './confirm.js';
import {busy} from './busy.js';

globalThis.REDZ = Object.assign(globalThis.REDZ ?? {}, {ui: {toast, confirm, busy}});
