<?php
// probe - the library's pages in real engines: Chrome, Firefox and Safari as installed; the floor - Chrome 130 and
// Firefox 132 fetched once into the cache, Safari 18 in the iOS simulator; the engines whose bugs js/menu-place.js repairs -
// Chrome 136, Safari 26 in the simulator. Each cell - a page at a width, light LTR or dark RTL, right to left on the
// page's Arabic twin when it has one - is judged for overflow, unmasked icons, width prefixes outside a region, cut
// labels, busy marks on live regions and errors; at the shot widths it is shot, every popover and dialog opened and axe
// run; at 1440 its widgets are walked by keyboard, the docs' state mirror is held against the real hover and focus, and
// Chrome names the fonts of Arabic text; forced colors and print where the engine has them; and every engine runs the
// minifier's scripts of tools/min/ as written and minified, and reads the release's stylesheet as written and squeezed,
// which must agree. The pages of the config run that whole way; the docs pages run in the "docs" engines at their
// widths, without shots or walks. Writes the sheet
// .dev/probes/index.html with its report.json and exits 1 on any finding; an engine whose cell runs past five minutes
// stops as stalling, that cell named. The screen readers hear the config's speech steps: VoiceOver in Safari on a Mac,
// NVDA in Chrome and Firefox on Windows, where NVDA also reads each speech page whole by its quick navigation. Usage:
// php tools/probe.php [--pages=PAGE,…] [--serial] [ENGINE…] - an engine named that cannot run here is a finding, one left
// out of a full run only a note; --pages runs only those pages, the exceptions of the others left unjudged; outside CI the
// engines run at once, a process each (the engines safaridriver drives one after another), unless --serial - or
// php tools/probe.php merge [--base=DIR] DIR… - one sheet of the sheets of several runs, as CI's parallel jobs leave them -
// or php tools/probe.php affected BASE - what the files changed since BASE ask of each part - or plan | gather, CI's
// plan of the parts and its one sheet of them - or php tools/probe.php voiceover-setup | nvda-setup, which ready CI's
// machines for the readers.

require __DIR__ . '/lib.php';
require __DIR__ . '/min.php';
require __DIR__ . '/probes/ws.php';
require __DIR__ . '/probes/chrome.php';
require __DIR__ . '/probes/firefox.php';
require __DIR__ . '/probes/safari.php';
require __DIR__ . '/probes/speech.php';
require __DIR__ . '/probes/voiceover.php';
require __DIR__ . '/probes/nvda.php';
require __DIR__ . '/probes/sheet.php';

const PROBE_ROOT = __DIR__ . '/..';
const PROBE_CONFIG = __DIR__ . '/probes/config.json';
const PROBE_PAGE = __DIR__ . '/probes/page.js';
const PROBE_READ = __DIR__ . '/probes/read.js';
const PROBE_BEHAVE = __DIR__ . '/probes/behave.js';
const PROBE_NULL = PHP_OS_FAMILY === 'Windows' ? 'NUL' : '/dev/null';
const PROBE_SHEET = __DIR__ . '/../.dev/probes';
const PROBE_FORCED_PREFS = ['browser.display.document_color_use' => 2];
// The tallest shot, in CSS px: twice that is the most a 2× phone shot can be, under the engines' 16 384 px canvas.
const PROBE_SHOT_MAX = 8000;
// The longest a cell may run, in seconds: CI's iOS 26 simulator, the slowest engine, spends about a minute on a cell.
const PROBE_CELL_MAX = 300;
// The probe code by the engines that run it, as PROBE__Reach's marks: the engines of a kind, "browser:NAME" for a reader
// in that browser, "behave" for the full pages in the desktop engines. A file of the probes not named here reaches every
// engine.
const PROBE_CODE = [
	'tools/probes/page.js' => ['kind:chrome', 'kind:firefox', 'kind:safari'],
	'tools/probes/behave.js' => ['behave'],
	'tools/probes/ws.php' => ['kind:chrome', 'kind:firefox', 'kind:nvda'],
	'tools/probes/chrome.php' => ['kind:chrome', 'browser:chrome'],
	'tools/probes/firefox.php' => ['kind:firefox', 'browser:firefox'],
	'tools/probes/safari.php' => ['kind:safari', 'kind:voiceover'],
	'tools/probes/speech.php' => ['kind:voiceover', 'kind:nvda'],
	'tools/probes/voiceover.php' => ['kind:voiceover'],
	'tools/probes/nvda.php' => ['kind:nvda'],
	'tools/probes/read.js' => ['kind:nvda'],
	'tools/probes/sheet.php' => [],
	'tools/probes/sheet.css' => [],
];
// The folders of the packages: a file of one, or of what dist/redz-ui-NAME.min.* builds from it, reaches only the pages
// that link those.
const PROBE_PACKAGES = ['charts', 'calendar', 'media', 'editor'];
// The keys of the keyboard walk: the WebDriver code point (Firefox, Safari), the Windows key code and the text (Chrome).
const PROBE_KEYS = ['Enter' => ["\u{E006}", 13, "\r"], 'Space' => ["\u{E00D}", 32, ' '], 'Escape' => ["\u{E00C}", 27, ''], 'Tab' => ["\u{E004}", 9, ''], 'ArrowDown' => ["\u{E015}", 40, ''], 'ArrowUp' => ["\u{E013}", 38, ''], 'ArrowLeft' => ["\u{E012}", 37, ''], 'ArrowRight' => ["\u{E014}", 39, ''], 'Home' => ["\u{E011}", 36, ''], 'End' => ["\u{E010}", 35, ''], 'Backspace' => ["\u{E003}", 8, '']];

/** The folder of fetched engines and packages: $REDZ_UI_CACHE, or ~/Library/Caches/redz-ui, or %LOCALAPPDATA%\redz-ui
 *  on Windows. */
