<?php
// probe — the library's pages in real engines: Chrome, Firefox and Safari as installed; the floor — Chrome 130 and
// Firefox 132 fetched once into the cache, Safari 18 in the iOS simulator; the engines whose bugs js/menu-place.js repairs —
// Chrome 136, Safari 26 in the simulator. Each cell — a page at a width, light LTR or dark RTL, right to left on the
// page's Arabic twin when it has one — is judged for overflow, unmasked icons, width prefixes outside a region, cut
// labels, busy marks on live regions and errors; at the shot widths it is shot, every popover and dialog opened and axe
// run; at 1440 its widgets are walked by keyboard, the docs' state mirror is held against the real hover and focus, and
// Chrome names the fonts of Arabic text; forced colors and print where the engine has them. The pages of the config run
// that whole way; the docs pages run in the "docs" engines at their widths, without shots or walks. Writes the sheet
// .dev/probes/index.html with its report.json and exits 1 on any finding. Usage: php tools/probe.php [ENGINE…] — an
// engine named that cannot run here is a finding, one left out of a full run only a note — or php tools/probe.php
// merge DIR… — one sheet of the sheets of several runs, as CI's parallel jobs leave them.

require __DIR__ . '/lib.php';
require __DIR__ . '/probes/chrome.php';
require __DIR__ . '/probes/firefox.php';
require __DIR__ . '/probes/safari.php';
require __DIR__ . '/probes/sheet.php';

const PROBE_ROOT = __DIR__ . '/..';
const PROBE_CONFIG = __DIR__ . '/probes/config.json';
const PROBE_PAGE = __DIR__ . '/probes/page.js';
const PROBE_SHEET = __DIR__ . '/../.dev/probes';
const PROBE_FORCED_PREFS = ['browser.display.document_color_use' => 2];
// The tallest shot, in CSS px: twice that is the most a 2× phone shot can be, under the engines' 16 384 px canvas.
const PROBE_SHOT_MAX = 8000;
// The keys of the keyboard walk: the WebDriver code point (Firefox, Safari), the Windows key code and the text (Chrome).
const PROBE_KEYS = ['Enter' => ["\u{E006}", 13, "\r"], 'Escape' => ["\u{E00C}", 27, ''], 'Tab' => ["\u{E004}", 9, ''], 'ArrowDown' => ["\u{E015}", 40, ''], 'ArrowUp' => ["\u{E013}", 38, ''], 'ArrowLeft' => ["\u{E012}", 37, ''], 'ArrowRight' => ["\u{E014}", 39, ''], 'Home' => ["\u{E011}", 36, ''], 'End' => ["\u{E010}", 35, '']];

/** The folder of fetched engines and packages: $REDZ_UI_CACHE, or ~/Library/Caches/redz-ui. */
function PROBE__Cache(): string
{
	return (string)(getenv('REDZ_UI_CACHE') ?: getenv('HOME') . '/Library/Caches/redz-ui');
}

/** A TCP port free on 127.0.0.1 now. */
function PROBE__FreePort(): int
{
	$server = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
	if ($server === false) {
		throw new RuntimeException('no free port: ' . $error);
	}
	$port = (int)substr((string)strrchr((string)stream_socket_get_name($server, false), ':'), 1);
	fclose($server);
	return $port;
}

