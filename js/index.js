// REDZ.UI: the library's scripts, the one module a page loads beside css/index.css; it sets REDZ.ui for calls from code.
import './commands.js';
import './menu.js';
import './menu-place.js';
import './tabs.js';
import './toggle.js';
import './dialog.js';
import './combobox.js';
import './shortcuts.js';
import './scrollspy.js';
import './nav-overflow.js';
import './navbar.js';
import './tooltips.js';
import './fold.js';
import './carousel.js';
import './inline-edit.js';
import './password.js';
import './tree.js';
import './reorder.js';
import './upload.js';
import {toast} from './toast.js';
import {confirm} from './confirm.js';
import {busy} from './busy.js';

globalThis.REDZ = Object.assign(globalThis.REDZ ?? {}, {ui: {...globalThis.REDZ?.ui, toast, confirm, busy}});