function PROBE__Cache(): string
{
	return (string)(getenv('REDZ_UI_CACHE') ?: (PHP_OS_FAMILY === 'Windows' ? getenv('LOCALAPPDATA') . '\\redz-ui' : getenv('HOME') . '/Library/Caches/redz-ui'));
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
	$proc = proc_open($command, [0 => ['file', PROBE_NULL, 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
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

/** Removes $path and everything under it, if it is there - on Windows by PHP itself, a link removed, never followed. */
function PROBE__Remove(string $path): void
{
	if (!file_exists($path) && !is_link($path)) {
		return;
	}
	if (PHP_OS_FAMILY !== 'Windows') {
		PROBE__Run(['/bin/rm', '-rf', $path]);
		return;
	}
	if (is_dir($path) && !is_link($path)) {
		foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST) as $entry) {
			$entry->isDir() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
		}
		rmdir($path);
		return;
	}
	unlink($path);
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

/** Whether the Mac's screen is locked: Safari draws no frames then. */
function PROBE__ScreenLocked(): bool
{
	return preg_match('~<key>CGSSessionScreenIsLocked</key>\s*<true/>~', PROBE__Run(['/usr/sbin/ioreg', '-n', 'Root', '-d1', '-a'])) === 1;
}

/** The binary that runs engine $name: the installed one, or the one fetched into the cache - fetched now when missing;
 *  '' with the reason in $why when it cannot run on this machine. */
function PROBE__Binary(string $name, array $engine, string &$why): string
{
	// An engine's build for this system, as CI's Linux machines run Chrome and Firefox.
	$engine = array_replace($engine, $engine[strtolower(PHP_OS_FAMILY)] ?? []);
	if (PHP_OS_FAMILY === 'Darwin' && isset($engine['macos']) && preg_match('~^<\s*(\d+)$~', $engine['macos'], $m) === 1 && (int)PROBE__Run(['/usr/bin/sw_vers', '-productVersion']) >= (int)$m[1]) {
		$why = $engine['why'];
		return '';
	}
	if ($engine['kind'] === 'nvda' && ($why = PROBE__NvdaBlocked()) !== '') {
		return '';
	}
	if ($engine['kind'] === 'voiceover') {
		$why = PROBE__VoiceOverBlocked();
		return $why === '' ? PROBE_VOICEOVER : '';
	}
	if ($engine['kind'] === 'safari') {
		$driver = $engine['driver'] ?? '/usr/bin/safaridriver';
		if (!is_file($driver)) {
			$why = isset($engine['driver']) ? 'not installed at ' . $driver : 'no safaridriver on this machine';
			return '';
		}
		if (isset($engine['ios']) && PROBE__IosRuntime($engine) === '') {
			$why = 'no simulator runtime of iOS ' . implode(' or ', (array)$engine['ios']) . ' here';
			return '';
		}
		if (!isset($engine['ios']) && PROBE__ScreenLocked()) {
			$why = 'the screen is locked, and Safari on the Mac draws no frames until it is unlocked';
			return '';
		}
		if (!isset($engine['ios']) && ($why = PROBE__SafariBusy($engine['app'] ?? 'Safari')) !== '') {
			return '';
		}
		return $driver;
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

/** The file of $fetch's url, downloaded once into the cache as $name with its own extension, its sha256 or sha512
 *  checked. */
function PROBE__Download(string $name, array $fetch): string
{
	$downloads = PROBE__Cache() . '/downloads';
	@mkdir($downloads, 0777, true);
	$file = $downloads . '/' . $name . '.' . pathinfo((string)parse_url($fetch['url'], PHP_URL_PATH), PATHINFO_EXTENSION);
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
	return $file;
}

/** Downloads the archive of engine $name and unpacks it into $home: a zip by ditto on a Mac - it keeps an app's links
 *  and modes - and by ZipArchive elsewhere, a disk image by hdiutil. */
function PROBE__Fetch(string $name, array $fetch, string $home): void
{
	$file = PROBE__Download($name, $fetch);
	$part = $home . '.part';
	PROBE__Remove($part);
	mkdir($part, 0777, true);
	if (PHP_OS_FAMILY === 'Linux') {
		PROBE__Run(str_ends_with($file, '.zip') ? ['unzip', '-q', $file, '-d', $part] : ['tar', '-xf', $file, '-C', $part]);
	} elseif (str_ends_with($file, '.zip') && PHP_OS_FAMILY !== 'Darwin') {
		$zip = new ZipArchive();
		if ($zip->open($file) !== true || !$zip->extractTo($part)) {
			throw new RuntimeException($name . ': cannot unpack ' . $file);
		}
		$zip->close();
	} elseif (str_ends_with($file, '.zip')) {
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
	$proc = proc_open([PHP_BINARY, '-S', '127.0.0.1:' . $port, __DIR__ . '/probes/router.php'], [0 => ['file', PROBE_NULL, 'r'], 1 => ['file', $dir . '/server.log', 'a'], 2 => ['file', $dir . '/server.log', 'a']], $pipes, PROBE_ROOT);
	$base = 'http://127.0.0.1:' . $port . '/';
	for ($tries = 0; @file_get_contents($base . 'index.html') === false; $tries++) {
		if ($tries > 50) {
			throw new RuntimeException('the static server did not serve index.html: ' . trim(substr((string)@file_get_contents($dir . '/server.log'), -600)));
		}
		usleep(100000);
	}
	return [$proc, $base];
}

/** Calls the engine driver's $verb (Load, Inject, Eval, Key, Click, Hover, Shot, Print, Errors, Stop) on the handle. A
 *  cell runs from its Load; past PROBE_CELL_MAX the engine is stalling, and the next call throws with the cell and its
 *  slowest call named. */
function PROBE__Do(array &$h, string $verb, mixed ...$args): mixed
{
	$what = $verb . ' ' . substr(json_encode(array_map(fn(mixed $arg): mixed => is_string($arg) && strlen($arg) > 200 ? strlen($arg) . ' bytes' : $arg, $args), JSON_UNESCAPED_SLASHES), 0, 160);
	if (getenv('REDZ_PROBE_TRACE') !== false) {
		fwrite(STDERR, gmdate('H:i:s') . ' ' . $what . "\n");
	}
	if ($verb === 'Load') {
		$h['cell'] = ['page' => (string)preg_replace('~^\w+://[^/]+/~', '', (string)$args[0]) . ' at ' . ($args[1] ?: 'phone'), 'since' => microtime(true), 'slowest' => 0.0, 'call' => ''];
	} elseif ($verb !== 'Stop' && isset($h['cell']) && microtime(true) - $h['cell']['since'] > PROBE_CELL_MAX) {
		throw new RuntimeException(sprintf('%s ran over %d s - the engine is stalling; its slowest call, %.0f s: %s', $h['cell']['page'], PROBE_CELL_MAX, $h['cell']['slowest'], $h['cell']['call']));
	}
	$start = microtime(true);
	$answer = ('PROBE__' . ucfirst($h['kind']) . $verb)($h, ...$args);
	$took = microtime(true) - $start;
	if (isset($h['cell']) && $took > $h['cell']['slowest']) {
		$h['cell']['slowest'] = $took;
		$h['cell']['call'] = $what;
	}
	return $answer;
}

/** Runs every cell of engine $name, then its forced colors and print, into $report; the minifier's cell in the first
 *  share alone. */
function PROBE__EngineRun(string $name, array $engine, string $binary, string $dir, array $run, array &$report): void
{
	if ($engine['kind'] === 'voiceover') {
		PROBE__VoiceOverRun($name, $dir, $run, $report);
		return;
	}
	if ($engine['kind'] === 'nvda') {
		PROBE__NvdaRun($name, $engine, $binary, $dir, $run, $report);
		return;
	}
	$h = match ($engine['kind']) {
		'chrome' => PROBE__ChromeStart($binary, $dir),
		'firefox' => PROBE__FirefoxStart($binary, $dir),
		'safari' => PROBE__SafariStart($dir, isset($engine['ios']) ? PROBE__IosRuntime($engine) : '', $binary, $engine['app'] ?? 'safari'),
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
		if (($run['config']['share'][0] ?? 1) === 1) {
			PROBE__MinCell($h, $name, $run, $report);
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
 * The docs pages beside the config's pages: every page of docs/ but those and the twins, in the config's share.
 * @return list<string>
 */
function PROBE__DocsPages(array $config): array
{
	$pages = [];
	foreach (glob(PROBE_ROOT . '/docs/*.html') ?: [] as $file) {
		$page = 'docs/' . basename($file);
		if (!in_array($page, $config['pages'], true) && !str_ends_with($page, '.ar.html') && (($config['only'] ?? []) === [] || in_array($page, $config['only'], true)) && PROBE__InShare($page, $config['share'] ?? [1, 1])) {
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
			$findings[] = 'the docs mirror of :' . $pair['state'] . ' on ' . $pair['what'] . ' - Tab did not reach it';
		} elseif (!$seen['real']) {
			continue;
		} elseif ($seen['differ'] !== []) {
			$findings[] = 'the docs mirror of :' . $pair['state'] . ' on ' . $pair['what'] . ' differs from the real state: ' . implode('; ', $seen['differ']);
		}
	}
	PROBE__Do($h, 'Eval', 'document.activeElement?.blur() ?? true');
	return $findings;
}

/** One cell - $page at $width × $height (a simulator: its own screen when 0), $theme and $dir, normal, docs or forced
 *  colors: judged; normal or forced at a shot width shot; normal or docs at a shot width its popovers opened and axe
 *  run; normal at 1440 its state mirror checked on the page as loaded, then walked by keyboard and its Arabic fonts
 *  checked. */
function PROBE__Cell(array &$h, string $name, string $page, string $combo, string $theme, string $dir, int $width, int $height, string $mode, array $run, array &$report): void
{
	$forced = $mode === 'forced';
	$shown = PROBE__Shown($page, $dir);
	$label = ($width === 0 ? 'phone' : $width) . ' · ' . $theme . ' · ' . strtoupper($dir) . ($shown !== $page ? ' · Arabic' : '') . ($forced ? ' · forced colors' : '');
	$where = $name . ' ' . $shown . ' ' . $label . ' - ';
	PROBE__Do($h, 'Load', $run['base'] . $shown . '?theme=' . $theme . '&dir=' . $dir, $width, $height, $theme, $forced);
	PROBE__Do($h, 'Inject', $run['page']);
	PROBE__Do($h, 'Eval', 'REDZ_PROBE.prepare(' . json_encode($theme) . ', ' . json_encode($dir) . ')');
	$report['engines'][$name]['cells']++;
	$m = PROBE__Do($h, 'Eval', 'REDZ_PROBE.measure()');
	$findings = [];
	if ($m['scroll'] > $m['client']) {
		$findings[] = 'overflow ' . $m['scroll'] . ' > ' . $m['client'] . ': ' . implode(', ', $m['offenders']);
	}
	foreach (['unmasked' => 'icons without a mask', 'unregioned' => 'width prefixes outside a region', 'cut' => 'cut labels', 'busyLive' => 'aria-busy on or around a live region', 'toggles' => '--toggle buttons whose aria-expanded is not their region\'s state', 'toggleFor' => '--toggle buttons with commandfor, which WebKit exposes as collapsed whatever aria-expanded says', 'tips' => 'tooltip buttons their tooltip does not describe (aria-describedby)','comboboxes' => 'comboboxes whose button, active option or chosen values disagree with their list', 'scrollspies' => 'scrollspy navs without exactly one link at aria-current="location"', 'strengths' => 'data-strength displays whose field is missing', 'edits' => 'inline edit forms whose data-for names no value', 'grips' => 'drag handles outside an item of a data-reorder list', 'uploads' => 'uploads without their file input, zone, template or list'] as $key => $what) {
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
		if ($theme === 'light' && $dir === 'ltr') {
			$findings = [...$findings, ...PROBE__Mirror($h)];
		}
		$walked = [];
		$findings = [...$findings, ...PROBE__KeyWalk($h, $walked), ...PROBE__Notices($h)];
		foreach ($walked as $widget) {
			$report['walked'][$page][$widget][$name] = true;
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
	if ($width === 1440 && $mode === 'normal' && $theme === 'light' && $dir === 'ltr') {
		$walked = [];
		$findings = [...$findings, ...PROBE__Behave($h, $page, $run['base'] . $shown . '?theme=light&dir=ltr', $height, $run, $walked)];
		foreach ($walked as $check) {
			$report['walked'][$page][$check][$name] = true;
		}
	}
	foreach ($findings as $finding) {
		if (!PROBE__FindingAllowed($run['config'], $name, $where . $finding, $report)) {
			$report['findings'][] = $where . $finding;
		}
	}
}

/** The behaviour checks of tools/probes/behave.js whose targets $page has, on the page loaded again from $url - each
 *  check stepped until it answers its findings, its drags made by the engine's own pointer -, and every target found on
 *  docs/all.html, which holds them all; answers the findings with the page's errors, and the checks in $walked. */
function PROBE__Behave(array &$h, string $page, string $url, int $height, array $run, array &$walked): array
{
	PROBE__Do($h, 'Inject', $run['behave']);
	$findings = $page === 'docs/all.html' ? array_map(fn(string $check): string => 'the behaviour check "' . $check . '" finds no target', PROBE__Do($h, 'Eval', 'REDZ_BEHAVE.missing()')) : [];
	$checks = PROBE__Do($h, 'Eval', 'REDZ_BEHAVE.targets()');
	if ($checks === []) {
		return $findings;
	}
	PROBE__Do($h, 'Load', $url, 1440, $height, 'light', false);
	PROBE__Do($h, 'Inject', $run['page']);
	PROBE__Do($h, 'Eval', 'document.fonts.ready.then(() => true)');
	PROBE__Do($h, 'Inject', $run['behave']);
	foreach ($checks as $check) {
		$walked[] = 'the behaviour of ' . $check;
		for ($step = 0; $step < 10; $step++) {
			$answer = PROBE__Do($h, 'Eval', 'REDZ_BEHAVE.step(' . json_encode($check) . ')');
			if (!isset($answer['drag'])) {
				foreach ($answer['findings'] ?? ['answered nothing'] as $finding) {
					$findings[] = 'the behaviour of ' . $check . ': ' . $finding;
				}
				break;
			}
			PROBE__Do($h, 'Drag', ...array_map('intval', $answer['drag']));
			PROBE__Settle($h, 200, true);
		}
	}
	foreach ($h['kind'] === 'safari' ? PROBE__Do($h, 'Eval', 'REDZ_PROBE.errors()') : PROBE__Do($h, 'Errors') as $error) {
		$findings[] = 'error ' . $error . ' (in the behaviour checks)';
	}
	return $findings;
}

/** The keyboard walk of a page: each menu, modal dialog, tab list, accordion and --toggle region driven by real keys
 *  (Enter, then Space, opening and closing an accordion's item; headless Firefox clicks) - and a dialog with
 *  closedby="any" by a click outside it - against the WAI-ARIA patterns; answers its findings, and the widgets it
 *  walked in $walked. */
function PROBE__KeyWalk(array &$h, array &$walked): array
{
	$findings = [];
	$press = function (string $key, int $cap = 0) use (&$h): void {
		PROBE__Do($h, 'Key', $key);
		PROBE__Settle($h, $cap);
	};
	// Headless Firefox on macOS gives the document no focus, so it presses no button by keyboard: it opens by a click.
	$activate = function (string $id, int $cap = 0) use (&$h, $press): void {
		if ($h['kind'] === 'firefox') {
			PROBE__Do($h, 'Click', ...PROBE__Do($h, 'Eval', 'REDZ_PROBE.invokerPoint(' . json_encode($id) . ')'));
			PROBE__Settle($h, $cap);
		} else {
			$press('Enter', $cap);
		}
	};
	foreach (PROBE__Do($h, 'Eval', 'REDZ_PROBE.keyTargets()') as ['kind' => $kind, 'id' => $id, 'outside' => $outside]) {
		$state = fn(): array => PROBE__Do($h, 'Eval', 'REDZ_PROBE.state(' . json_encode($kind) . ', ' . json_encode($id) . ')');
		$what = match ($kind) {
			'tabs' => 'the tab list ' . $id,
			'accordion' => 'the accordion ' . $id,
			default => '#' . $id,
		} . ' by keyboard - ';
		$walked[] = match ($kind) {
			'tabs' => 'a tab list',
			'accordion' => 'an accordion',
			default => '#' . $id . ' (' . $kind . ($outside ? ', a click outside' : '') . ')',
		};
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
			$s = $state();
			if (!$s['open'] || !$s['inside']) {
				$findings[] = $what . 'opening: ' . ($s['open'] ? 'the focus is not inside the dialog' : 'the dialog does not open');
				continue;
			}
			if ($s['search'] !== null) {
				$press('ArrowDown');
				$s = $state();
				if ($s['search']['active'] === null) {
					$findings[] = $what . 'ArrowDown in its search: no option is active';
				}
			}
			for ($i = $s['at']; $i < $s['focusables'] - 1 && !$s['leaked']; $i++) {
				$press('Tab');
				$s = $state();
			}
			if ($s['leaked']) {
				$findings[] = $what . 'Tab: the focus left the open dialog';
			}
			$press('Escape');
			$s = $state();
			if ($s['open'] || !$s['onInvoker']) {
				$findings[] = $what . 'Escape: ' . ($s['open'] ? 'the dialog stays open' : 'the focus is not back on its button');
				continue;
			}
			if ($outside) {
				// The point outside is taken from the dialog's box, which its opening transition still moves.
				$activate($id, 400);
				$point = PROBE__Do($h, 'Eval', 'REDZ_PROBE.outside(' . json_encode($id) . ')');
				if ($point !== null) {
					PROBE__Do($h, 'Click', $point[0], $point[1]);
					PROBE__Settle($h, 0);
					if ($state()['open']) {
						$findings[] = '#' . $id . ' - a click outside it does not close it (closedby="any")';
					}
				}
				PROBE__Do($h, 'Eval', '(document.getElementById(' . json_encode($id) . ').open && document.getElementById(' . json_encode($id) . ').close(), true)');
			}
		} elseif ($kind === 'combobox') {
			$activate($id);
			$s = $state();
			if (!$s['open'] || !$s['onSearch'] || $s['expanded'] !== 'true') {
				$findings[] = $what . 'opening: ' . (!$s['open'] ? 'the panel does not open' : (!$s['onSearch'] ? 'the focus is not in its search' : 'its button says aria-expanded="' . $s['expanded'] . '"'));
				continue;
			}
			if ($s['options'] > 0) {
				$before = $s['values'];
				$press('ArrowDown');
				$s = $state();
				if ($s['active'] === null) {
					$findings[] = $what . 'ArrowDown: no option is active';
					continue;
				}
				$taken = $s['active'];
				$press('Enter');
				$s = $state();
				$values = $s['multiple'] ? (in_array($taken, $before, true) ? array_values(array_diff($before, [$taken])) : [...$before, $taken]) : [$taken];
				if ($s['values'] !== $values || $s['open'] !== $s['multiple']) {
					$findings[] = $what . 'Enter on "' . $taken . '": the values should be ' . json_encode($values) . ' with the panel ' . ($s['multiple'] ? 'open' : 'closed') . ' - they are ' . json_encode($s['values']) . ', the panel ' . ($s['open'] ? 'open' : 'closed');
					continue;
				}
			}
			if ($s['open'] && $s['offers']) {
				$word = 'Probe tag ' . substr(md5($id), 0, 6);
				PROBE__Do($h, 'Eval', 'REDZ_PROBE.typeInto(' . json_encode('#' . $id . ' input[role="combobox"]') . ', ' . json_encode($word) . ')');
				usleep(200000);
				$s = $state();
				if (!$s['activeCreate']) {
					$findings[] = $what . 'a new word in the search: "Create …" is not the active option';
					continue;
				}
				$press('Enter');
				$s = $state();
				if (!in_array($word, $s['created'], true)) {
					$findings[] = $what . 'Enter on "Create …": the new label is not in its field, which holds ' . json_encode($s['created']);
					continue;
				}
			}
			if ($s['open']) {
				$press('Escape');
				$s = $state();
			}
			if ($s['open'] || !$s['onInvoker'] || $s['expanded'] !== 'false') {
				$findings[] = $what . 'closing: ' . ($s['open'] ? 'the panel stays open' : (!$s['onInvoker'] ? 'the focus is not back on its button' : 'its button says aria-expanded="' . $s['expanded'] . '"'));
			}
		} elseif ($kind === 'accordion') {
			$was = in_array($state()['walked'], $state()['open'], true);
			foreach (['Enter', 'Space'] as $step => $key) {
				if ($h['kind'] === 'firefox') {
					PROBE__Do($h, 'Click', ...PROBE__Do($h, 'Eval', 'REDZ_PROBE.summaryPoint(' . json_encode($id) . ')'));
					PROBE__Settle($h, 0);
				} else {
					$press($key);
				}
				$s = $state();
				$open = in_array($s['walked'], $s['open'], true);
				if ($open === ($step === 0 ? $was : !$was)) {
					$findings[] = $what . $key . ': item ' . $s['walked'] . ' ' . ($open ? 'stays open' : 'stays closed');
					break;
				}
				if ($open && $s['grouped'] && $s['open'] !== [$s['walked']]) {
					$findings[] = $what . $key . ': opening item ' . $s['walked'] . ' of a group leaves ' . json_encode($s['open']) . ' open';
					break;
				}
			}
		} elseif ($kind === 'edit') {
			$activate($id);
			$s = $state();
			if (!$s['open'] || !$s['inField']) {
				$findings[] = $what . 'Enter on Edit: ' . ($s['open'] ? 'the focus is not in its field' : 'the form does not open');
				continue;
			}
			$press('Escape');
			$s = $state();
			if ($s['open'] || !$s['valueShown'] || !$s['onInvoker']) {
				$findings[] = $what . 'Escape: ' . ($s['open'] ? 'the form stays open' : (!$s['valueShown'] ? 'the value does not show again' : 'the focus is not back on Edit'));
			}
		} elseif ($kind === 'strength') {
			foreach (['correct horse battery staple', ''] as $typed) {
				PROBE__Do($h, 'Eval', 'REDZ_PROBE.typeInto(' . json_encode('#' . $id) . ', ' . json_encode($typed) . ')');
				usleep(1000000);
				$s = $state();
				$wrong = fn(mixed $shown): bool => ($shown !== null && $shown !== '' && $shown !== 0 && $shown !== 0.0) !== ($typed !== '');
				if (($s['levels'] === [] && $s['words'] === []) || array_filter([...$s['levels'], ...$s['valuetexts'], ...$s['words']], $wrong) !== []) {
					$findings[] = $what . ($typed === '' ? 'the field emptied' : 'a password typed') . ': its meters show ' . json_encode($s['levels']) . ' said as ' . json_encode($s['valuetexts']) . ', its words ' . json_encode($s['words']);
					break;
				}
			}
		} elseif ($kind === 'trees') {
			$activate($id);
			$s = $state();
			if ($s['open'] !== $s['groups'] || $s['said'] !== $s['groups']) {
				$findings[] = $what . 'Expand all: ' . $s['open'] . ' of ' . $s['groups'] . ' groups open, ' . $s['said'] . ' toggles saying so';
				continue;
			}
			PROBE__Do($h, 'Eval', '(document.querySelector(' . json_encode('[commandfor="' . $id . '"][command="--collapse-all"]') . ').click(), true)');
			$s = $state();
			if ($s['open'] !== 0 || $s['said'] !== $s['groups']) {
				$findings[] = $what . 'Collapse all: ' . $s['open'] . ' of ' . $s['groups'] . ' groups still open, ' . $s['said'] . ' toggles saying their state';
			}
		} elseif ($kind === 'reorder') {
			$before = $state()['order'];
			if ($h['kind'] === 'firefox') {
				PROBE__Do($h, 'Click', ...PROBE__Do($h, 'Eval', 'REDZ_PROBE.gripPoint(' . json_encode($id) . ')'));
				PROBE__Settle($h, 0);
			} else {
				$press('Enter');
			}
			$s = $state();
			if (!$s['open'] || !PROBE__Do($h, 'Eval', 'REDZ_PROBE.pickMove(' . json_encode($id) . ', "down")')) {
				$findings[] = $what . 'Enter on its first handle: ' . ($s['open'] ? 'its menu has no "down"' : 'the menu of moves does not open');
				continue;
			}
			if ($h['kind'] === 'firefox') {
				PROBE__Do($h, 'Click', ...PROBE__Do($h, 'Eval', 'REDZ_PROBE.movePoint(' . json_encode($id) . ', "down")'));
				PROBE__Settle($h, 0);
			} else {
				$press('Enter');
			}
			$s = $state();
			$moved = [$before[1], $before[0], ...array_slice($before, 2)];
			if ($s['order'] !== $moved || !$s['onGrip'] || $s['said'] === '' || $s['open']) {
				$findings[] = $what . 'Move down: the order should be ' . json_encode($moved) . ', the focus on the moved handle and the move said - it is ' . json_encode($s['order']) . ($s['onGrip'] ? '' : ', the focus elsewhere') . ($s['said'] === '' ? ', nothing said' : '') . ($s['open'] ? ', the menu still open' : '');
			}
		} elseif ($kind === 'upload') {
			PROBE__Do($h, 'Eval', 'REDZ_PROBE.chooseFiles(' . json_encode($id) . ')');
			usleep(300000);
			$s = $state();
			if (!$s['multiple']) {
				$first = $s['rows'];
				PROBE__Do($h, 'Eval', 'REDZ_PROBE.chooseFiles(' . json_encode($id) . ', 2)');
				usleep(300000);
				$s = $state();
				if (count($first) !== 1 || $first[0]['state'] !== 'failed' || $first[0]['error'] === '' || count($s['rows']) !== 1 || !in_array($s['rows'][0]['state'], ['sending', 'done', 'ready'], true)) {
					$findings[] = $what . 'one file at a time: of two chosen the first, refused, and then a good one in its place - the rows say ' . json_encode($first) . ', then ' . json_encode($s['rows']);
					continue;
				}
			} else {
				$rows = array_slice($s['rows'], -2);
				if (count($rows) !== 2 || !in_array($rows[0]['state'], ['sending', 'done', 'ready'], true) || $rows[1]['state'] !== 'failed' || $rows[1]['error'] === '') {
					$findings[] = $what . 'two files chosen, one it takes and one it refuses: their rows say ' . json_encode($rows);
					continue;
				}
			}
			$count = count($s['rows']);
			PROBE__Do($h, 'Eval', '(document.getElementById(' . json_encode($id) . ').querySelector(".upload-list > :last-child [data-file-remove]").click(), true)');
			$s = $state();
			if (count($s['rows']) !== $count - 1 || !($s['onRemove'] || $s['onZone'])) {
				$findings[] = $what . 'Remove on a file: ' . (count($s['rows']) === $count ? 'the row stays' : 'the focus is on neither the next file nor the zone');
			}
		} elseif ($kind === 'reveal') {
			foreach (['text' => 'true', 'password' => 'false'] as $type => $pressed) {
				$activate($id);
				$s = $state();
				if ($s['type'] !== $type || $s['pressed'] !== $pressed) {
					$findings[] = $what . 'Enter: the field should be ' . $type . ', its button aria-pressed="' . $pressed . '" - it is ' . $s['type'] . ', aria-pressed="' . $s['pressed'] . '"';
					break;
				}
			}
		} elseif ($kind === 'toggle') {
			$was = $state()['open'];
			foreach ([!$was, $was] as $open) {
				$activate($id);
				$s = $state();
				// A group whose children load keeps its button busy, deaf to presses, until they are in.
				for ($waited = 0; $s['busy'] && $waited < 30; $waited++) {
					usleep(100000);
					$s = $state();
				}
				if ($s['open'] !== $open || $s['expanded'] !== ($open ? 'true' : 'false')) {
					$findings[] = $what . 'Enter: the region should be ' . ($open ? 'open' : 'closed') . ' - it is ' . ($s['open'] ? 'open' : 'closed') . ', its button says aria-expanded="' . $s['expanded'] . '"';
					break;
				}
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
						$findings[] = $what . $key . ' (manual activation): the focus should move to tab ' . $tab . ' and the selection stay on ' . $start . ' - selected ' . json_encode($s['selected']) . ', focused ' . $s['focused'];
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
					$findings[] = $what . $key . ($s['manual'] ? ' and Enter' : '') . ': tab ' . $tab . ' should be selected, focused and its panel alone shown - selected ' . json_encode($s['selected']) . ', focused ' . $s['focused'] . ', shown ' . json_encode($s['shown']);
					break;
				}
			}
		}
	}
	return $findings;
}

/** Waits for the page to come to rest after an input of the probe: two frames drawn, every state it reads then set;
 *  with a $cap, the animations and transitions of its layers - with $all of anything - done too, at most $cap ms of
 *  them (REDZ_PROBE.settle). */
function PROBE__Settle(array &$h, int $cap, bool $all = false): void
{
	PROBE__Do($h, 'Eval', 'REDZ_PROBE.settle(' . $cap . ', ' . json_encode($all) . ')');
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

/** The key a report marks an exception of the config used by: the exception's own text, hashed, wherever it stands
 *  in the list. */
function PROBE__AllowKey(array $entry): string
{
	return 'x' . substr(sha1((string)json_encode($entry, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)), 0, 16);
}

/** Whether an exception of the probes' config allows axe rule $rule at $target in engine $engine; marks it used. */
function PROBE__AxeAllowed(array $config, string $engine, string $rule, string $target, array &$report): bool
{
	foreach ($config['allow'] as $entry) {
		if (($entry['rule'] ?? null) === $rule && str_contains($target, $entry['target']) && in_array($engine, $entry['engines'] ?? [$engine], true)) {
			$report['used'][PROBE__AllowKey($entry)] = true;
			return true;
		}
	}
	return false;
}

/** Whether an exception of the config - {"finding": a part of its text, "engines", "reason"} - allows the finding
 *  $text of engine $engine; marks the exception used. */
function PROBE__FindingAllowed(array $config, string $engine, string $text, array &$report): bool
{
	foreach ($config['allow'] as $entry) {
		if (isset($entry['finding']) && str_contains($text, $entry['finding']) && in_array($engine, $entry['engines'] ?? [$engine], true)) {
			$report['used'][PROBE__AllowKey($entry)] = true;
			return true;
		}
	}
	return false;
}

/**
 * The minifier in this engine: every script of tools/min/ answers the same as written and as tools/min.php writes
 * it, and the release's stylesheet, each package's and tools/min/hostile.css give the engine the same rules squeezed
 * as written.
 */
function PROBE__MinCell(array &$h, string $name, array $run, array &$report): void
{
	$answer = function (string $code) use (&$h): mixed {
		PROBE__Do($h, 'Load', 'about:blank', 1280, 900, 'light', false);
		return PROBE__Do($h, 'Eval', "(async () => {'use strict';\n" . $code . "\nreturn globalThis.REDZ_MIN_RESULT;})()");
	};
	foreach (glob(PROBE_ROOT . '/tools/min/*.js') ?: [] as $file) {
		$source = (string)file_get_contents($file);
		try {
			$written = $answer($source);
			$minified = $answer(MIN__JsNamesSafe(MIN__JsSafe($source)));
		} catch (RuntimeException $e) {
			$report['findings'][] = $name . ' tools/min/' . basename($file) . ' - ' . $e->getMessage();
			continue;
		}
		if ($written !== $minified) {
			$report['findings'][] = $name . ' tools/min/' . basename($file) . ' answers ' . substr((string)json_encode($minified, JSON_UNESCAPED_UNICODE), 0, 300) . ' minified, ' . substr((string)json_encode($written, JSON_UNESCAPED_UNICODE), 0, 300) . ' as written';
		}
	}
	$passport = json_decode((string)file_get_contents(PROBE_ROOT . '/redz-ui.json'), true, 512, JSON_THROW_ON_ERROR);
	$hostile = (string)file_get_contents(PROBE_ROOT . '/tools/min/hostile.css');
	$sheets = [
		$passport['dist']['css'] => [implode("\n", array_map(fn(string $file): string => (string)file_get_contents(PROBE_ROOT . '/' . $file), $passport['css'])), (string)file_get_contents(PROBE_ROOT . '/' . $passport['dist']['css'])],
		'tools/min/hostile.css' => [$hostile, MIN__CssSafe($hostile)],
	];
	foreach (PROBE_PACKAGES as $package) {
		foreach (glob(PROBE_ROOT . '/' . $package . '/*.css') ?: [] as $file) {
			$css = (string)file_get_contents($file);
			$sheets[$package . '/' . basename($file)] = [$css, MIN__CssSafe($css)];
		}
	}
	PROBE__Do($h, 'Load', 'about:blank', 1280, 900, 'light', false);
	foreach ($sheets as $file => $pair) {
		[$written, $squeezed] = array_map(fn(string $css): mixed => PROBE__Do($h, 'Eval', '((text) => { const out = []; const walk = (rules) => { for (const rule of rules) { const nested = rule.cssRules?.length > 0; out.push(nested ? rule.cssText.slice(0, rule.cssText.indexOf("{")) : rule.cssText); if (nested) { walk(rule.cssRules); } } }; const sheet = new CSSStyleSheet(); sheet.replaceSync(text); walk(sheet.cssRules); return out; })(' . json_encode($css, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . ')'), $pair);
		$at = 0;
		while ($at < count($written) && ($written[$at] ?? null) === ($squeezed[$at] ?? null)) {
			$at++;
		}
		if ($at < max(count($written), count($squeezed))) {
			$report['findings'][] = $name . ' ' . $file . ' squeezed gives the rule ' . substr((string)($squeezed[$at] ?? 'none'), 0, 200) . ' for ' . substr((string)($written[$at] ?? 'none'), 0, 200);
		}
	}
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
	// A run of chosen pages leaves the other pages' exceptions unused by design, and so does an engine that ran some of
	// its shares only.
	$partial = array_keys(array_filter($report['share'] ?? [], fn(array $shares): bool => count(array_unique($shares)) < PROBE__ShareOf($shares[0])[1]));
	foreach (($report['only'] ?? []) === [] ? $config['allow'] : [] as $entry) {
		$engines = $entry['engines'] ?? array_keys($config['engines']);
		if (!isset($report['used'][PROBE__AllowKey($entry)]) && array_diff($engines, $ran) === [] && array_intersect($engines, $partial) === []) {
			$report['findings'][] = 'tools/probes/config.json - the exception ' . ($entry['finding'] ?? $entry['rule'] . ' at ' . $entry['target']) . ' allows nothing any more';
		}
	}
	foreach ($report['findings'] as $finding) {
		echo $finding, "\n";
	}
	echo count($report['findings']) === 0 ? 'CLEAN' : count($report['findings']) . ' findings', ' · sheet .dev/probes/index.html', "\n";
	return $report['findings'] === [] ? 0 : 1;
}

/** merge: one sheet of the sheets in $dirs - their reports joined, their shots, prints and logs copied, the commit each
 *  engine was checked on kept in "from"; the exit code. On a $base sheet (the part's sheet on the commit it stands
 *  on): the base whole, each page the part checked again taken from it instead. */
function PROBE__Merge(array $config, array $dirs, string $base = ''): int
{
	$work = PROBE_SHEET . '.new';
	PROBE__Remove($work);
	$report = null;
	$from = [];
	if ($base !== '') {
		$under = json_decode((string)@file_get_contents($base . '/report.json'), true);
		if (!is_array($under)) {
			fwrite(STDERR, $base . '/report.json is missing or not a report' . "\n");
			return 2;
		}
		foreach (['shots', 'print', 'logs'] as $folder) {
			@mkdir($work . '/' . $folder, 0777, true);
			foreach (glob($base . '/' . $folder . '/*') ?: [] as $file) {
				copy($file, $work . '/' . $folder . '/' . basename($file));
			}
		}
	}
	foreach ($dirs as $dir) {
		$part = json_decode((string)@file_get_contents($dir . '/report.json'), true);
		if (!is_array($part)) {
			fwrite(STDERR, $dir . '/report.json is missing or not a report' . "\n");
			return 2;
		}
		foreach ($part['from'] ?? [$part['commit'] => array_keys($part['engines'])] as $commit => $engines) {
			$from[$commit] = array_values(array_unique([...$from[$commit] ?? [], ...$engines]));
		}
		if ($report === null) {
			$report = $part;
		} else {
			// The shares of one engine are one engine of the sheet, its cells theirs together.
			foreach ($part['engines'] as $engine => $entry) {
				$report['engines'][$engine] = isset($report['engines'][$engine]) ? ['cells' => $report['engines'][$engine]['cells'] + $entry['cells']] + $report['engines'][$engine] : $entry;
			}
			$report['share'] = array_merge_recursive($report['share'] ?? [], $part['share'] ?? []);
			$report['skipped'] += $part['skipped'];
			$report['used'] += $part['used'];
			$report['findings'] = [...$report['findings'], ...$part['findings']];
			$report['guarded'] = [...$report['guarded'], ...$part['guarded']];
			$report['walked'] = array_replace_recursive($report['walked'], $part['walked']);
			$report['spoken'] = array_merge_recursive($report['spoken'], $part['spoken']);
			$report['read'] = array_merge_recursive($report['read'] ?? [], $part['read'] ?? []);
			$report['shots'] = array_merge_recursive($report['shots'], $part['shots']);
			$report['only'] = array_values(array_unique([...$report['only'] ?? [], ...$part['only'] ?? []]));
		}
		foreach (['shots', 'print', 'logs'] as $folder) {
			@mkdir($work . '/' . $folder, 0777, true);
			foreach (glob($dir . '/' . $folder . '/*') ?: [] as $file) {
				copy($file, $work . '/' . $folder . '/' . basename($file));
			}
		}
	}
	if ($report === null && $base === '') {
		fwrite(STDERR, "merge needs the folders of the sheets to join\n");
		return 2;
	}
	try {
		$commit = trim(PROBE__Run(['git', '-C', PROBE_ROOT, 'rev-parse', '--short', 'HEAD']));
	} catch (RuntimeException) {
		$commit = '';
	}
	if ($base === '' && count($dirs) > 1) {
		$report['when'] = gmdate('Y-m-d H:i') . ' UTC';
		$report['commit'] = $commit === '' ? 'no commit' : 'commit ' . $commit;
		$report['from'] = $from;
	}
	if ($base !== '') {
		$fresh = $report ?? ['when' => gmdate('Y-m-d H:i') . ' UTC', 'commit' => $commit === '' ? 'no commit' : 'commit ' . $commit, 'engines' => [], 'skipped' => [], 'findings' => [], 'guarded' => [], 'walked' => [], 'spoken' => [], 'read' => [], 'shots' => [], 'used' => [], 'only' => []];
		$report = ['when' => $fresh['when'], 'commit' => $fresh['commit'], 'base' => $under['commit'], 'delta' => $fresh['only'] ?? []] + $under;
		unset($report['from']);
		$report['engines'] = $fresh['engines'] + $under['engines'];
		$report['skipped'] = $fresh['skipped'] + $under['skipped'];
		$report['used'] = $fresh['used'] + $under['used'];
		$report['findings'] = [...$under['findings'], ...$fresh['findings']];
		$report['guarded'] = [...$under['guarded'], ...$fresh['guarded']];
		foreach (['walked', 'spoken', 'read', 'shots'] as $key) {
			$report[$key] = array_replace($under[$key] ?? [], $fresh[$key] ?? []);
		}
		$report['only'] = [];
	}
	$status = PROBE__Verdict($config, $report);
	PROBE__SheetWrite($work, $report);
	file_put_contents($work . '/report.json', json_encode($report, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
	PROBE__Remove(PROBE_SHEET);
	rename($work, PROBE_SHEET);
	return $status;
}

/**
 * The config narrowed to the $pages of a run of chosen pages: its full pages, docs pages and speech pages among them.
 * @param list<string> $pages
 */
function PROBE__Only(array $config, array $pages): array
{
	$known = [...$config['pages'], ...PROBE__DocsPages($config), ...array_keys($config['speech'])];
	$unknown = array_diff($pages, $known);
	if ($unknown !== []) {
		throw new InvalidArgumentException('no page ' . implode(', ', $unknown) . ' among the probes\' pages: the full pages of the config, docs/*.html, the speech pages');
	}
	$config['pages'] = array_values(array_intersect($config['pages'], $pages));
	$config['speech'] = array_intersect_key($config['speech'], array_flip($pages));
	$config['only'] = array_values($pages);
	return $config;
}

/** The share "K/N" as [K, N], or null when it is not one: the K-th of N, 1 ≤ K ≤ N.
 *  @return array{int, int}|null */
function PROBE__ShareOf(string $share): ?array
{
	return preg_match('~^([1-9]\d*)/([1-9]\d*)$~', $share, $m) === 1 && (int)$m[1] <= (int)$m[2] ? [(int)$m[1], (int)$m[2]] : null;
}

/** Whether $page falls in the share [K, N]: by a hash of its name alone, so a page stays in its share whatever pages
 *  come or go - a part that stands on a commit holds the same pages after it. */
function PROBE__InShare(string $page, array $share): bool
{
	return crc32($page) % $share[1] === $share[0] - 1;
}

/** The config narrowed to the share [K, N] of its pages: its full pages, docs pages and speech pages in that share. */
function PROBE__Share(array $config, array $share): array
{
	$config['pages'] = array_values(array_filter($config['pages'], fn(string $page): bool => PROBE__InShare($page, $share)));
	$config['speech'] = array_filter($config['speech'], fn(string $page): bool => PROBE__InShare($page, $share), ARRAY_FILTER_USE_KEY);
	$config['share'] = $share;
	return $config;
}

/** Every page some engine runs: the config's full pages, the docs pages, the speech pages.
 *  @return list<string> */
function PROBE__KnownPages(array $config): array
{
	return array_values(array_unique([...$config['pages'], ...PROBE__DocsPages($config), ...array_keys($config['speech'])]));
}

/**
 * What a file changed since $base asks of the probes, as marks: none when they read nothing of it (texts, skills, the
 * build and release tools, the passport, the sheet's own code); "page:P" for a page, and for each page that loads a
 * package's file; what PROBE_CODE says for the probe code and PROBE__ConfigReach for the config; "*" for every engine
 * and page - the stylesheets, the scripts, the icons, the probe's core, anything else.
 * @return list<string>
 */
function PROBE__Reach(array $config, string $base, string $file): array
{
	$inert = '~\.md$|^skills/|^llms(-full)?\.txt$|^(LICENSE|NOTICE|\.gitignore|redz-ui\.json)$|^tools/(build|release|map|docs|floor|dashes)\.php$|^tools/(map|floor)/|^tools/(docs|vocabulary)\.json$|^docs/ar\.tsv$|^\.github/workflows/(check|pages|rerun|probe-part)\.yml$~';
	if (preg_match($inert, $file) === 1) {
		return [];
	}
	if (preg_match('~^(index\.html)$|^docs/src/([\w-]+)\.html$|^(docs|reference/demo)/([\w-]+?)(\.ar)?\.html$~', $file, $m) === 1) {
		return ['page:' . match (true) {
			($m[1] ?? '') !== '' => 'index.html',
			($m[2] ?? '') !== '' => 'docs/' . $m[2] . '.html',
			default => $m[3] . '/' . $m[4] . '.html',
		}];
	}
	if (array_key_exists($file, PROBE_CODE)) {
		return PROBE_CODE[$file];
	}
	if ($file === 'tools/probes/config.json') {
		return PROBE__ConfigReach($config, $base);
	}
	if (preg_match('~\.(css|js)$~', $file) === 1 && is_file(PROBE_ROOT . '/' . $file) && PROBE__CommentsOnly($base, $file)) {
		return [];
	}
	$folder = (string)strstr($file, '/', true);
	$package = in_array($folder, PROBE_PACKAGES, true) ? $folder : (preg_match('~^dist/redz-ui-([a-z]+)~', $file, $m) === 1 && in_array($m[1], PROBE_PACKAGES, true) ? $m[1] : '');
	if ($package !== '') {
		return array_map(fn(string $page): string => 'page:' . $page, array_values(array_filter(PROBE__KnownPages($config), fn(string $page): bool => preg_match('~/redz-ui-' . $package . '[.-]~', (string)@file_get_contents(PROBE_ROOT . '/' . $page)) === 1)));
	}
	return ['*'];
}

/**
 * What the config's change since $base reaches, as PROBE__Reach's marks: the engine whose entry changed; the page whose
 * speech steps changed, or every reader when a page lost them all; the engines an exception added or removed names
 * (every engine for one that names none); the NVDA engines for NVDA's settings; everything for any other key.
 * @return list<string>
 */
function PROBE__ConfigReach(array $config, string $base): array
{
	try {
		$old = json_decode(PROBE__Run(['git', '-C', PROBE_ROOT, 'show', $base . ':tools/probes/config.json']), true, 512, JSON_THROW_ON_ERROR);
	} catch (RuntimeException | JsonException) {
		return ['*'];
	}
	$reach = [];
	foreach (array_unique([...array_keys($old), ...array_keys($config)]) as $key) {
		$was = $old[$key] ?? [];
		$is = $config[$key] ?? [];
		if ($was === $is) {
			continue;
		}
		if ($key === 'engines' || $key === 'speech') {
			foreach (array_unique([...array_keys($was), ...array_keys($is)]) as $name) {
				if (($was[$name] ?? null) !== ($is[$name] ?? null)) {
					$reach = [...$reach, ...($key === 'engines' ? ['engine:' . $name] : (isset($is[$name]) ? ['speech:' . $name] : ['kind:voiceover', 'kind:nvda']))];
				}
			}
		} elseif ($key === 'allow') {
			$entries = fn(array $list): array => array_map(fn(array $entry): string => json_encode($entry), $list);
			foreach (array_merge(array_diff($entries($was), $entries($is)), array_diff($entries($is), $entries($was))) as $entry) {
				$reach = [...$reach, ...array_map(fn(string $name): string => 'engine:' . $name, json_decode($entry, true)['engines'] ?? ['*'])];
			}
		} else {
			$reach[] = $key === 'nvda' ? 'kind:nvda' : '*';
		}
	}
	return array_values(array_unique(array_map(fn(string $mark): string => $mark === 'engine:*' ? '*' : $mark, $reach)));
}

/** Whether the stylesheet or script $file changed since $base in its comments alone - a whole-line comment, a banner,
 *  a docblock's line in a script -, which no engine renders or runs. */
function PROBE__CommentsOnly(string $base, string $file): bool
{
	$diff = PROBE__Run(['git', '-C', PROBE_ROOT, 'diff', '-U0', '--no-color', $base, 'HEAD', '--', $file]);
	$comment = str_ends_with($file, '.js') ? '~^[+-]\s*(/\*.*\*/|//.*|\*( .*)?|\*/)?\s*$~' : '~^[+-]\s*(/\*.*\*/)?\s*$~';
	foreach (explode("\n", $diff) as $line) {
		if (preg_match('~^[+-]~', $line) === 1 && !str_starts_with($line, '+++') && !str_starts_with($line, '---') && preg_match($comment, $line) !== 1) {
			return false;
		}
	}
	return true;
}

/**
 * The pages engine $name runs: a reader's speech pages, a simulator's full pages, a docs engine's full and docs pages,
 * any other engine's full pages.
 * @return list<string>
 */
function PROBE__EnginePages(array $config, string $name): array
{
	$engine = $config['engines'][$name];
	return match (true) {
		in_array($engine['kind'], ['voiceover', 'nvda'], true) => array_keys($config['speech']),
		isset($engine['ios']) => $config['pages'],
		in_array($name, $config['docs']['engines'], true) => [...$config['pages'], ...PROBE__DocsPages($config)],
		default => $config['pages'],
	};
}

/** Each file changed between the commit $base and HEAD, with what it asks of the probes (PROBE__Reach's marks).
 *  @return array<string, list<string>> */
function PROBE__Changed(array $config, string $base): array
{
	$changed = [];
	foreach (array_filter(explode("\n", PROBE__Run(['git', '-C', PROBE_ROOT, 'diff', '--name-only', $base, 'HEAD']))) as $file) {
		$changed[$file] = PROBE__Reach($config, $base, $file);
	}
	return $changed;
}

/**
 * What the changed files $changed ask of a part of CI, whose engines are $part['engines'], in its $part['share'] of the
 * pages when it has one: "full" - every page of its engines, as a file reaches the whole of one, or a page no engine
 * knows -, "pages" with the pages of its engines they reach - "behave" the full pages of a desktop browser -, or "none".
 * @param array<string, list<string>> $changed
 * @return array{mode: string, pages: list<string>}
 */
function PROBE__PartRun(array $config, array $changed, array $part): array
{
	$known = PROBE__KnownPages($config);
	$share = PROBE__ShareOf($part['share'] ?? '');
	$config = $share === null ? $config : PROBE__Share($config, $share);
	$pages = [];
	foreach (array_unique(array_merge([], ...array_values($changed))) as $mark) {
		[$what, $value] = explode(':', $mark, 2) + [1 => ''];
		foreach (preg_split('~\s+~', trim($part['engines'])) as $name) {
			$engine = $config['engines'][$name] ?? null;
			$full = $engine === null || match ($what) {
				'*' => true,
				'kind' => $engine['kind'] === $value,
				'browser' => ($engine['browser'] ?? '') === $value,
				'engine' => $name === $value,
				'page' => !in_array($value, $known, true),
				default => false,
			};
			if ($full) {
				return ['mode' => 'full', 'pages' => []];
			}
			$reader = in_array($engine['kind'], ['voiceover', 'nvda'], true);
			if (($what === 'page' || ($what === 'speech' && $reader)) && in_array($value, PROBE__EnginePages($config, $name), true)) {
				$pages[] = $value;
			}
			if ($what === 'behave' && !$reader && !isset($engine['ios'])) {
				$pages = [...$pages, ...$config['pages']];
			}
		}
	}
	$pages = array_values(array_unique($pages));
	return ['mode' => $pages === [] ? 'none' : 'pages', 'pages' => $pages];
}

/** affected: what the files changed since the commit $base ask of each of CI's parts ($all, the workflow's list; each
 *  engine a part of its own when it is empty), as JSON - each part's mode and pages, and each file's marks; the exit
 *  code. */
function PROBE__Affected(array $config, string $base, array $all): int
{
	try {
		$changed = PROBE__Changed($config, $base);
	} catch (RuntimeException $e) {
		fwrite(STDERR, $e->getMessage() . "\n");
		return 2;
	}
	$all = $all ?: array_map(fn(string $name): array => ['name' => $name, 'engines' => $name], array_keys($config['engines']));
	$parts = [];
	foreach ($all as $part) {
		$parts[$part['name']] = PROBE__PartRun($config, $changed, $part);
	}
	echo json_encode(['parts' => $parts, 'files' => $changed], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), "\n";
	return 0;
}

/** Answers the output of the GitHub CLI run with $args, decoded from JSON when $json. */
function PROBE__Gh(array $args, bool $json = false): mixed
{
	$out = PROBE__Run(['gh', ...$args]);
	return $json ? json_decode($out, true, 512, JSON_THROW_ON_ERROR) : $out;
}

/**
 * plan: what a run of the Probes workflow checks, written to $GITHUB_OUTPUT for its jobs; its parts are $ALL. A manual
 * run naming parts ($WANTED) or pages ($PAGES) is a lab run: those parts, those pages, and it never counts. Any other
 * run takes each part where it stands - the nearest commit, this one first, then its first parents, on which a run left
 * that part clean, by that run's artifact "standing" - and runs it again only on what the files changed since then ask
 * of it: every page, some pages (merged into the sheet it stands on), or none. The outputs: "mode" (lab, run or none),
 * "parts" (the parts that run, each with its "pages", '' for all, and "base_run", the run holding the sheet its pages
 * go into) and "standing" (each part that does not run, with the run that holds its sheet); the exit code.
 */
function PROBE__Plan(array $config): int
{
	$all = json_decode((string)getenv('ALL'), true) ?: [];
	$wanted = preg_split('~\s+~', trim((string)getenv('WANTED')), -1, PREG_SPLIT_NO_EMPTY);
	$pages = trim((string)getenv('PAGES'));
	$repo = (string)getenv('GH_REPO');
	$run = [];
	$standing = [];
	$summary = [];
	if (getenv('GITHUB_EVENT_NAME') === 'workflow_dispatch' && ($wanted !== [] || $pages !== '')) {
		$mode = 'lab';
		foreach ($all as $part) {
			if ($wanted === [] || in_array($part['name'], $wanted, true)) {
				$run[] = $part + ['pages' => $pages, 'base_run' => ''];
			}
		}
		if ($run === []) {
			fwrite(STDERR, 'no part is named ' . implode(' ', $wanted) . "\n");
			return 1;
		}
		$summary[] = 'A lab run of ' . implode(', ', array_column($run, 'name')) . ' on ' . ($pages === '' ? 'every page' : $pages) . ': it never counts as passed.';
	} else {
		$artifacts = [];
		$names = function (string $id) use (&$artifacts, $repo): array {
			return $artifacts[$id] ??= PROBE__Gh(['api', 'repos/' . $repo . '/actions/runs/' . $id . '/artifacts?per_page=100', '--jq', '[.artifacts[] | select(.expired | not) | .name]'], true);
		};
		$runs = [];
		foreach (PROBE__Gh(['run', 'list', '--workflow', 'probes.yml', '--status', 'completed', '--limit', '200', '--json', 'databaseId,headSha'], true) as ['databaseId' => $id, 'headSha' => $sha]) {
			$runs[$sha][] = (string)$id;
		}
		$stands = [];
		$standsOn = function (string $sha) use (&$stands, $names, $runs): array {
			if (isset($stands[$sha])) {
				return $stands[$sha];
			}
			$stands[$sha] = [];
			foreach ($runs[$sha] ?? [] as $id) {
				if (!in_array('standing', $names($id), true)) {
					continue;
				}
				$dir = sys_get_temp_dir() . '/redz-ui-standing-' . $id;
				PROBE__Remove($dir);
				PROBE__Gh(['run', 'download', $id, '--name', 'standing', '--dir', $dir]);
				foreach (json_decode((string)@file_get_contents($dir . '/standing.json'), true)['parts'] ?? [] as $part => $holder) {
					if (!isset($stands[$sha][$part]) && in_array('part-' . $part, $names((string)$holder), true)) {
						$stands[$sha][$part] = (string)$holder;
					}
				}
				PROBE__Remove($dir);
			}
			return $stands[$sha];
		};
		$commits = array_values(array_filter(explode("\n", PROBE__Run(['git', '-C', PROBE_ROOT, 'rev-list', '--first-parent', '--max-count=31', 'HEAD']))));
		$changed = [];
		foreach ($all as $part) {
			$base = null;
			foreach ($commits as $sha) {
				$holder = $standsOn($sha)[$part['name']] ?? null;
				if ($holder !== null) {
					$base = [$sha, $holder];
					break;
				}
			}
			if ($base === null) {
				$run[] = $part + ['pages' => '', 'base_run' => ''];
				$summary[] = '- ' . $part['name'] . ': it stands on none of the last ' . count($commits) . ' commits - every page.';
				continue;
			}
			[$sha, $holder] = $base;
			$changed[$sha] ??= PROBE__Changed($config, $sha);
			$verdict = PROBE__PartRun($config, $changed[$sha], $part);
			$on = substr($sha, 0, 7) . ' (run ' . $holder . ')';
			if ($verdict['mode'] === 'none') {
				$standing[$part['name']] = $holder;
				$summary[] = '- ' . $part['name'] . ': it stands on ' . $on . ' - nothing changed reaches it.';
			} else {
				$run[] = $part + ['pages' => implode(',', $verdict['pages']), 'base_run' => $verdict['mode'] === 'pages' ? $holder : ''];
				$summary[] = '- ' . $part['name'] . ': it stands on ' . $on . ' - ' . ($verdict['mode'] === 'pages' ? 'again on ' . implode(', ', $verdict['pages']) : 'every page again') . '.';
			}
		}
		foreach ($changed as $sha => $files) {
			$summary[] = '';
			$summary[] = 'Changed since ' . substr($sha, 0, 7) . ':';
			foreach ($files as $file => $marks) {
				$summary[] = '- `' . $file . '`: ' . ($marks === [] ? 'the probes read none of it' : implode(', ', $marks));
			}
		}
		$mode = $run === [] ? 'none' : 'run';
	}
	// No part runs: the matrix still gets a list, as GitHub reads it before the job's condition.
	$outputs = ['mode' => $mode, 'parts' => json_encode($run === [] ? $all : $run, JSON_UNESCAPED_SLASHES), 'standing' => json_encode((object)$standing, JSON_UNESCAPED_SLASHES)];
	file_put_contents((string)getenv('GITHUB_OUTPUT') ?: 'php://stdout', implode('', array_map(fn(string $key, string $value): string => $key . '=' . $value . "\n", array_keys($outputs), $outputs)), FILE_APPEND);
	file_put_contents((string)getenv('GITHUB_STEP_SUMMARY') ?: 'php://stderr', implode("\n", $summary) . "\n", FILE_APPEND);
	return 0;
}

/**
 * gather: one sheet of every part of the run in .dev/probes - each part's sheet from this run when it ran here ($RAN,
 * the plan's parts, unless $MODE is none) or from the run it stands on ($STANDING) - and, unless a lab run,
 * .dev/standing/standing.json naming the parts clean in it with the run that holds each one's sheet, and
 * .dev/verified/verified.json when every part of $ALL is and the sheet is clean; the sheet's exit code, or 1 when a
 * part's sheet cannot be had.
 */
function PROBE__Gather(array $config): int
{
	$mode = (string)getenv('MODE');
	$id = (string)getenv('GITHUB_RUN_ID');
	$all = json_decode((string)getenv('ALL'), true) ?: [];
	$ran = $mode === 'none' ? [] : array_column(json_decode((string)getenv('RAN'), true) ?: [], 'name');
	$standing = json_decode((string)getenv('STANDING'), true) ?: [];
	$root = PROBE_ROOT . '/.dev/parts';
	PROBE__Remove($root);
	$holders = [];
	$missing = [];
	foreach ($all as ['name' => $name]) {
		$holder = in_array($name, $ran, true) ? $id : ($standing[$name] ?? '');
		if ($holder === '') {
			continue;
		}
		try {
			PROBE__Gh(['run', 'download', $holder, '--name', 'part-' . $name, '--dir', $root . '/' . $name]);
			$holders[$name] = $holder;
		} catch (RuntimeException $e) {
			$missing[] = $name;
			fwrite(STDERR, 'no sheet of the part ' . $name . ' in run ' . $holder . ': ' . $e->getMessage() . "\n");
		}
	}
	$status = $holders === [] ? 2 : PROBE__Merge($config, array_map(fn(string $name): string => $root . '/' . $name, array_keys($holders)));
	if ($mode !== 'lab') {
		$clean = array_filter($holders, fn(string $holder, string $name): bool => (json_decode((string)@file_get_contents($root . '/' . $name . '/report.json'), true)['findings'] ?? null) === [], ARRAY_FILTER_USE_BOTH);
		$commit = (string)getenv('GITHUB_SHA');
		foreach (['standing' => ['commit' => $commit, 'parts' => (object)$clean], 'verified' => ['commit' => $commit, 'mode' => $mode]] as $what => $record) {
			if ($what === 'verified' && ($status !== 0 || count($clean) !== count($all))) {
				continue;
			}
			@mkdir(PROBE_ROOT . '/.dev/' . $what, 0777, true);
			file_put_contents(PROBE_ROOT . '/.dev/' . $what . '/' . $what . '.json', json_encode($record, JSON_UNESCAPED_SLASHES) . "\n");
		}
	}
	return $missing === [] ? $status : max($status, 1);
}

/** Runs the engines at once, a process a group, each writing a sheet of its own, then one sheet of them all: every
 *  engine safaridriver drives - desktop Safari, VoiceOver's, the simulators' - goes one after another, as two of its
 *  sessions starting together time out; every other engine runs alone. Answers the merged sheet's exit code. */
function PROBE__Parallel(array $config, array $groups, array $options): int
{
	$root = sys_get_temp_dir() . '/redz-ui-parallel-' . getmypid();
	PROBE__Remove($root);
	mkdir($root, 0777, true);
	$running = [];
	foreach ($groups as $group => $names) {
		$command = [PHP_BINARY, '-d', 'xdebug.mode=off', __FILE__, '--serial', '--sheet=' . $root . '/' . $group, ...($options['named'] ? [] : ['--full']), ...($options['pages'] === [] ? [] : ['--pages=' . implode(',', $options['pages'])]), ...($options['share'] === '' ? [] : ['--share=' . $options['share']]), ...$names];
		$proc = proc_open($command, [0 => ['file', PROBE_NULL, 'r'], 1 => ['file', $root . '/' . $group . '.log', 'a'], 2 => ['file', $root . '/' . $group . '.log', 'a']], $pipes, PROBE_ROOT);
		if (!is_resource($proc)) {
			throw new RuntimeException('cannot start the run of ' . implode(', ', $names));
		}
		$running[$group] = $proc;
		echo 'started ', implode(', ', $names), "\n";
	}
	register_shutdown_function(function () use (&$running): void {
		foreach ($running as $proc) {
			proc_terminate($proc);
		}
	});
	while ($running !== []) {
		foreach ($running as $group => $proc) {
			if (!proc_get_status($proc)['running']) {
				proc_close($proc);
				unset($running[$group]);
				echo implode("\n", array_filter(file($root . '/' . $group . '.log', FILE_IGNORE_NEW_LINES) ?: [], fn(string $line): bool => preg_match('~ · \d+ cells · \d+ findings$| skipped: ~', $line) === 1)), "\n";
			}
		}
		usleep(500000);
	}
	$status = PROBE__Merge($config, array_map(fn(string $group): string => $root . '/' . $group, array_keys($groups)));
	PROBE__Remove($root);
	return $status;
}

function PROBE__Main(array $argv): int
{
	$config = json_decode((string)file_get_contents(PROBE_CONFIG), true, 512, JSON_THROW_ON_ERROR);
	$options = ['pages' => [], 'sheet' => PROBE_SHEET, 'serial' => false, 'full' => false, 'base' => '', 'share' => ''];
	$args = [];
	foreach (array_slice($argv, 1) as $arg) {
		match (true) {
			str_starts_with($arg, '--pages=') => $options['pages'] = preg_split('~[\s,]+~', substr($arg, strlen('--pages=')), -1, PREG_SPLIT_NO_EMPTY),
			str_starts_with($arg, '--sheet=') => $options['sheet'] = substr($arg, strlen('--sheet=')),
			str_starts_with($arg, '--base=') => $options['base'] = substr($arg, strlen('--base=')),
			str_starts_with($arg, '--share=') => $options['share'] = substr($arg, strlen('--share=')),
			$arg === '--serial' => $options['serial'] = true,
			// A group of a full run: its engines were not named, so one that cannot run here is only a note.
			$arg === '--full' => $options['full'] = true,
			default => $args[] = $arg,
		};
	}
	$options['named'] = $args !== [] && !$options['full'];
	if (($args[0] ?? '') === 'merge') {
		return PROBE__Merge($config, array_slice($args, 1), $options['base']);
	}
	if (($args[0] ?? '') === 'affected') {
		return PROBE__Affected($config, $args[1] ?? '', json_decode((string)getenv('ALL'), true) ?: []);
	}
	if (($args[0] ?? '') === 'plan') {
		return PROBE__Plan($config);
	}
	if (($args[0] ?? '') === 'gather') {
		return PROBE__Gather($config);
	}
	if (($args[0] ?? '') === 'voiceover-setup') {
		return PROBE__VoiceOverSetup();
	}
	if (($args[0] ?? '') === 'nvda-setup') {
		return PROBE__NvdaSetup();
	}
	$names = $args ?: array_keys(array_filter($config['engines'], fn(array $engine): bool => $engine['default'] ?? true));
	foreach ($names as $name) {
		if (!isset($config['engines'][$name])) {
			fwrite(STDERR, 'no engine ' . $name . ' in tools/probes/config.json; there are ' . implode(', ', array_keys($config['engines'])) . "\n");
			return 2;
		}
	}
	if ($options['pages'] !== []) {
		try {
			$config = PROBE__Only($config, $options['pages']);
		} catch (InvalidArgumentException $e) {
			fwrite(STDERR, $e->getMessage() . "\n");
			return 2;
		}
	}
	if ($options['share'] !== '') {
		$share = PROBE__ShareOf($options['share']);
		if ($share === null) {
			fwrite(STDERR, '--share takes K/N - the K-th of N shares of the pages, 1 ≤ K ≤ N' . "\n");
			return 2;
		}
		$config = PROBE__Share($config, $share);
	}
	$groups = [];
	foreach ($names as $name) {
		$engine = $config['engines'][$name];
		$groups[in_array($engine['kind'], ['safari', 'voiceover'], true) ? 'safari' : $name][] = $name;
	}
	if (count($groups) > 1 && !$options['serial'] && getenv('CI') === false) {
		return PROBE__Parallel(json_decode((string)file_get_contents(PROBE_CONFIG), true, 512, JSON_THROW_ON_ERROR), $groups, $options);
	}
	$sheet = $options['sheet'];
	$tmp = sys_get_temp_dir() . '/redz-ui-probe-' . getmypid();
	$work = $sheet . '.new';
	PROBE__Remove($work);
	foreach ([$tmp, $work . '/shots', $work . '/print'] as $folder) {
		mkdir($folder, 0777, true);
	}
	try {
		$commit = trim(PROBE__Run(['git', '-C', PROBE_ROOT, 'rev-parse', '--short', 'HEAD']));
	} catch (RuntimeException) {
		$commit = '';
	}
	$report = ['when' => gmdate('Y-m-d H:i') . ' UTC', 'commit' => $commit === '' ? 'no commit' : 'commit ' . $commit, 'widths' => array_keys($config['widths']), 'only' => $config['only'] ?? [], 'share' => $options['share'] === '' ? [] : array_fill_keys($names, [$options['share']]), 'engines' => [], 'skipped' => [], 'findings' => [], 'guarded' => [], 'walked' => [], 'spoken' => [], 'read' => [], 'shots' => [], 'used' => []];
	$run = ['config' => $config, 'page' => (string)file_get_contents(PROBE_PAGE), 'read' => (string)file_get_contents(PROBE_READ), 'behave' => (string)file_get_contents(PROBE_BEHAVE), 'axe' => PROBE__Axe($config['axe']), 'sheet' => $work];
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
					if ($options['named']) {
						$report['findings'][] = $name . ' - named, but cannot run here: ' . $why;
					}
					echo $name, ' skipped: ', $why, "\n";
					continue;
				}
				// A share's logs keep their own names in the sheet the shares are joined into.
				$own = $tmp . '/' . $name . ($options['share'] === '' ? '' : '-share-' . str_replace('/', '-of-', $options['share']));
				mkdir($own, 0777, true);
				PROBE__EngineRun($name, $config['engines'][$name], $binary, $own, $run, $report);
			} catch (Throwable $e) {
				$report['findings'][] = $name . ' - stopped: ' . $e->getMessage();
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
	PROBE__Remove($sheet);
	rename($work, $sheet);
	PROBE__Remove($tmp);
	return $status;
}

exit(PROBE__Main($argv));