/** Runs $command without a shell and answers its output; a failure throws with its message. */
function PROBE__Run(array $command): string
{
	$proc = proc_open($command, [0 => ['file', '/dev/null', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
	if (!is_resource($proc)) {
		throw new RuntimeException('cannot run ' . $command[0]);
	}
	$out = (string)stream_get_contents($pipes[1]);
	$err = (string)stream_get_contents($pipes[2]);
	fclose($pipes[1]);
	fclose($pipes[2]);
	if (proc_close($proc) !== 0) {
		throw new RuntimeException(implode(' ', $command) . ' failed: ' . trim($err !== '' ? $err : $out));
	}
	return $out;
}

/** Waits up to five seconds for $proc to leave, then ends it. */
function PROBE__Wait($proc): void
{
	for ($i = 0; $i < 50 && proc_get_status($proc)['running']; $i++) {
		usleep(100000);
	}
	if (proc_get_status($proc)['running']) {
		proc_terminate($proc);
		usleep(500000);
		if (proc_get_status($proc)['running']) {
			proc_terminate($proc, 9);
		}
	}
	proc_close($proc);
}

/** Removes $path and everything under it, if it is there. */
function PROBE__Remove(string $path): void
{
	if (file_exists($path)) {
		PROBE__Run(['/bin/rm', '-rf', $path]);
	}
}

/** The first iOS version of the engine's list whose simulator runtime is installed here, or ''. */
function PROBE__IosRuntime(array $engine): string
{
	$runtimes = (string)shell_exec('xcrun simctl list runtimes 2>/dev/null');
	foreach ((array)$engine['ios'] as $version) {
		if (str_contains($runtimes, 'iOS ' . $version . ' ')) {
			return (string)$version;
		}
	}
	return '';
}

/** The binary that runs engine $name: the installed one, or the one fetched into the cache — fetched now when missing;
 *  '' with the reason in $why when it cannot run on this machine. */
function PROBE__Binary(string $name, array $engine, string &$why): string
{
	if (isset($engine['macos']) && preg_match('~^<\s*(\d+)$~', $engine['macos'], $m) === 1 && (int)PROBE__Run(['/usr/bin/sw_vers', '-productVersion']) >= (int)$m[1]) {
		$why = $engine['why'];
		return '';
	}
	if ($engine['kind'] === 'safari') {
		if (!is_file('/usr/bin/safaridriver')) {
			$why = 'no safaridriver on this machine';
			return '';
		}
		if (isset($engine['ios']) && PROBE__IosRuntime($engine) === '') {
			$why = 'no simulator runtime of iOS ' . implode(' or ', (array)$engine['ios']) . ' here';
			return '';
		}
		if (!isset($engine['ios']) && preg_match('~<key>CGSSessionScreenIsLocked</key>\s*<true/>~', PROBE__Run(['/usr/sbin/ioreg', '-n', 'Root', '-d1', '-a'])) === 1) {
			$why = 'the screen is locked, and Safari on the Mac draws no frames until it is unlocked';
			return '';
		}
		return '/usr/bin/safaridriver';
	}
	if (isset($engine['binary'])) {
		if (!is_file($engine['binary'])) {
			$why = 'not installed at ' . $engine['binary'];
			return '';
		}
		return $engine['binary'];
	}
	$home = PROBE__Cache() . '/engines/' . $name;
	if (!is_file($home . '/' . $engine['fetch']['binary'])) {
		PROBE__Fetch($name, $engine['fetch'], $home);
	}
	return $home . '/' . $engine['fetch']['binary'];
}

/** Downloads the archive of engine $name, checks its sha256 or sha512 and unpacks it into $home: a zip by ditto, a disk
 *  image by hdiutil. */
function PROBE__Fetch(string $name, array $fetch, string $home): void
{
	$downloads = PROBE__Cache() . '/downloads';
	@mkdir($downloads, 0777, true);
	$file = $downloads . '/' . $name . (str_ends_with($fetch['url'], '.dmg') ? '.dmg' : '.zip');
	if (!is_file($file)) {
		echo $name, ': fetching ', $fetch['url'], "\n";
		TOOL__Download($fetch['url'], $file);
	}
	foreach (['sha256', 'sha512'] as $algorithm) {
		if (isset($fetch[$algorithm]) && !hash_equals($fetch[$algorithm], (string)hash_file($algorithm, $file))) {
			unlink($file);
			throw new RuntimeException($name . ': the download does not match its ' . $algorithm);
		}
	}
	$part = $home . '.part';
	PROBE__Remove($part);
	mkdir($part, 0777, true);
	if (str_ends_with($file, '.zip')) {
		PROBE__Run(['/usr/bin/ditto', '-x', '-k', $file, $part]);
	} else {
		$mount = $part . '.mount';
		mkdir($mount);
		PROBE__Run(['/usr/bin/hdiutil', 'attach', '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', $mount, $file]);
		try {
			foreach (glob($mount . '/*.app') ?: [] as $app) {
				PROBE__Run(['/usr/bin/ditto', $app, $part . '/' . basename($app)]);
			}
		} finally {
			PROBE__Run(['/usr/bin/hdiutil', 'detach', $mount, '-quiet']);
			@rmdir($mount);
		}
	}
	PROBE__Remove($home);
	rename($part, $home);
	unlink($file);
}

/** The source of axe-core at the pinned version, fetched once into the cache with its sha512 checked. */
function PROBE__Axe(array $axe): string
{
	$file = PROBE__Cache() . '/axe-core-' . $axe['version'] . '.min.js';
	if (!is_file($file)) {
		@mkdir(dirname($file), 0777, true);
		file_put_contents($file, TOOL__NpmFile('axe-core', $axe['version'], 'package/axe.min.js', $axe['integrity'])['body']);
	}
	return (string)file_get_contents($file);
}

/** Starts php -S over the working tree with the probes' router, its log in $dir; answers the process and the base URL. */
function PROBE__ServerStart(string $dir): array
{
	$port = PROBE__FreePort();
	$proc = proc_open([PHP_BINARY, '-S', '127.0.0.1:' . $port, __DIR__ . '/probes/router.php'], [0 => ['file', '/dev/null', 'r'], 1 => ['file', $dir . '/server.log', 'a'], 2 => ['file', $dir . '/server.log', 'a']], $pipes, PROBE_ROOT);
	$base = 'http://127.0.0.1:' . $port . '/';
	for ($tries = 0; @file_get_contents($base . 'index.html') === false; $tries++) {
		if ($tries > 50) {
			throw new RuntimeException('the static server did not start, see ' . $dir . '/server.log');
		}
		usleep(100000);
	}
	return [$proc, $base];
}

/** Calls the engine driver's $verb (Load, Inject, Eval, Shot, Print, Errors, Stop) on the handle. */
function PROBE__Do(array &$h, string $verb, mixed ...$args): mixed
{
	if (getenv('REDZ_PROBE_TRACE') !== false) {
		fwrite(STDERR, gmdate('H:i:s') . ' ' . $verb . ' ' . substr(json_encode(array_map(fn(mixed $arg): mixed => is_string($arg) && strlen($arg) > 200 ? strlen($arg) . ' bytes' : $arg, $args), JSON_UNESCAPED_SLASHES), 0, 160) . "\n");
	}
	return ('PROBE__' . ucfirst($h['kind']) . $verb)($h, ...$args);
}

/** Runs every cell of engine $name, then its forced colors and print, into $report. */
function PROBE__EngineRun(string $name, array $engine, string $binary, string $dir, array $run, array &$report): void
{
	$h = match ($engine['kind']) {
		'chrome' => PROBE__ChromeStart($binary, $dir),
		'firefox' => PROBE__FirefoxStart($binary, $dir),
		'safari' => PROBE__SafariStart($dir, isset($engine['ios']) ? PROBE__IosRuntime($engine) : ''),
	};
	$report['engines'][$name] = ['version' => $h['version'], 'cells' => 0];
	try {
		$widths = isset($engine['ios']) ? [0 => 0] : $run['config']['widths'];
		foreach ($run['config']['pages'] as $page) {
			foreach ($run['config']['combos'] as $combo => [$theme, $direction]) {
				foreach ($widths as $width => $height) {
					PROBE__Cell($h, $name, $page, $combo, $theme, $direction, (int)$width, (int)$height, 'normal', $run, $report);
				}
			}
		}
		if (in_array($name, $run['config']['docs']['engines'], true)) {
			foreach (PROBE__DocsPages($run['config']) as $page) {
				foreach ($run['config']['combos'] as $combo => [$theme, $direction]) {
					foreach ($run['config']['docs']['widths'] as $width) {
						PROBE__Cell($h, $name, $page, $combo, $theme, $direction, (int)$width, (int)$run['config']['widths'][$width], 'docs', $run, $report);
					}
				}
			}
		}
		if ($engine['kind'] !== 'safari') {
			foreach ($run['config']['pages'] as $page) {
				PROBE__PrintCell($h, $name, $page, $run, $report);
			}
		}
		if ($engine['kind'] === 'chrome') {
			foreach ($run['config']['pages'] as $page) {
				foreach (['light-ltr' => ['light', 'ltr'], 'dark-ltr' => ['dark', 'ltr']] as $combo => [$theme, $direction]) {
					PROBE__Cell($h, $name, $page, $combo, $theme, $direction, 1440, 900, 'forced', $run, $report);
				}
			}
		}
	} finally {
		PROBE__Do($h, 'Stop');
	}
	if ($engine['kind'] === 'firefox') {
		@mkdir($dir . '/forced', 0777, true);
		$forced = PROBE__FirefoxStart($binary, $dir . '/forced', PROBE_FORCED_PREFS);
		try {
			foreach ($run['config']['pages'] as $page) {
				PROBE__Cell($forced, $name, $page, 'light-ltr', 'light', 'ltr', 1440, 900, 'forced', $run, $report);
			}
		} finally {
			PROBE__FirefoxStop($forced);
		}
	}
}

/**
 * The docs pages beside the config's pages: every page of docs/ but those and the twins.
 * @return list<string>
 */
function PROBE__DocsPages(array $config): array
{
	$pages = [];
	foreach (glob(PROBE_ROOT . '/docs/*.html') ?: [] as $file) {
		$page = 'docs/' . basename($file);
		if (!in_array($page, $config['pages'], true) && !str_ends_with($page, '.ar.html')) {
			$pages[] = $page;
		}
	}
	return $pages;
}

/** The page a cell loads: right to left, the page's Arabic twin when it has one. */
function PROBE__Shown(string $page, string $dir): string
{
	$twin = substr($page, 0, -5) . '.ar.html';
	return $dir === 'rtl' && is_file(PROBE_ROOT . '/' . $twin) ? $twin : $page;
}

/** The docs' state mirror held against the real states: each copy beside its twin at rest put in the same state by the
 *  real pointer or a real Tab; answers the findings. */
function PROBE__Mirror(array &$h): array
{
	$findings = [];
	foreach (PROBE__Do($h, 'Eval', 'REDZ_PROBE.mirrors()') as $i => $pair) {
		$focus = $pair['state'] !== 'hover';
		[$x, $y] = PROBE__Do($h, 'Eval', 'REDZ_PROBE.rest(' . $i . ', ' . json_encode($focus) . ')');
		if ($focus) {
			PROBE__Do($h, 'Key', 'Tab');
		} else {
			PROBE__Do($h, 'Hover', $x, $y);
		}
		$seen = PROBE__Do($h, 'Eval', 'REDZ_PROBE.compare(' . $i . ')');
		PROBE__Do($h, 'Hover', 1, 1);
		if ($focus && !$seen['active']) {
			$findings[] = 'the docs mirror of :' . $pair['state'] . ' on ' . $pair['what'] . ' — Tab did not reach it';
		} elseif (!$seen['real']) {
			continue;
		} elseif ($seen['differ'] !== []) {
			$findings[] = 'the docs mirror of :' . $pair['state'] . ' on ' . $pair['what'] . ' differs from the real state: ' . implode('; ', $seen['differ']);
		}
	}
	PROBE__Do($h, 'Eval', 'document.activeElement?.blur() ?? true');
	return $findings;
}

/** One cell — $page at $width × $height (a simulator: its own screen when 0), $theme and $dir, normal, docs or forced
 *  colors: judged; normal or forced at a shot width shot; normal or docs at a shot width its popovers opened and axe
 *  run; normal at 1440 walked by keyboard and its state mirror and Arabic fonts checked. */
function PROBE__Cell(array &$h, string $name, string $page, string $combo, string $theme, string $dir, int $width, int $height, string $mode, array $run, array &$report): void
{
	$forced = $mode === 'forced';
	$shown = PROBE__Shown($page, $dir);
	$label = ($width === 0 ? 'phone' : $width) . ' · ' . $theme . ' · ' . strtoupper($dir) . ($shown !== $page ? ' · Arabic' : '') . ($forced ? ' · forced colors' : '');
	$where = $name . ' ' . $shown . ' ' . $label . ' — ';
	PROBE__Do($h, 'Load', $run['base'] . $shown . '?theme=' . $theme . '&dir=' . $dir, $width, $height, $theme, $forced);
	PROBE__Do($h, 'Inject', $run['page']);
	PROBE__Do($h, 'Eval', 'REDZ_PROBE.prepare(' . json_encode($theme) . ', ' . json_encode($dir) . ')');
	$report['engines'][$name]['cells']++;
	$m = PROBE__Do($h, 'Eval', 'REDZ_PROBE.measure()');
	$findings = [];
	if ($m['scroll'] > $m['client']) {
		$findings[] = 'overflow ' . $m['scroll'] . ' > ' . $m['client'] . ': ' . implode(', ', $m['offenders']);
	}
	foreach (['unmasked' => 'icons without a mask', 'unregioned' => 'width prefixes outside a region', 'cut' => 'cut labels', 'busyLive' => 'aria-busy on or around a live region'] as $key => $what) {
		if ($m[$key] !== []) {
			$findings[] = $what . ': ' . implode(', ', $m[$key]);
		}
	}
	if ($forced && $m['forced'] !== true) {
		$findings[] = 'forced colors did not apply';
	}
	if ($m['ui'] !== true) {
		$findings[] = 'the library\'s script did not run: no REDZ.ui';
	}
	if ($m['hidden'] ?? false) {
		echo 'note: ', $where, "the engine keeps the page in the background, so it draws no frames\n";
	}
	$at = $width === 0 || in_array($width, $run['config']['shots'], true);
	$shot = ($at && $mode === 'normal') || $forced;
	if ($shot) {
		$file = 'shots/' . PROBE__Slug($name . '-' . $page . '-' . $combo . '-' . ($width ?: 'phone') . ($forced ? '-forced' : '')) . '.webp';
		$size = PROBE__ShotWrite(PROBE__Do($h, 'Shot'), (float)PROBE__Do($h, 'Eval', 'devicePixelRatio'), $run['sheet'] . '/' . $file);
		$report['shots'][$page][$name][] = ['file' => $file, 'size' => $size, 'label' => $label . ($h['kind'] === 'safari' ? ' · viewport' : '')];
	}
	if ($at && !$forced) {
		foreach (PROBE__Do($h, 'Eval', 'REDZ_PROBE.popovers()') as $p) {
			$what = $p['target'] . ' from ' . $p['invoker'];
			if ($p['guard']) {
				$report['guarded'][] = $where . $what;
			}
			if (!$p['open']) {
				$findings[] = $what . ' did not open';
			} elseif (!$p['inside']) {
				$findings[] = $what . ' leaves the viewport at [' . implode(', ', $p['box']) . ']';
			} elseif (!$p['anchored']) {
				$findings[] = $what . ' is not beside its button: [' . implode(', ', $p['box']) . '] by [' . implode(', ', $p['by']) . ']';
			}
		}
	}
	if ($width === 1440 && $mode === 'normal') {
		$walked = [];
		$findings = [...$findings, ...PROBE__KeyWalk($h, $walked), ...PROBE__Notices($h)];
		foreach ($walked as $widget) {
			$report['walked'][$page][$widget][$name] = true;
		}
		if ($theme === 'light' && $dir === 'ltr') {
			$findings = [...$findings, ...PROBE__Mirror($h)];
		}
		if ($h['kind'] === 'chrome' && $shown !== $page) {
			$texts = PROBE__Do($h, 'Eval', 'REDZ_PROBE.arabic()');
			foreach (PROBE__ChromeFonts($h, '[data-probe-arabic]') as $k => $families) {
				$wrong = array_intersect($families, ['Arial', 'Tahoma', 'Times', 'Times New Roman']);
				if ($wrong !== []) {
					$findings[] = 'Arabic drawn in ' . implode(', ', $wrong) . ': ' . ($texts[$k] ?? '?');
				}
			}
		}
	}
	if ($at && !$forced) {
		PROBE__Do($h, 'Inject', $run['axe']);
		foreach (PROBE__Do($h, 'Eval', 'REDZ_PROBE.axe(' . json_encode($run['config']['axe']['tags']) . ')') as $v) {
			$targets = array_values(array_filter($v['targets'], fn(string $target): bool => !PROBE__AxeAllowed($run['config'], $name, $v['id'], $target, $report)));
			if ($targets !== []) {
				$findings[] = 'axe ' . $v['id'] . ' (' . $v['impact'] . ', ' . $v['help'] . '): ' . implode(' | ', $targets);
			}
		}
	}
	foreach ($h['kind'] === 'safari' ? PROBE__Do($h, 'Eval', 'REDZ_PROBE.errors()') : PROBE__Do($h, 'Errors') as $error) {
		$findings[] = 'error ' . $error;
	}
	foreach ($findings as $finding) {
		if (!PROBE__FindingAllowed($run['config'], $name, $where . $finding, $report)) {
			$report['findings'][] = $where . $finding;
		}
	}
}

/** The keyboard walk of a page: each menu, modal dialog and tab list driven by real keys — and a dialog with
 *  closedby="any" by a click outside it — against the WAI-ARIA patterns; answers its findings, and the widgets it
 *  walked in $walked. */
function PROBE__KeyWalk(array &$h, array &$walked): array
{
	$findings = [];
	$press = function (string $key) use (&$h): void {
		PROBE__Do($h, 'Key', $key);
		usleep(200000);
	};
	// Headless Firefox on macOS gives the document no focus, so it presses no button by keyboard: it opens by a click.
	$activate = function (string $id) use (&$h, $press): void {
		if ($h['kind'] === 'firefox') {
			PROBE__Do($h, 'Click', ...PROBE__Do($h, 'Eval', 'REDZ_PROBE.invokerPoint(' . json_encode($id) . ')'));
			usleep(200000);
		} else {
			$press('Enter');
		}
	};
	foreach (PROBE__Do($h, 'Eval', 'REDZ_PROBE.keyTargets()') as ['kind' => $kind, 'id' => $id, 'outside' => $outside]) {
		$state = fn(): array => PROBE__Do($h, 'Eval', 'REDZ_PROBE.state(' . json_encode($kind) . ', ' . json_encode($id) . ')');
		$what = ($kind === 'tabs' ? 'the tab list ' . $id : '#' . $id) . ' by keyboard — ';
		$walked[] = ($kind === 'tabs' ? 'a tab list' : '#' . $id . ' (' . $kind . ($outside ? ', a click outside' : '') . ')');
		PROBE__Do($h, 'Eval', 'REDZ_PROBE.focus(' . json_encode($kind) . ', ' . json_encode($id) . ')');
		if ($kind === 'menu') {
			$activate($id);
			$s = $state();
			$first = max(0, $s['checked']);
			$steps = [['opening', $first], ['ArrowDown', ($first + 1) % max(1, $s['items'])], ['End', $s['items'] - 1], ['Home', 0]];
			foreach ($steps as $i => [$key, $item]) {
				if ($i > 0) {
					$press($key);
					$s = $state();
				}
				if (!$s['open'] || $s['item'] !== $item) {
					$findings[] = $what . $key . ': ' . ($s['open'] ? 'the focus is on item ' . $s['item'] . ', not ' . $item : 'the menu is closed');
					continue 2;
				}
			}
			$press('Escape');
			$s = $state();
			if ($s['open'] || !$s['onInvoker']) {
				$findings[] = $what . 'Escape: ' . ($s['open'] ? 'the menu stays open' : 'the focus is not back on its button');
				continue;
			}
			$press('ArrowDown');
			$s = $state();
			if (!$s['open'] || $s['item'] !== $first) {
				$findings[] = $what . 'ArrowDown on its button: ' . ($s['open'] ? 'the focus is on item ' . $s['item'] . ', not ' . $first : 'the menu does not open');
				continue;
			}
			$press('Tab');
			$s = $state();
			if ($s['open'] || $s['inside']) {
				$findings[] = $what . 'Tab: the menu stays open';
			}
		} elseif ($kind === 'dialog') {
			$activate($id);
			usleep(200000);
			$s = $state();
			if (!$s['open'] || !$s['inside']) {
				$findings[] = $what . 'opening: ' . ($s['open'] ? 'the focus is not inside the dialog' : 'the dialog does not open');
				continue;
			}
			for ($i = $s['at']; $i < $s['focusables'] - 1 && !$s['leaked']; $i++) {
				$press('Tab');
				$s = $state();
			}
			if ($s['leaked']) {
				$findings[] = $what . 'Tab: the focus left the open dialog';
			}
			$press('Escape');
			usleep(200000);
			$s = $state();
			if ($s['open'] || !$s['onInvoker']) {
				$findings[] = $what . 'Escape: ' . ($s['open'] ? 'the dialog stays open' : 'the focus is not back on its button');
				continue;
			}
			if ($outside) {
				$activate($id);
				usleep(200000);
				$point = PROBE__Do($h, 'Eval', 'REDZ_PROBE.outside(' . json_encode($id) . ')');
				if ($point !== null) {
					PROBE__Do($h, 'Click', $point[0], $point[1]);
					usleep(300000);
					if ($state()['open']) {
						$findings[] = '#' . $id . ' — a click outside it does not close it (closedby="any")';
					}
				}
				PROBE__Do($h, 'Eval', '(document.getElementById(' . json_encode($id) . ').open && document.getElementById(' . json_encode($id) . ').close(), true)');
			}
		} else {
			$s = $state();
			$start = $s['selected'][0] ?? 0;
			$last = $s['count'] - 1;
			foreach ([[$s['rtl'] ? 'ArrowLeft' : 'ArrowRight', ($start + 1) % $s['count']], ['End', $last], ['Home', 0]] as [$key, $tab]) {
				$press($key);
				$s = $state();
				if ($s['manual']) {
					if ($s['focused'] !== $tab || $s['selected'] !== [$start]) {
						$findings[] = $what . $key . ' (manual activation): the focus should move to tab ' . $tab . ' and the selection stay on ' . $start . ' — selected ' . json_encode($s['selected']) . ', focused ' . $s['focused'];
						break;
					}
					if ($h['kind'] === 'firefox') {
						continue;
					}
					$press('Enter');
					$s = $state();
					$start = $tab;
				}
				if ($s['selected'] !== [$tab] || $s['focused'] !== $tab || $s['shown'] !== [$tab]) {
					$findings[] = $what . $key . ($s['manual'] ? ' and Enter' : '') . ': tab ' . $tab . ' should be selected, focused and its panel alone shown — selected ' . json_encode($s['selected']) . ', focused ' . $s['focused'] . ', shown ' . json_encode($s['shown']);
					break;
				}
			}
		}
	}
	return $findings;
}

/** Two notices by REDZ.ui.toast on the page: a success in the role="status" region, an error in the role="alert" one. */
function PROBE__Notices(array &$h): array
{
	$findings = [];
	foreach (PROBE__Do($h, 'Eval', 'REDZ_PROBE.notices()') as $notice) {
		$role = $notice['tone'] === 'danger' ? 'alert' : 'status';
		if ($notice['role'] !== $role || !$notice['shown']) {
			$findings[] = 'a ' . $notice['tone'] . ' notice is ' . ($notice['shown'] ? 'in the region of role "' . $notice['role'] . '", not "' . $role . '"' : 'not shown');
		}
	}
	return $findings;
}

/** Whether an exception of the probes' config allows axe rule $rule at $target in engine $engine; marks it used. */
function PROBE__AxeAllowed(array $config, string $engine, string $rule, string $target, array &$report): bool
{
	foreach ($config['allow'] as $k => $entry) {
		if (($entry['rule'] ?? null) === $rule && str_contains($target, $entry['target']) && in_array($engine, $entry['engines'] ?? [$engine], true)) {
			$report['used'][$k] = true;
			return true;
		}
	}
	return false;
}

/** Whether an exception of the config — {"finding": a part of its text, "engines", "reason"} — allows the finding
 *  $text of engine $engine; marks the exception used. */
function PROBE__FindingAllowed(array $config, string $engine, string $text, array &$report): bool
{
	foreach ($config['allow'] as $k => $entry) {
		if (isset($entry['finding']) && str_contains($text, $entry['finding']) && in_array($engine, $entry['engines'] ?? [$engine], true)) {
			$report['used'][$k] = true;
			return true;
		}
	}
	return false;
}

/** $page printed by the engine on A4, light: the PDF beside the sheet and its first page as a shot. */
function PROBE__PrintCell(array &$h, string $name, string $page, array $run, array &$report): void
{
	PROBE__Do($h, 'Load', $run['base'] . $page . '?theme=light&dir=ltr', 1440, 900, 'light', false);
	PROBE__Do($h, 'Inject', $run['page']);
	PROBE__Do($h, 'Eval', 'REDZ_PROBE.prepare("light", "ltr")');
	$slug = PROBE__Slug($name . '-' . $page);
	file_put_contents($run['sheet'] . '/print/' . $slug . '.pdf', PROBE__Do($h, 'Print'));
	$size = PROBE__PrintShotWrite($run['sheet'] . '/print/' . $slug . '.pdf', $run['sheet'] . '/shots/' . $slug . '-print.webp');
	$report['shots'][$page][$name][] = $size === [] ? ['file' => 'print/' . $slug . '.pdf', 'size' => [0, 0], 'label' => 'print · A4 (PDF)'] : ['file' => 'shots/' . $slug . '-print.webp', 'size' => $size, 'label' => 'print · A4'];
}

/** A file name part of $text: lowercase letters, digits and dashes. */
function PROBE__Slug(string $text): string
{
	return trim((string)preg_replace('~[^a-z0-9]+~', '-', strtolower(str_replace('.html', '', $text))), '-');
}

/** The entry point: every engine of the config, or the ones named. */
/** Prints the findings and the verdict of $report and checks the config's exceptions against the engines that ran;
 *  the exit code. */
function PROBE__Verdict(array $config, array &$report): int
{
	$ran = array_keys(array_filter($report['engines'], fn(array $engine): bool => $engine['cells'] > 0));
	foreach ($config['allow'] as $k => $entry) {
		if (!isset($report['used'][$k]) && array_diff($entry['engines'] ?? array_keys($config['engines']), $ran) === []) {
			$report['findings'][] = 'tools/probes/config.json — the exception ' . ($entry['finding'] ?? $entry['rule'] . ' at ' . $entry['target']) . ' allows nothing any more';
		}
	}
	foreach ($report['findings'] as $finding) {
		echo $finding, "\n";
	}
	echo count($report['findings']) === 0 ? 'CLEAN' : count($report['findings']) . ' findings', ' · sheet .dev/probes/index.html', "\n";
	return $report['findings'] === [] ? 0 : 1;
}

/** merge: one sheet of the sheets in $dirs — their reports joined, their shots, prints and logs copied; the exit code. */
function PROBE__Merge(array $config, array $dirs): int
{
	$work = PROBE_SHEET . '.new';
	PROBE__Remove($work);
	$report = null;
	foreach ($dirs as $dir) {
		$part = json_decode((string)@file_get_contents($dir . '/report.json'), true);
		if (!is_array($part)) {
			fwrite(STDERR, $dir . '/report.json is missing or not a report' . "\n");
			return 2;
		}
		if ($report === null) {
			$report = $part;
		} else {
			$report['engines'] += $part['engines'];
			$report['skipped'] += $part['skipped'];
			$report['used'] += $part['used'];
			$report['findings'] = [...$report['findings'], ...$part['findings']];
			$report['guarded'] = [...$report['guarded'], ...$part['guarded']];
			$report['walked'] = array_replace_recursive($report['walked'], $part['walked']);
			$report['shots'] = array_merge_recursive($report['shots'], $part['shots']);
		}
		foreach (['shots', 'print', 'logs'] as $folder) {
			@mkdir($work . '/' . $folder, 0777, true);
			foreach (glob($dir . '/' . $folder . '/*') ?: [] as $file) {
				copy($file, $work . '/' . $folder . '/' . basename($file));
			}
		}
	}
	if ($report === null) {
		fwrite(STDERR, "merge needs the folders of the sheets to join\n");
		return 2;
	}
	$status = PROBE__Verdict($config, $report);
	PROBE__SheetWrite($work, $report);
	file_put_contents($work . '/report.json', json_encode($report, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
	PROBE__Remove(PROBE_SHEET);
	rename($work, PROBE_SHEET);
	return $status;
}

function PROBE__Main(array $argv): int
{
	$config = json_decode((string)file_get_contents(PROBE_CONFIG), true, 512, JSON_THROW_ON_ERROR);
	if (($argv[1] ?? '') === 'merge') {
		return PROBE__Merge($config, array_slice($argv, 2));
	}
	$names = array_slice($argv, 1) ?: array_keys(array_filter($config['engines'], fn(array $engine): bool => $engine['default'] ?? true));
	foreach ($names as $name) {
		if (!isset($config['engines'][$name])) {
			fwrite(STDERR, 'no engine ' . $name . ' in tools/probes/config.json; there are ' . implode(', ', array_keys($config['engines'])) . "\n");
			return 2;
		}
	}
	$tmp = sys_get_temp_dir() . '/redz-ui-probe-' . getmypid();
	$work = PROBE_SHEET . '.new';
	PROBE__Remove($work);
	foreach ([$tmp, $work . '/shots', $work . '/print'] as $folder) {
		mkdir($folder, 0777, true);
	}
	$commit = trim((string)shell_exec('git -C ' . escapeshellarg(PROBE_ROOT) . ' rev-parse --short HEAD 2>/dev/null'));
	$report = ['when' => gmdate('Y-m-d H:i') . ' UTC', 'commit' => $commit === '' ? 'no commit' : 'commit ' . $commit, 'widths' => array_keys($config['widths']), 'engines' => [], 'skipped' => [], 'findings' => [], 'guarded' => [], 'walked' => [], 'shots' => [], 'used' => []];
	$run = ['config' => $config, 'page' => (string)file_get_contents(PROBE_PAGE), 'axe' => PROBE__Axe($config['axe']), 'sheet' => $work];
	[$server, $run['base']] = PROBE__ServerStart($tmp);
	register_shutdown_function(fn() => is_resource($server) && proc_terminate($server));
	if (function_exists('pcntl_async_signals')) {
		pcntl_async_signals(true);
		foreach ([SIGINT, SIGTERM, SIGHUP] as $signal) {
			pcntl_signal($signal, fn() => exit(130));
		}
	}
	try {
		foreach ($names as $name) {
			$why = '';
			$before = count($report['findings']);
			try {
				$binary = PROBE__Binary($name, $config['engines'][$name], $why);
				if ($binary === '') {
					$report['skipped'][$name] = $why;
					if (array_slice($argv, 1) !== []) {
						$report['findings'][] = $name . ' — named, but cannot run here: ' . $why;
					}
					echo $name, ' skipped: ', $why, "\n";
					continue;
				}
				mkdir($tmp . '/' . $name, 0777, true);
				PROBE__EngineRun($name, $config['engines'][$name], $binary, $tmp . '/' . $name, $run, $report);
			} catch (Throwable $e) {
				$report['findings'][] = $name . ' — stopped: ' . $e->getMessage();
			}
			printf("%-12s %s · %d cells · %d findings\n", $name, $report['engines'][$name]['version'] ?? '?', $report['engines'][$name]['cells'] ?? 0, count($report['findings']) - $before);
		}
	} finally {
		proc_terminate($server);
		PROBE__Wait($server);
	}
	@mkdir($work . '/logs');
	foreach (glob($tmp . '/{,*/,*/*/}*.log', GLOB_BRACE) ?: [] as $log) {
		copy($log, $work . '/logs/' . PROBE__Slug(substr(dirname($log), strlen($tmp))) . (dirname($log) === $tmp ? '' : '-') . basename($log));
	}
	$status = PROBE__Verdict($config, $report);
	PROBE__SheetWrite($work, $report);
	file_put_contents($work . '/report.json', json_encode($report, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
	PROBE__Remove(PROBE_SHEET);
	rename($work, PROBE_SHEET);
	PROBE__Remove($tmp);
	return $status;
}

exit(PROBE__Main($argv));
