<?php
// probe - the library's pages in real engines: Chrome, Firefox and Safari as installed; the floor - Chrome 130 and
// Firefox 132 fetched once into the cache, Safari 18 in the iOS simulator; the engines whose bugs js/menu-place.js repairs -
// Chrome 136, Safari 26 in the simulator; the current iOS, Safari 27 in the simulator. Each cell - a page at a width, light LTR or dark RTL, right to left on the
// page's Arabic twin when it has one - is judged for overflow, unmasked icons, width prefixes outside a region, cut
// labels, busy marks on live regions and errors; at the shot widths it is shot, every popover and dialog opened and axe
// run; at 1440 its widgets are walked by keyboard, the docs' state mirror is held against the real hover and focus, and
// Chrome names the fonts of Arabic text; forced colors and print where the engine has them; and every engine runs the
// minifier's scripts of tools/min/ as written and minified, and reads the release's stylesheet as written and squeezed,
// which must agree. The pages of the config run that whole way; the docs pages run in the "docs" engines at their
// widths, without shots or walks. Writes the sheet
// .dev/probes/index.html with its report.json and exits 1 on any finding, and as it goes each engine's progress in
// .dev/live/probe-ENGINE.json for a board; an engine whose cell runs past five minutes
// stops as stalling, that cell named. The screen readers hear the config's speech steps: VoiceOver in Safari on a Mac,
// NVDA in Chrome and Firefox on Windows, where NVDA also reads each speech page whole by its quick navigation. Usage:
// php tools/probe.php [--pages=PAGE,…] [--serial | --jobs=N] [--dry] [ENGINE[@PAGE,…]…] - an engine named that cannot
// run here is a finding, one left out of a full run only a note; --pages runs only those pages, the exceptions of the
// others left unjudged, and ENGINE@PAGE,… runs that engine on its own pages alone (ENGINE@* on all, and so does an
// engine named bare beside one with pages); outside CI the engines run at once, a process each (the engines safaridriver
// drives one after another) - at most N at a time with --jobs, in the order named, the next as one ends; one after
// another with --serial; --dry prints the pages each engine would run, and runs nothing - or
// php tools/probe.php check [BASE] [--dry] [--jobs=N] - the Mac's run before a commit: the engines of the config's
// "check" on what changed since BASE (HEAD when none, the files git does not track yet included), 3 at a time - or
// php tools/probe.php merge [--base=DIR] DIR… - one sheet of the sheets of several runs, as CI's parallel jobs leave them -
// or php tools/probe.php affected BASE - what the files changed since BASE ask of each part - or plan | gather, CI's
// plan of the parts and its one sheet of them - or php tools/probe.php voiceover-setup | nvda-setup, which ready CI's
// machines for the readers. $REDZ_UI_CACHE moves the cache of fetched engines.

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
// The page that holds every behaviour check's target and names a check that finds none.
const PROBE_BEHAVE_HOME = 'docs/all.html';
const PROBE_NULL = PHP_OS_FAMILY === 'Windows' ? 'NUL' : '/dev/null';
const PROBE_SHEET = __DIR__ . '/../.dev/probes';
const PROBE_FORCED_PREFS = ['browser.display.document_color_use' => 2];
// The tallest shot, in CSS px: twice that is the most a 2× phone shot can be, under the engines' 16 384 px canvas.
const PROBE_SHOT_MAX = 8000;
// The most steps of real input a behaviour check may take.
const PROBE_BEHAVE_STEPS = 1200;
// The longest a cell may run, in seconds: CI's iOS 26 simulator, the slowest engine, spends about a minute on a cell.
const PROBE_CELL_MAX = 300;
// The probe code by the engines that run it, as PROBE__Reach's marks: the engines of a kind, "browser:NAME" for a reader
// in that browser, "behave" for the full pages in the desktop engines. A change to one is tried on the config's sample
// pages in those engines - a change to the rest of the probe code in every engine -, never on every page.
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
const PROBE_PACKAGES = ['charts', 'calendar', 'media', 'qr', 'editor'];
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

/** Runs $command without a shell, with $env added to the environment, and answers its output; a failure throws with
 *  its message. */
function PROBE__Run(array $command, array $env = []): string
{
	$proc = proc_open($command, [0 => ['file', PROBE_NULL, 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, $env === [] ? null : $env + getenv());
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

/** Why no iOS simulator can be driven on this Mac: the config's "simulators" why when its Xcode and its safaridriver
 *  are both of the builds "blocked" names, a fault of the platform; '' otherwise, and where either cannot be read. */
function PROBE__SimulatorFault(): string
{
	static $why = null;
	if ($why !== null) {
		return $why;
	}
	$fault = PROBE__Config()['simulators'] ?? [];
	try {
		$found = [
			'xcode' => preg_match('~^Xcode (\d+(?:\.\d+)*)~m', PROBE__Run(['/usr/bin/xcrun', 'xcodebuild', '-version']), $m) === 1 ? $m[1] : '',
			'safari' => preg_match('~Safari (\d+(?:\.\d+)*)~', PROBE__Run(['/usr/bin/safaridriver', '--version']), $m) === 1 ? $m[1] : '',
		];
	} catch (RuntimeException) {
		return $why = '';
	}
	return $why = PROBE__FaultHolds($fault['blocked'] ?? [], $found) ? (($fault['why'] ?? '') ?: 'tools/probes/config.json\'s "simulators" blocks Xcode ' . $found['xcode'] . ' with Safari ' . $found['safari']) : '';
}

/** Whether each version of $found - by name: xcode, safari - is in every range $blocked gives that name, comparisons
 *  joined by commas (">= 27, <= 27.2"); false when $blocked is empty or a version it names was not found. */
function PROBE__FaultHolds(array $blocked, array $found): bool
{
	$bare = fn(string $version): string => (string)preg_replace('~(\.0+)+$~', '', $version);
	foreach ($blocked as $name => $ranges) {
		foreach (explode(',', (string)$ranges) as $range) {
			if (preg_match('~^\s*(<=|>=|<|>|=)\s*(\d+(?:\.\d+)*)\s*$~', $range, $m) !== 1) {
				throw new RuntimeException('tools/probes/config.json: "simulators" blocks ' . $name . ' by "' . trim($range) . '", not a comparison such as ">= 27"');
			}
			if (($found[$name] ?? '') === '' || !version_compare($bare($found[$name]), $bare($m[2]), $m[1])) {
				return false;
			}
		}
	}
	return $blocked !== [];
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
		if (isset($engine['ios']) && ($why = PROBE__SimulatorFault()) !== '') {
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
	$widths = isset($engine['ios']) ? [0 => 0] : $run['config']['widths'];
	$pages = count($run['config']['pages']);
	$combos = count($run['config']['combos']);
	PROBE__LiveStart($name, implode('/', $run['config']['share'] ?? []), [
		'normal' => $pages * $combos * count($widths),
		'docs' => in_array($name, $run['config']['docs']['engines'], true) ? count(PROBE__DocsPages($run['config'])) * $combos * count($run['config']['docs']['widths']) : 0,
		'print' => $engine['kind'] !== 'safari' ? $pages : 0,
		'forced' => $pages * match ($engine['kind']) {
			'chrome' => 2,
			'firefox' => 1,
			default => 0,
		},
		'min' => ($run['config']['share'][0] ?? 1) === 1 ? 1 : 0,
	], count($report['findings']));
	try {
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
	PROBE__LiveCell($name, $page, $combo, $width, $mode, count($report['findings']));
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
	foreach (['unmasked' => 'icons without a mask', 'unregioned' => 'width prefixes outside a region', 'cut' => 'cut labels', 'busyLive' => 'aria-busy on or around a live region', 'toggles' => '--toggle buttons whose aria-expanded is not their region\'s state', 'toggleFor' => '--toggle buttons with commandfor, which WebKit exposes as collapsed whatever aria-expanded says', 'tips' => 'tooltip buttons their tooltip does not describe (aria-describedby)','comboboxes' => 'comboboxes whose button, active option or chosen values disagree with their list', 'scrollspies' => 'scrollspy navs without exactly one link at aria-current="location"', 'strengths' => 'data-strength displays whose field is missing', 'edits' => 'inline edit forms whose data-for names no value', 'grips' => 'drag handles outside an item of a data-reorder list', 'uploads' => 'uploads without their file input, zone, template or list', 'twins' => 'ids used more than once'] as $key => $what) {
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
			$targets = array_values(array_filter($v['targets'], function (string $target) use ($run, $name, $v, $page, &$report): bool {
				return !PROBE__AxeAllowed($run['config'], $name, $v['id'], $target, $page, $report);
			}));
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
		if (!PROBE__FindingAllowed($run['config'], $name, $where . $finding, $page, $report)) {
			$report['findings'][] = $where . $finding;
		}
	}
}

/** One step of a walk's real input: a click, a move of the pointer, keys, typed text or a drag. */
function PROBE__Input(array &$h, array $input): void
{
	if (isset($input['click'])) {
		PROBE__Do($h, 'Click', ...array_map('intval', $input['click']));
	}
	if (isset($input['hover'])) {
		PROBE__Do($h, 'Hover', ...array_map('intval', $input['hover']));
	}
	foreach ((array)($input['key'] ?? []) as $key) {
		PROBE__Do($h, 'Key', $key);
	}
	if (isset($input['type'])) {
		PROBE__Do($h, 'Type', $input['type']);
	}
	if (isset($input['drag'])) {
		PROBE__Do($h, 'Drag', ...array_map('intval', $input['drag']));
	}
}

/** The behaviour checks of tools/probes/behave.js whose targets $page has, on the page loaded again from $url - each
 *  check stepped until it answers its findings, its drags made by the engine's own pointer -, and every target found on
 *  docs/all.html, which holds them all; answers the findings with the page's errors, and the checks in $walked. */
function PROBE__Behave(array &$h, string $page, string $url, int $height, array $run, array &$walked): array
{
	PROBE__Do($h, 'Inject', $run['behave']);
	$findings = $page === PROBE_BEHAVE_HOME ? array_map(fn(string $check): string => 'the behaviour check "' . $check . '" finds no target', PROBE__Do($h, 'Eval', 'REDZ_BEHAVE.missing()')) : [];
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
		for ($step = 0; $step < PROBE_BEHAVE_STEPS; $step++) {
			$answer = PROBE__Do($h, 'Eval', 'REDZ_BEHAVE.step(' . json_encode($check) . ')');
			if (isset($answer['input'])) {
				PROBE__Input($h, $answer['input']);
				continue;
			}
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
	$spare = 20.0;
	foreach (PROBE__Do($h, 'Eval', 'REDZ_PROBE.keyTargets()') as ['kind' => $kind, 'id' => $id, 'outside' => $outside]) {
		$state = function () use (&$h, $kind, $id): array {
			return PROBE__Do($h, 'Eval', 'REDZ_PROBE.state(' . json_encode($kind) . ', ' . json_encode($id) . ')');
		};
		// The state read frame by frame until it is what the step wants, 2 s at most - a busy machine answers late, and a
		// finding is a state that never came: the last state read, and whether it held. The page's waits share $spare, so
		// widgets broken all together are found within the cell's time.
		$until = function (callable $wanted) use (&$h, &$spare, $state): array {
			$s = $state();
			$from = microtime(true);
			for ($end = $from + min(2.0, $spare); !$wanted($s) && microtime(true) < $end; $s = $state()) {
				PROBE__Settle($h, 0);
			}
			$spare -= microtime(true) - $from;
			return [$s, $wanted($s)];
		};
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
			[$s, $held] = $until(fn(array $s): bool => $s['open'] && $s['item'] === max(0, $s['checked']));
			$first = max(0, $s['checked']);
			$steps = [['opening', $first], ['ArrowDown', ($first + 1) % max(1, $s['items'])], ['End', $s['items'] - 1], ['Home', 0]];
			foreach ($steps as $i => [$key, $item]) {
				if ($i > 0) {
					$press($key);
					[$s, $held] = $until(fn(array $s): bool => $s['open'] && $s['item'] === $item);
				}
				if (!$held) {
					$findings[] = $what . $key . ': ' . ($s['open'] ? 'the focus is on item ' . $s['item'] . ', not ' . $item : 'the menu is closed');
					continue 2;
				}
			}
			$press('Escape');
			[$s, $held] = $until(fn(array $s): bool => !$s['open'] && $s['onInvoker']);
			if (!$held) {
				$findings[] = $what . 'Escape: ' . ($s['open'] ? 'the menu stays open' : 'the focus is not back on its button');
				continue;
			}
			$press('ArrowDown');
			[$s, $held] = $until(fn(array $s): bool => $s['open'] && $s['item'] === $first);
			if (!$held) {
				$findings[] = $what . 'ArrowDown on its button: ' . ($s['open'] ? 'the focus is on item ' . $s['item'] . ', not ' . $first : 'the menu does not open');
				continue;
			}
			$press('Tab');
			if (!$until(fn(array $s): bool => !$s['open'] && !$s['inside'])[1]) {
				$findings[] = $what . 'Tab: the menu stays open';
			}
		} elseif ($kind === 'dialog') {
			$activate($id);
			[$s, $held] = $until(fn(array $s): bool => $s['open'] && $s['inside']);
			if (!$held) {
				$findings[] = $what . 'opening: ' . ($s['open'] ? 'the focus is not inside the dialog' : 'the dialog does not open');
				continue;
			}
			if ($s['search'] !== null) {
				$press('ArrowDown');
				[$s, $held] = $until(fn(array $s): bool => ($s['search']['active'] ?? null) !== null);
				if (!$held) {
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
			[$s, $held] = $until(fn(array $s): bool => !$s['open'] && $s['onInvoker']);
			if (!$held) {
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
					if (!$until(fn(array $s): bool => !$s['open'])[1]) {
						$findings[] = '#' . $id . ' - a click outside it does not close it (closedby="any")';
					}
				}
				PROBE__Do($h, 'Eval', '(document.getElementById(' . json_encode($id) . ').open && document.getElementById(' . json_encode($id) . ').close(), true)');
			}
		} elseif ($kind === 'combobox') {
			$activate($id);
			[$s, $held] = $until(fn(array $s): bool => $s['open'] && $s['onSearch'] && $s['expanded'] === 'true');
			if (!$held) {
				$findings[] = $what . 'opening: ' . (!$s['open'] ? 'the panel does not open' : (!$s['onSearch'] ? 'the focus is not in its search' : 'its button says aria-expanded="' . $s['expanded'] . '"'));
				continue;
			}
			if ($s['options'] > 0) {
				$before = $s['values'];
				$press('ArrowDown');
				[$s, $held] = $until(fn(array $s): bool => $s['active'] !== null);
				if (!$held) {
					$findings[] = $what . 'ArrowDown: no option is active';
					continue;
				}
				$taken = $s['active'];
				$values = $s['multiple'] ? (in_array($taken, $before, true) ? array_values(array_diff($before, [$taken])) : [...$before, $taken]) : [$taken];
				$press('Enter');
				[$s, $held] = $until(fn(array $s): bool => $s['values'] === $values && $s['open'] === $s['multiple']);
				if (!$held) {
					$findings[] = $what . 'Enter on "' . $taken . '": the values should be ' . json_encode($values) . ' with the panel ' . ($s['multiple'] ? 'open' : 'closed') . ' - they are ' . json_encode($s['values']) . ', the panel ' . ($s['open'] ? 'open' : 'closed');
					continue;
				}
			}
			if ($s['open'] && $s['offers']) {
				$word = 'Probe tag ' . substr(md5($id), 0, 6);
				PROBE__Do($h, 'Eval', 'REDZ_PROBE.typeInto(' . json_encode('#' . $id . ' input[role="combobox"]') . ', ' . json_encode($word) . ')');
				usleep(200000);
				if (!$until(fn(array $s): bool => $s['activeCreate'])[1]) {
					$findings[] = $what . 'a new word in the search: "Create …" is not the active option';
					continue;
				}
				$press('Enter');
				[$s, $held] = $until(fn(array $s): bool => in_array($word, $s['created'], true));
				if (!$held) {
					$findings[] = $what . 'Enter on "Create …": the new label is not in its field, which holds ' . json_encode($s['created']);
					continue;
				}
			}
			if ($s['open']) {
				$press('Escape');
			}
			[$s, $held] = $until(fn(array $s): bool => !$s['open'] && $s['onInvoker'] && $s['expanded'] === 'false');
			if (!$held) {
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
				// Enter opens a closed item, Space closes it again - or the other way round.
				$wanted = $step === 0 ? !$was : $was;
				[$s, $held] = $until(fn(array $s): bool => in_array($s['walked'], $s['open'], true) === $wanted && !($wanted && $s['grouped'] && $s['open'] !== [$s['walked']]));
				if (!$held) {
					$open = in_array($s['walked'], $s['open'], true);
					$findings[] = $what . $key . ': ' . ($open !== $wanted ? 'item ' . $s['walked'] . ' ' . ($open ? 'stays open' : 'stays closed') : 'opening item ' . $s['walked'] . ' of a group leaves ' . json_encode($s['open']) . ' open');
					break;
				}
			}
		} elseif ($kind === 'edit') {
			$activate($id);
			[$s, $held] = $until(fn(array $s): bool => $s['open'] && $s['inField']);
			if (!$held) {
				$findings[] = $what . 'Enter on Edit: ' . ($s['open'] ? 'the focus is not in its field' : 'the form does not open');
				continue;
			}
			$press('Escape');
			[$s, $held] = $until(fn(array $s): bool => !$s['open'] && $s['valueShown'] && $s['onInvoker']);
			if (!$held) {
				$findings[] = $what . 'Escape: ' . ($s['open'] ? 'the form stays open' : (!$s['valueShown'] ? 'the value does not show again' : 'the focus is not back on Edit'));
			}
		} elseif ($kind === 'strength') {
			foreach (['correct horse battery staple', ''] as $typed) {
				PROBE__Do($h, 'Eval', 'REDZ_PROBE.typeInto(' . json_encode('#' . $id) . ', ' . json_encode($typed) . ')');
				$wrong = fn(mixed $shown): bool => ($shown !== null && $shown !== '' && $shown !== 0 && $shown !== 0.0) !== ($typed !== '');
				// The words come once the typing pauses, 0.7 s - later on a busy machine: the meters read until they hold,
				// 5 s at most.
				for ($until = microtime(true) + 5; true;) {
					usleep(250000);
					$s = $state();
					$off = ($s['levels'] === [] && $s['words'] === []) || array_filter([...$s['levels'], ...$s['valuetexts'], ...$s['words']], $wrong) !== [];
					if (!$off || microtime(true) > $until) {
						break;
					}
				}
				if ($off) {
					$findings[] = $what . ($typed === '' ? 'the field emptied' : 'a password typed') . ': its meters show ' . json_encode($s['levels']) . ' said as ' . json_encode($s['valuetexts']) . ', its words ' . json_encode($s['words']);
					break;
				}
			}
		} elseif ($kind === 'trees') {
			$activate($id);
			[$s, $held] = $until(fn(array $s): bool => $s['open'] === $s['groups'] && $s['said'] === $s['groups']);
			if (!$held) {
				$findings[] = $what . 'Expand all: ' . $s['open'] . ' of ' . $s['groups'] . ' groups open, ' . $s['said'] . ' toggles saying so';
				continue;
			}
			PROBE__Do($h, 'Eval', '(document.querySelector(' . json_encode('[commandfor="' . $id . '"][command="--collapse-all"]') . ').click(), true)');
			[$s, $held] = $until(fn(array $s): bool => $s['open'] === 0 && $s['said'] === $s['groups']);
			if (!$held) {
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
			[$s] = $until(fn(array $s): bool => $s['open']);
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
			$moved = [$before[1], $before[0], ...array_slice($before, 2)];
			[$s, $held] = $until(fn(array $s): bool => $s['order'] === $moved && $s['onGrip'] && $s['said'] !== '' && !$s['open']);
			if (!$held) {
				$findings[] = $what . 'Move down: the order should be ' . json_encode($moved) . ', the focus on the moved handle and the move said - it is ' . json_encode($s['order']) . ($s['onGrip'] ? '' : ', the focus elsewhere') . ($s['said'] === '' ? ', nothing said' : '') . ($s['open'] ? ', the menu still open' : '');
			}
		} elseif ($kind === 'upload') {
			$accepted = fn(array $row): bool => in_array($row['state'], ['sending', 'done', 'ready'], true);
			$refused = fn(array $row): bool => $row['state'] === 'failed' && $row['error'] !== '';
			// The last two rows: one file it takes, then one it refuses.
			$pair = fn(array $rows): bool => count($rows) === 2 && $accepted($rows[0]) && $refused($rows[1]);
			PROBE__Do($h, 'Eval', 'REDZ_PROBE.chooseFiles(' . json_encode($id) . ')');
			usleep(300000);
			[$s] = $until(fn(array $s): bool => $s['multiple'] ? $pair(array_slice($s['rows'], -2)) : count($s['rows']) === 1 && $refused($s['rows'][0]));
			if (!$s['multiple']) {
				$first = $s['rows'];
				PROBE__Do($h, 'Eval', 'REDZ_PROBE.chooseFiles(' . json_encode($id) . ', 2)');
				usleep(300000);
				[$s, $held] = $until(fn(array $s): bool => count($s['rows']) === 1 && $accepted($s['rows'][0]));
				if (count($first) !== 1 || !$refused($first[0]) || !$held) {
					$findings[] = $what . 'one file at a time: of two chosen the first, refused, and then a good one in its place - the rows say ' . json_encode($first) . ', then ' . json_encode($s['rows']);
					continue;
				}
			} elseif (!$pair(array_slice($s['rows'], -2))) {
				$findings[] = $what . 'two files chosen, one it takes and one it refuses: their rows say ' . json_encode(array_slice($s['rows'], -2));
				continue;
			}
			$count = count($s['rows']);
			PROBE__Do($h, 'Eval', '(document.getElementById(' . json_encode($id) . ').querySelector(".upload-list > :last-child [data-file-remove]").click(), true)');
			[$s, $held] = $until(fn(array $s): bool => count($s['rows']) === $count - 1 && ($s['onRemove'] || $s['onZone']));
			if (!$held) {
				$findings[] = $what . 'Remove on a file: ' . (count($s['rows']) === $count ? 'the row stays' : 'the focus is on neither the next file nor the zone');
			}
		} elseif ($kind === 'reveal') {
			foreach (['text' => 'true', 'password' => 'false'] as $type => $pressed) {
				$activate($id);
				[$s, $held] = $until(fn(array $s): bool => $s['type'] === $type && $s['pressed'] === $pressed);
				if (!$held) {
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
				$wanted = fn(array $s): bool => $s['open'] === $open && $s['expanded'] === ($open ? 'true' : 'false');
				[$s, $held] = $wanted($s) ? [$s, true] : $until($wanted);
				if (!$held) {
					$findings[] = $what . 'Enter: the region should be ' . ($open ? 'open' : 'closed') . ' - it is ' . ($s['open'] ? 'open' : 'closed') . ', its button says aria-expanded="' . $s['expanded'] . '"';
					break;
				}
			}
		} else {
			$s = $state();
			$start = $s['selected'][0] ?? 0;
			$last = $s['count'] - 1;
			$shown = fn(array $s, int $tab): bool => $s['selected'] === [$tab] && $s['focused'] === $tab && $s['shown'] === [$tab];
			foreach ([[$s['rtl'] ? 'ArrowLeft' : 'ArrowRight', ($start + 1) % $s['count']], ['End', $last], ['Home', 0]] as [$key, $tab]) {
				$press($key);
				// Manual activation moves the focus alone; automatic selects the tab too.
				[$s, $held] = $until(fn(array $s): bool => $s['manual'] ? $s['focused'] === $tab && $s['selected'] === [$start] : $shown($s, $tab));
				if ($s['manual']) {
					if (!$held) {
						$findings[] = $what . $key . ' (manual activation): the focus should move to tab ' . $tab . ' and the selection stay on ' . $start . ' - selected ' . json_encode($s['selected']) . ', focused ' . $s['focused'];
						break;
					}
					if ($h['kind'] === 'firefox') {
						continue;
					}
					$press('Enter');
					$start = $tab;
					[$s, $held] = $until(fn(array $s): bool => $shown($s, $tab));
				}
				if (!$held) {
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

/** Whether an exception of the probes' config allows axe rule $rule at $target in engine $engine; marks it used on
 *  $page. */
function PROBE__AxeAllowed(array $config, string $engine, string $rule, string $target, string $page, array &$report): bool
{
	foreach ($config['allow'] as $entry) {
		if (($entry['rule'] ?? null) === $rule && str_contains($target, $entry['target']) && in_array($engine, $entry['engines'] ?? [$engine], true)) {
			$report['used'][PROBE__AllowKey($entry)][$page] = true;
			return true;
		}
	}
	return false;
}

/** Whether an exception of the config - {"finding": a part of its text, "engines", "reason"} - allows the finding
 *  $text of engine $engine; marks the exception used on $page. */
function PROBE__FindingAllowed(array $config, string $engine, string $text, string $page, array &$report): bool
{
	foreach ($config['allow'] as $entry) {
		if (isset($entry['finding']) && str_contains($text, $entry['finding']) && in_array($engine, $entry['engines'] ?? [$engine], true)) {
			$report['used'][PROBE__AllowKey($entry)][$page] = true;
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
	PROBE__LiveCell($name, '', '', 0, 'min', count($report['findings']));
	$answer = function (string $code) use (&$h): mixed {
		PROBE__Do($h, 'Load', 'about:blank', 1280, 900, 'light', false);
		return PROBE__Do($h, 'Eval', "(async () => {'use strict';\n" . $code . "\nreturn globalThis.REDZ_MIN_RESULT;})()");
	};
	foreach (glob(PROBE_ROOT . '/tools/min/*.js') ?: [] as $file) {
		$source = (string)file_get_contents($file);
		try {
			$written = $answer($source);
			$minified = $answer(MIN__JsNamesSafe(MIN__JsSafe($source)));
		} catch (RuntimeException | LogicException $e) {
			$report['findings'][] = $name . ' tools/min/' . basename($file) . ' - ' . $e->getMessage();
			continue;
		}
		if ($written !== $minified) {
			$report['findings'][] = $name . ' tools/min/' . basename($file) . ' answers ' . substr((string)json_encode($minified, JSON_UNESCAPED_UNICODE), 0, 300) . ' minified, ' . substr((string)json_encode($written, JSON_UNESCAPED_UNICODE), 0, 300) . ' as written';
		}
	}
	$main = 'dist/' . json_decode((string)file_get_contents(PROBE_ROOT . '/dist/redz-ui.json'), true, 512, JSON_THROW_ON_ERROR)['main']['css'];
	preg_match_all('~^@import url\("([^"]+)"\);~m', (string)file_get_contents(PROBE_ROOT . '/css/index.css'), $imports);
	$hostile = (string)file_get_contents(PROBE_ROOT . '/tools/min/hostile.css');
	$sheets = [
		$main => [implode("\n", array_map(fn(string $file): string => (string)file_get_contents(PROBE_ROOT . '/css/' . $file), $imports[1])), (string)file_get_contents(PROBE_ROOT . '/' . $main)],
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
	PROBE__LiveCell($name, $page, '', 0, 'print', count($report['findings']));
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

/** The live state of this process's engine runs, by engine. */
function &PROBE__LiveState(): array
{
	static $state = [];
	return $state;
}

/** Writes an engine's live state to .dev/live/probe-ENGINE[-K-of-N].json in one move, for a board to read as the run
 *  goes; a failure to write is no failure of the run. */
function PROBE__LiveWrite(array $one): void
{
	$dir = PROBE_ROOT . '/.dev/live';
	@mkdir($dir, 0777, true);
	$file = $dir . '/probe-' . PROBE__Slug($one['engine'] . ($one['share'] === '' ? '' : '-' . str_replace('/', '-of-', $one['share']))) . '.json';
	unset($one['base']);
	if (@file_put_contents($file . '.part', json_encode($one, JSON_UNESCAPED_SLASHES)) !== false) {
		@rename($file . '.part', $file);
	}
}

/** An engine's run starts: the cells it will take by mode - normal, docs, print, forced, min -, none done yet, its
 *  findings counted from the report's $findings now. */
function PROBE__LiveStart(string $name, string $share, array $cells, int $findings): void
{
	$state = &PROBE__LiveState();
	$state[$name] = ['engine' => $name, 'share' => $share, 'pid' => getmypid(), 'started' => time(), 'cells' => array_filter($cells), 'done' => [], 'spent' => [], 'cell' => null, 'findings' => 0, 'ended' => null, 'base' => $findings];
	PROBE__LiveWrite($state[$name]);
}

/** The cell an engine was on is done - counted with the time it took -, and it is on the next: $page at $width in
 *  $combo, of $mode. */
function PROBE__LiveCell(string $name, string $page, string $combo, int $width, string $mode, int $findings): void
{
	$state = &PROBE__LiveState();
	if (!isset($state[$name])) {
		return;
	}
	PROBE__LiveDone($state[$name]);
	$state[$name]['cell'] = ['page' => $page, 'combo' => $combo, 'width' => $width, 'mode' => $mode, 'since' => microtime(true)];
	$state[$name]['findings'] = $findings - $state[$name]['base'];
	PROBE__LiveWrite($state[$name]);
}

/** The cell an engine's state is on, done. */
function PROBE__LiveDone(array &$one): void
{
	if ($one['cell'] !== null) {
		$mode = $one['cell']['mode'];
		$one['done'][$mode] = ($one['done'][$mode] ?? 0) + 1;
		$one['spent'][$mode] = round(($one['spent'][$mode] ?? 0) + microtime(true) - $one['cell']['since'], 2);
		$one['cell'] = null;
	}
}

/** An engine's run ends, with the report's $findings now. */
function PROBE__LiveEnd(string $name, int $findings): void
{
	$state = &PROBE__LiveState();
	if (!isset($state[$name])) {
		return;
	}
	PROBE__LiveDone($state[$name]);
	$state[$name]['findings'] = $findings - $state[$name]['base'];
	$state[$name]['ended'] = time();
	PROBE__LiveWrite($state[$name]);
	unset($state[$name]);
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
	foreach ($config['allow'] as $entry) {
		$engines = $entry['engines'] ?? array_keys($config['engines']);
		// Judged when the run's pages were all of them, or each engine the exception names ran whole.
		$judged = ($report['only'] ?? []) === [] || array_diff($engines, $report['whole'] ?? []) === [];
		if ($judged && !isset($report['used'][PROBE__AllowKey($entry)]) && array_diff($engines, $ran) === [] && array_intersect($engines, $partial) === []) {
			$report['findings'][] = 'tools/probes/config.json - the exception ' . ($entry['finding'] ?? $entry['rule'] . ' at ' . $entry['target']) . ' allows nothing any more';
		}
	}
	foreach ($report['findings'] as $finding) {
		echo $finding, "\n";
	}
	echo count($report['findings']) === 0 ? 'CLEAN' : count($report['findings']) . ' findings', ' · sheet .dev/probes/index.html', "\n";
	return $report['findings'] === [] ? 0 : 1;
}

/** The exceptions two sheets used, joined: each with the pages either used it on - true, used somewhere, from a sheet
 *  older than the pages it names.
 *  @return array<string, array<string, true>|true> */
function PROBE__UsedJoin(array $a, array $b): array
{
	foreach ($b as $key => $pages) {
		$a[$key] = is_array($pages) && is_array($a[$key] ?? []) ? ($a[$key] ?? []) + $pages : true;
	}
	return $a;
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
			$report['used'] = PROBE__UsedJoin($report['used'], $part['used']);
			$report['findings'] = [...$report['findings'], ...$part['findings']];
			$report['guarded'] = [...$report['guarded'], ...$part['guarded']];
			$report['walked'] = array_replace_recursive($report['walked'], $part['walked']);
			$report['spoken'] = array_merge_recursive($report['spoken'], $part['spoken']);
			$report['read'] = array_merge_recursive($report['read'] ?? [], $part['read'] ?? []);
			$report['shots'] = array_merge_recursive($report['shots'], $part['shots']);
			$report['only'] = array_values(array_unique([...$report['only'] ?? [], ...$part['only'] ?? []]));
			$report['whole'] = array_values(array_unique([...$report['whole'] ?? [], ...$part['whole'] ?? []]));
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
		// An exception the base used on a page checked again is used only if the fresh run used it there.
		$kept = array_filter(array_map(fn(array|bool $pages): array|bool => is_array($pages) ? array_diff_key($pages, array_flip($fresh['only'] ?? [])) : $pages, $under['used']), fn(array|bool $pages): bool => $pages !== []);
		$report['used'] = PROBE__UsedJoin($kept, $fresh['used']);
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
 * build and release tools, the floor's data, the passport, the sheet's own code) or it changed in its comments alone;
 * "page:P" for a page, for each page that loads a package's file, and for each page that holds a component, a utility
 * or a layout class whose stylesheet or script changed - "look:P" for a change of a stylesheet or a picture no reader
 * hears, which the readers leave -; "sample:..." - the config's sample pages - for the probe code, in the engines
 * PROBE_CODE names; PROBE__ConfigReach for the config; "visual" for every page of the desktop engines, with the readers'
 * sample pages when heard - the stylesheets under every page, a utility rule that asks for no class -; the icons'
 * look; "*" for every engine and page - the scripts' entry, anything else.
 * @return list<string>
 */
function PROBE__Reach(array $config, string $base, string $file): array
{
	// tools/dist/ is the build's copy of tools a probe reads in their sources; tools/catalog.json reaches the pages by
	// the editor's catalog the build makes of it; floor.json is the floor checker's.
	$inert = '~\.md$|^skills/|^llms(-full)?\.txt$|^(dist/)?(LICENSE|NOTICE|redz-ui\.json)$|^(\.gitignore|redz-ui-icons\.json|floor\.json)$|^tools/(build|release|map|docs|floor|dashes|judge)\.php$|^tools/(map|floor|dist)/|^tools/(docs|vocabulary|catalog)\.json$|^docs/ar\.tsv$|^\.github/workflows/(check|pages|rerun|probe-part|icons)\.yml$~';
	if (preg_match($inert, $file) === 1) {
		return [];
	}
	if (preg_match('~^(index\.html)$|^docs/src/([\w-]+)\.html$|^(docs|reference/demo)/([\w-]+?)(\.ar)?\.html$~', $file, $m) === 1) {
		$page = match (true) {
			($m[1] ?? '') !== '' => 'index.html',
			($m[2] ?? '') !== '' => 'docs/' . $m[2] . '.html',
			default => $m[3] . '/' . $m[4] . '.html',
		};
		// A page that is gone has nothing to run; the pages that linked to it changed with it.
		return is_file(PROBE_ROOT . '/' . $page) ? ['page:' . $page] : [];
	}
	if (preg_match('~\.(css|js)$~', $file) === 1 && PROBE__CommentsOnly($base, $file)) {
		return [];
	}
	if ($file === 'tools/probes/behave.js') {
		return PROBE__BehaveReach($config, $base);
	}
	if ($file === '.github/workflows/probes.yml') {
		return PROBE__WorkflowReach($base);
	}
	// The probe code is tried on the config's sample pages, the engines it drives each on its own.
	if (array_key_exists($file, PROBE_CODE)) {
		return array_map(fn(string $mark): string => $mark === 'behave' ? $mark : 'sample:' . $mark, PROBE_CODE[$file]);
	}
	if ($file === 'tools/probes/config.json') {
		return PROBE__ConfigReach($config, $base);
	}
	if (preg_match('~^tools/(probe|lib|min)\.php$|^tools/(min|probes)/~', $file) === 1) {
		return ['sample'];
	}
	$folder = (string)strstr($file, '/', true);
	$package = in_array($folder, PROBE_PACKAGES, true) ? $folder : (preg_match('~^dist/(?:css|js)/redz-ui-([a-z]+)~', $file, $m) === 1 && in_array($m[1], PROBE_PACKAGES, true) ? $m[1] : '');
	// A stylesheet's change that a screen reader cannot hear - a colour, a size, a space - reaches the pages' look alone:
	// "look:P", "visual" without the readers; so does a picture.
	$spoken = preg_match('~^(css|docs|reference|' . implode('|', PROBE_PACKAGES) . ')/.+\.css$~', $file) === 1 && PROBE__StyleSpoken($file, $base);
	$seen = (str_ends_with($file, '.css') && !$spoken) || preg_match('~\.(svg|png|jpe?g|webp|avif|gif|ico)$~', $file) === 1 ? 'look:' : 'page:';
	// A component reaches the pages that hold it, and so does a utility or a layout rule that asks for a class. A script
	// that names no markup its pages hold reaches the full pages besides, where the behaviour checks drive the widgets,
	// and the sample; a stylesheet that names nothing is one under every page.
	$classed = preg_match('~^css/(utilities|layout)\.css$~', $file) === 1 && !PROBE__StyleChanged($file, (string)@file_get_contents(PROBE_ROOT . '/' . $file), $base)[3];
	if ($classed || (preg_match('~^css/components/[\w-]+\.css$|^js/[\w-]+\.js$~', $file) === 1 && $file !== 'js/index.js')) {
		$reach = PROBE__ComponentPages($config, $file, $base);
		$pages = array_map(fn(string $page): string => (str_ends_with($file, '.js') ? 'page:' : $seen) . $page, $reach['pages']);
		return match (true) {
			$reach['named'] => $pages,
			str_ends_with($file, '.js') => array_values(array_unique([...$pages, ...array_map(fn(string $page): string => 'page:' . $page, $config['pages']), 'sample'])),
			default => ['visual', ...($spoken ? ['sample:kind:nvda', 'sample:kind:voiceover'] : [])],
		};
	}
	if (preg_match('~^css/[\w.-]+\.css$~', $file) === 1) {
		return ['visual', ...($spoken ? ['sample:kind:nvda', 'sample:kind:voiceover'] : [])];
	}
	if (str_starts_with($file, 'icons/')) {
		return ['visual'];
	}
	// A file the pages load - a picture, the docs' own script or stylesheet - reaches the pages that name it.
	if (preg_match('~^(docs|reference)/.+\.(?!html$)\w+$~', $file) === 1) {
		return array_map(fn(string $page): string => $seen . $page, array_values(array_filter(PROBE__KnownPages($config), fn(string $page): bool => str_contains((string)@file_get_contents(PROBE_ROOT . '/' . $page), basename($file)))));
	}
	if ($package !== '') {
		return array_map(fn(string $page): string => $seen . $page, PROBE__PackagePages($config, $package));
	}
	return ['*'];
}

/** The pages that load the package $package - its stylesheet or its script from dist/.
 *  @return list<string> */
function PROBE__PackagePages(array $config, string $package): array
{
	return array_values(array_filter(PROBE__KnownPages($config), fn(string $page): bool => preg_match('~/redz-ui-' . preg_quote($package, '~') . '[.-]~', (string)@file_get_contents(PROBE_ROOT . '/' . $page)) === 1));
}

/**
 * The pages a component's stylesheet or script reaches, and whether its file names anything a page holds ("named"). A
 * script: PROBE__ScriptReach. A stylesheet: the pages whose markup holds what its changed rules ask (PROBE__StyleChanged),
 * and what the rules of other files ask that run a keyframe it changed; the pages of each script that makes a class or an
 * element those rules ask for (PROBE__MakerPages) - combobox.js its chips -; its own docs page.
 * @return array{pages: list<string>, named: bool}
 */
function PROBE__ComponentPages(array $config, string $file, string $base = ''): array
{
	if (str_ends_with($file, '.js')) {
		return PROBE__ScriptReach($config, $file);
	}
	[$needles, $names, $frames] = PROBE__StyleChanged($file, (string)@file_get_contents(PROBE_ROOT . '/' . $file), $base);
	foreach ($frames as $frame) {
		[$users, $named] = PROBE__AnimationNeedles($frame);
		$needles = [...$needles, ...$users];
		$names = [...$names, ...$named];
	}
	$pages = PROBE__PagesHolding($config, $needles);
	foreach (PROBE__ScriptsNaming($names) as $maker => $direct) {
		$pages = [...$pages, ...PROBE__MakerPages($config, $maker, $names, $direct)];
	}
	// A component's own docs page; a utility's or a layout's shows the class it changed if any, as every page does.
	if (str_starts_with($file, 'css/components/')) {
		$pages[] = 'docs/' . basename($file, '.css') . '.html';
	}
	return ['pages' => array_values(array_intersect(PROBE__KnownPages($config), $pages)), 'named' => $needles !== []];
}

/** The pages among every page some engine runs whose markup - a docs page's main alone - holds one of $needles, each a
 *  list of patterns that must all hold.
 *  @param list<list<string>> $needles
 *  @return list<string> */
function PROBE__PagesHolding(array $config, array $needles): array
{
	return array_values(array_filter(PROBE__KnownPages($config), fn(string $page): bool => array_filter($needles, fn(array $needle): bool => array_filter($needle, fn(string $pattern): bool => preg_match($pattern, PROBE__Markup($page, true)) !== 1) === []) !== []));
}

/**
 * The pages where the script $maker makes what $names name: the pages holding its selectors that hold one of those names
 * - combobox.js makes chips where [data-chips] stands -; when none does, all of its reach for a maker ($direct), nothing
 * for a script that only imports one. A package's script makes them on the pages that load the package, and only there.
 * @param list<string> $names
 * @return list<string>
 */
function PROBE__MakerPages(array $config, string $maker, array $names, bool $direct): array
{
	$package = (string)strstr($maker, '/', true);
	if ($package !== 'js') {
		return PROBE__PackagePages($config, $package);
	}
	$words = array_map(fn(string $name): string => ltrim($name, '.'), $names);
	$narrow = array_values(array_filter(PROBE__ScriptNeedles((string)@file_get_contents(PROBE_ROOT . '/' . $maker)), fn(array $needle): bool => array_filter($words, fn(string $word): bool => str_contains(stripslashes(implode(' ', $needle)), $word)) !== []));
	return match (true) {
		$narrow !== [] => PROBE__PagesHolding($config, $narrow),
		$direct => PROBE__ScriptReach($config, $maker)['pages'],
		default => [],
	};
}

/**
 * The pages a script of js/ reaches, and whether it names markup some page holds ("named"): the pages holding what its
 * selector strings name (PROBE__ScriptNeedles); each page that calls it by its name under REDZ.ui in any of its scripts,
 * and the full pages holding the target of each behaviour check that calls it so (PROBE__UiCalled); its own docs page;
 * and for each script that imports it, near or far, its docs page and its reach among the pages where the probes work
 * the widgets - the full pages, by the behaviour checks, the speech pages, by the speech steps -: its code runs where
 * theirs does, and the other pages are only drawn.
 * @return array{pages: list<string>, named: bool}
 */
function PROBE__ScriptReach(array $config, string $file): array
{
	static $reach = [];
	static $walking = [];
	if (isset($reach[$file])) {
		return $reach[$file];
	}
	if (isset($walking[$file])) {
		return ['pages' => [], 'named' => true];
	}
	$walking[$file] = true;
	$named = PROBE__PagesHolding($config, PROBE__ScriptNeedles((string)@file_get_contents(PROBE_ROOT . '/' . $file)));
	$pages = $named;
	$called = PROBE__UiCalled($file);
	if ($called !== '') {
		$pages = [...$pages, ...array_values(array_filter(PROBE__KnownPages($config), fn(string $page): bool => preg_match($called, PROBE__Markup($page, false)) === 1))];
		foreach (PROBE__BehaveChecks((string)@file_get_contents(PROBE_BEHAVE)) as ['target' => $target, 'text' => $text]) {
			if (preg_match($called, $text) === 1) {
				$pages = [...$pages, ...(PROBE__TargetPages($config, $target) ?? $config['pages'])];
			}
		}
	}
	$pages = [...$pages, 'docs/' . basename($file, '.js') . '.html', ...PROBE__ImporterPages($config, $file)];
	unset($walking[$file]);
	return $reach[$file] = ['pages' => array_values(array_intersect(PROBE__KnownPages($config), $pages)), 'named' => $named !== []];
}

/**
 * The pages where the scripts that import $file, near or far, run its code with theirs: each one's docs page, and among
 * the pages where the probes work the widgets - the full pages, the speech pages - those holding its selectors that
 * carry its own name, where it sets to work (data-track for track.js, .chip-input for chip-input.js); all of its reach
 * there when none does.
 * @param array<string, true> $seen
 * @return list<string>
 */
function PROBE__ImporterPages(array $config, string $file, array $seen = []): array
{
	$worked = [...$config['pages'], ...array_keys($config['speech'])];
	$seen[$file] = true;
	$pages = [];
	foreach (glob(PROBE_ROOT . '/js/*.js') ?: [] as $path) {
		$importer = 'js/' . basename($path);
		if (basename($path) === 'index.js' || isset($seen[$importer]) || preg_match('~^import\s[^;]*[\'"]\./' . preg_quote(basename($file), '~') . '[\'"]~m', (string)file_get_contents($path)) !== 1) {
			continue;
		}
		$name = basename($path, '.js');
		$own = array_values(array_filter(PROBE__ScriptNeedles((string)file_get_contents($path)), fn(array $needle): bool => str_contains(stripslashes(implode(' ', $needle)), $name)));
		$reached = $own !== [] ? PROBE__PagesHolding($config, $own) : PROBE__ScriptReach($config, $importer)['pages'];
		$pages = [...$pages, 'docs/' . $name . '.html', ...array_intersect($reached, $worked), ...PROBE__ImporterPages($config, $importer, $seen)];
	}
	return $pages;
}

/** The pattern of a call of the script $file by its names under REDZ.ui - those js/index.js gives what it imports from
 *  it: REDZ.ui.select for tabs.js's selectTab, REDZ.ui.upload for upload.js's clear -; '' when it gives none. */
function PROBE__UiCalled(string $file): string
{
	static $keys = null;
	if ($keys === null) {
		$keys = [];
		$index = (string)@file_get_contents(PROBE_ROOT . '/js/index.js');
		preg_match_all('~^import\s*\{([^}]*)\}\s*from\s*[\'"]\./([\w-]+\.js)[\'"]~m', $index, $imports, PREG_SET_ORDER);
		$ui = preg_match('~\bui:\s*\{(.*)\}\s*\}\s*\)~s', $index, $m) === 1 ? $m[1] : '';
		// The object's entries at its own depth: a key and the names its value holds.
		$entries = [];
		$depth = 0;
		$entry = '';
		foreach (str_split($ui . ',') as $char) {
			$depth += $char === '{' ? 1 : ($char === '}' ? -1 : 0);
			if ($char === ',' && $depth === 0) {
				if (preg_match('~^\s*([\w$]+)\s*(?::(.*))?$~s', $entry, $part) === 1) {
					preg_match_all('~[\w$]+~', ($part[2] ?? '') === '' ? $part[1] : (string)preg_replace('~[\w$]+\s*:~', '', $part[2]), $values);
					$entries[$part[1]] = $values[0];
				}
				$entry = '';
				continue;
			}
			$entry .= $char;
		}
		foreach ($imports as [, $names, $module]) {
			preg_match_all('~(?:[\w$]+\s+as\s+)?([\w$]+)~', $names, $locals);
			$keys['js/' . $module] = array_keys(array_filter($entries, fn(array $values): bool => array_intersect($values, $locals[1]) !== []));
		}
	}
	return ($keys[$file] ?? []) === [] ? '' : '#REDZ\.ui\.(?:' . implode('|', array_map(fn(string $key): string => preg_quote($key, '#'), $keys[$file])) . ')\b#';
}

/** The markup of $page; with $main what a docs page's main holds - the docs' own header, sidebar and main element, a
 *  menu, a search, the theme, stand on every docs page alike, and the component's own page holds them too -, but the
 *  whole of the page the behaviour checks run on, whose checks drive the shell as well. */
function PROBE__Markup(string $page, bool $main): string
{
	static $markup = [];
	$markup[$page] ??= (string)@file_get_contents(PROBE_ROOT . '/' . $page);
	if (!$main || !str_starts_with($page, 'docs/') || $page === PROBE_BEHAVE_HOME) {
		return $markup[$page];
	}
	return $markup[$page . ' main'] ??= (string)preg_replace('#^.*?<main\b[^>]*>(.*)</main>.*$#s', '$1', $markup[$page]);
}

/** The scripts of js/ that make what $names name, each with true: a class - ".name" - they give an element (className,
 *  a class attribute in markup they write, classList.add, toggle or replace), an element - "name" - they create; and with
 *  false each script that imports one of those, as it may make them by the other's hand - chip-input.js draws its chips
 *  by combobox.js's chipOf(). A script that only seeks a class holds it in its selectors, and its pages hold it.
 *  @param list<string> $names
 *  @return array<string, bool> */
function PROBE__ScriptsNaming(array $names): array
{
	static $made = null;
	static $imports = [];
	if ($made === null) {
		$made = [];
		foreach (glob(PROBE_ROOT . '/{js,' . implode(',', PROBE_PACKAGES) . '}/*.js', GLOB_BRACE) ?: [] as $path) {
			if ($path === PROBE_ROOT . '/js/index.js') {
				continue;
			}
			$script = basename(dirname($path)) . '/' . basename($path);
			$js = PROBE__Code((string)file_get_contents($path), 'js');
			preg_match_all('#^import\s[^;]*[\'"]\./([\w-]+\.js)[\'"]#m', $js, $from);
			$imports[$script] = array_map(fn(string $file): string => dirname($script) . '/' . $file, $from[1]);
			preg_match_all('#className\s*[:=]\s*([\'"`])((?:\\\\.|(?!\1).)*?)\1|\bclass=\\\\?["\']([^"\'\\\\]*)|classList\.(?:add|toggle|replace)\(([^)]*)\)|setAttribute\(\s*[\'"]class[\'"]\s*,\s*([\'"`])((?:\\\\.|(?!\5).)*?)\5#s', $js, $found, PREG_SET_ORDER);
			$classes = [];
			foreach ($found as $one) {
				$text = ($one[2] ?? '') . ' ' . ($one[3] ?? '') . ' ' . ($one[6] ?? '');
				if (($one[4] ?? '') !== '') {
					preg_match_all('#([\'"`])((?:\\\\.|(?!\1).)*?)\1#s', $one[4], $strings);
					$text .= ' ' . implode(' ', $strings[2]);
				}
				preg_match_all('#-?[_a-zA-Z][\w-]*#', $text, $words);
				$classes = [...$classes, ...array_map(fn(string $word): string => '.' . $word, $words[0])];
			}
			preg_match_all('#createElement(?:NS)?\((?:[^,)]*,\s*)?[\'"]([\w-]+)[\'"]#', $js, $elements);
			$made[$script] = array_flip([...$classes, ...array_map('strtolower', $elements[1])]);
		}
	}
	$names = array_flip($names);
	$makers = array_keys(array_filter($made, fn(array $found): bool => array_intersect_key($names, $found) !== []));
	return array_fill_keys(array_keys(array_filter($imports, fn(array $from): bool => array_intersect($from, $makers) !== [])), false) + array_fill_keys($makers, true);
}

/** The class attribute holding $class, as a pattern on a page's markup. */
function PROBE__ClassNeedle(string $class): string
{
	return '#class="(?:[^"]*\s)?' . preg_quote($class, '#') . '(?:\s[^"]*)?"#';
}

/** A class - ".name" - or an element - "name" -, as a pattern on a page's markup; one of several such names when given
 *  a list. */
function PROBE__NameNeedle(string ...$names): string
{
	$classes = array_map(fn(string $name): string => preg_quote(substr($name, 1), '#'), array_values(array_filter($names, fn(string $name): bool => str_starts_with($name, '.'))));
	$types = array_map(fn(string $name): string => preg_quote($name, '#'), array_values(array_filter($names, fn(string $name): bool => !str_starts_with($name, '.'))));
	return '#' . implode('|', [...($classes === [] ? [] : ['class="(?:[^"]*\s)?(?:' . implode('|', $classes) . ')(?:\s[^"]*)?"']), ...($types === [] ? [] : ['<(?i:' . implode('|', $types) . ')[\s>/]'])]) . '#';
}

/**
 * What a change of the behaviour checks since $base reaches: "behave:P" for each full page PROBE__TargetPages gives the
 * target of a check whose lines changed - on the side the diff adds them and the side it removes them -; "behave", every
 * full page, for a change outside the checks - their helpers before them, the runner after them -, a target with no id
 * or class to look for, or no diff to read.
 * @return list<string>
 */
function PROBE__BehaveReach(array $config, string $base): array
{
	$file = 'tools/probes/behave.js';
	$diff = PROBE__Diff($base, $file);
	if (preg_match_all('#^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@#m', $diff, $hunks, PREG_SET_ORDER) === 0) {
		return ['behave'];
	}
	try {
		$sides = ['old' => PROBE__Run(['git', '-C', PROBE_ROOT, 'show', $base . ':' . $file]), 'new' => (string)file_get_contents(PROBE_ROOT . '/' . $file)];
	} catch (RuntimeException) {
		return ['behave'];
	}
	$targets = [];
	foreach ($sides as $side => $text) {
		$checks = PROBE__BehaveChecks($text);
		foreach ($hunks as $hunk) {
			[$from, $count] = $side === 'old' ? [(int)$hunk[1], ($hunk[2] ?? '') === '' ? 1 : (int)$hunk[2]] : [(int)$hunk[3], ($hunk[4] ?? '') === '' ? 1 : (int)$hunk[4]];
			foreach ($count > 0 ? range($from, $from + $count - 1) : [] as $line) {
				$at = array_values(array_filter($checks, fn(array $check): bool => $check['from'] <= $line && $check['to'] >= $line));
				if ($at === []) {
					return ['behave'];
				}
				$targets[] = $at[0]['target'];
			}
		}
	}
	$marks = [];
	foreach (array_unique($targets) as $target) {
		$pages = PROBE__TargetPages($config, $target);
		if ($pages === null) {
			return ['behave'];
		}
		$marks = [...$marks, ...array_map(fn(string $page): string => 'behave:' . $page, $pages)];
	}
	return array_values(array_unique($marks));
}

/**
 * The behaviour checks of behave.js's text, each its name, its target, its first and last line and its text: a check
 * starts on its own line, name: {target: '...', and runs to the next one, the last to the line before the one that
 * closes the checks. None when that line is not found.
 * @return list<array{name: string, target: string, from: int, to: int, text: string}>
 */
function PROBE__BehaveChecks(string $text): array
{
	$lines = explode("\n", $text);
	$checks = [];
	foreach ($lines as $i => $line) {
		if (preg_match("#^\t\t(\w+): \{target: '([^']+)'#", $line, $m) === 1) {
			if ($checks !== []) {
				$checks[count($checks) - 1]['to'] = $i;
			}
			$checks[] = ['name' => $m[1], 'target' => $m[2], 'from' => $i + 1, 'to' => 0];
		} elseif ($checks !== [] && preg_match("#^\t\};#", $line) === 1) {
			$checks[count($checks) - 1]['to'] = $i;
			return array_map(fn(array $check): array => $check + ['text' => implode("\n", array_slice($lines, $check['from'] - 1, $check['to'] - $check['from'] + 1))], $checks);
		}
	}
	return [];
}

/** The full pages that hold a check's target - by its id, else its first class -; the page that names the checks that
 *  find no target (PROBE_BEHAVE_HOME) when none does; null when the target has neither to look for. */
function PROBE__TargetPages(array $config, string $target): ?array
{
	if (preg_match('#\#([\w-]+)|\.(-?[_a-zA-Z][\w-]*)#', $target, $m) !== 1) {
		return null;
	}
	$needle = ($m[1] ?? '') !== '' ? '#\sid="' . preg_quote($m[1], '#') . '"#' : PROBE__ClassNeedle($m[2]);
	return array_values(array_filter($config['pages'], fn(string $page): bool => preg_match($needle, PROBE__Markup($page, false)) === 1)) ?: [PROBE_BEHAVE_HOME];
}

/**
 * What the rules of the stylesheet $file that changed since $base ask of a page's markup, and the names they ask for, as
 * PROBE__StyleNeedles says them - the rules on its lines that the diff adds, and the rules on its lines it removes, read
 * in $base's copy -; every rule's when there is no $base or no diff, as for a file git does not track yet, and when one
 * of those rules asks for nothing a page's markup shows: such a rule of a component's file acts where the component is.
 * With them the keyframes whose frames changed, and whether one of the changed rules asks for nothing a page shows.
 * @return array{list<list<string>>, list<string>, list<string>, bool}
 */
function PROBE__StyleChanged(string $file, string $text, string $base): array
{
	$diff = $base === '' ? '' : PROBE__Diff($base, $file);
	if (preg_match_all('#^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@#m', $diff, $hunks, PREG_SET_ORDER) === 0) {
		[$needles, $names, $open, $frames] = PROBE__StyleNeedles($text);
		return [$needles, $names, $frames, $open];
	}
	$old = [];
	$new = [];
	foreach ($hunks as $hunk) {
		[$oldCount, $newCount] = [($hunk[2] ?? '') === '' ? 1 : (int)$hunk[2], ($hunk[4] ?? '') === '' ? 1 : (int)$hunk[4]];
		$old = [...$old, ...($oldCount > 0 ? range((int)$hunk[1], (int)$hunk[1] + $oldCount - 1) : [])];
		$new = [...$new, ...($newCount > 0 ? range((int)$hunk[3], (int)$hunk[3] + $newCount - 1) : [])];
	}
	try {
		$was = $old === [] ? '' : PROBE__Run(['git', '-C', PROBE_ROOT, 'show', $base . ':' . $file]);
	} catch (RuntimeException) {
		$was = '';
	}
	$sides = [...($new === [] ? [] : [PROBE__StyleNeedles($text, $new)]), ...($was === '' ? [] : [PROBE__StyleNeedles($was, $old)])];
	$frames = array_values(array_unique(array_merge([], ...array_column($sides, 3))));
	$open = in_array(true, array_column($sides, 2), true);
	if ($open) {
		$sides = [PROBE__StyleNeedles($text), ...($was === '' ? [] : [PROBE__StyleNeedles($was)])];
	}
	return [array_values(array_unique(array_merge([], ...array_column($sides, 0)), SORT_REGULAR)), array_values(array_unique(array_merge([], ...array_column($sides, 1)))), $frames, $open];
}

/**
 * Whether the change of the stylesheet $file since $base can change what a screen reader hears: a declaration it changes
 * of a property that shows, hides or words things for a reader - display, visibility, content, list-style, counters,
 * quotes -, or of a custom property one of those reads; a selector, a brace or an at-rule it changes over a rule that
 * holds one. A colour, a size, a space no reader hears. Yes when there is no diff to read - a file new since $base.
 */
function PROBE__StyleSpoken(string $file, string $base): bool
{
	$diff = PROBE__Diff($base, $file);
	if (preg_match_all('#^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@#m', $diff, $hunks, PREG_SET_ORDER) === 0) {
		return true;
	}
	try {
		$sides = ['old' => PROBE__Run(['git', '-C', PROBE_ROOT, 'show', $base . ':' . $file]), 'new' => (string)@file_get_contents(PROBE_ROOT . '/' . $file)];
	} catch (RuntimeException) {
		return true;
	}
	// A scroller with nothing to focus in it is a Tab stop of its own in Chrome from 130, which a reader announces.
	$heard = '~^(display|visibility|content|content-visibility|interactivity|list-style(-type|-image)?|counter-(reset|increment|set)|quotes|speak(-as)?|overflow(-x|-y|-block|-inline)?)$~';
	foreach ($sides as $side => $text) {
		$text = (string)preg_replace_callback('#/\*.*?\*/#s', fn(array $m): string => (string)preg_replace('#[^\n]#', ' ', $m[0]), $text);
		$declarations = fn(string $block): array => preg_match_all('#(?:^|[{;\n])\s*([\w-]+)\s*:([^;{}]*)#', $block, $found, PREG_SET_ORDER) > 0 ? $found : [];
		// The custom properties a heard property reads, and those they read in turn.
		$read = [];
		do {
			$before = count($read);
			foreach ($declarations($text) as [, $name, $value]) {
				if (preg_match($heard, $name) === 1 || isset($read[$name])) {
					preg_match_all('#var\(\s*(--[\w-]+)#', $value, $vars);
					$read += array_fill_keys($vars[1], true);
				}
			}
		} while (count($read) > $before);
		$lines = explode("\n", $text);
		$rules = PROBE__StyleRules($text);
		foreach ($hunks as $hunk) {
			[$from, $count] = $side === 'old' ? [(int)$hunk[1], ($hunk[2] ?? '') === '' ? 1 : (int)$hunk[2]] : [(int)$hunk[3], ($hunk[4] ?? '') === '' ? 1 : (int)$hunk[4]];
			foreach ($count > 0 ? range($from, $from + $count - 1) : [] as $at) {
				$line = trim($lines[$at - 1] ?? '');
				if ($line === '') {
					continue;
				}
				// A declaration alone is read as it stands; anything else - a selector, a brace, an at-rule, a value's
				// next line - with the whole of the innermost rule around it. Outside every rule - an @import, the order
				// of the layers - it moves rules from one cascade to another: heard.
				$block = $line;
				if (!str_contains($line, ':') || str_contains($line, '{') || str_ends_with($line, ',')) {
					$around = array_filter($rules, fn(array $rule): bool => $rule[1] <= $at && $rule[2] >= $at);
					if ($around === []) {
						return true;
					}
					usort($around, fn(array $a, array $b): int => $b[1] <=> $a[1]);
					$block .= "\n" . implode("\n", array_slice($lines, $around[0][1] - 1, $around[0][2] - $around[0][1] + 1));
				}
				foreach ($declarations($block) as [, $name]) {
					if (preg_match($heard, $name) === 1 || isset($read[$name])) {
						return true;
					}
				}
			}
		}
	}
	return false;
}

/**
 * The rules of a stylesheet: each block's prelude - a selector list, or an at-rule's - with the lines it starts and
 * ends on.
 * @return list<array{string, int, int}>
 */
function PROBE__StyleRules(string $css): array
{
	$css = (string)preg_replace_callback('#/\*.*?\*/#s', fn(array $m): string => (string)preg_replace('#[^\n]#', ' ', $m[0]), $css);
	$rules = [];
	$open = [];
	$prelude = '';
	$line = 1;
	$from = 1;
	for ($i = 0, $n = strlen($css); $i < $n; $i++) {
		$char = $css[$i];
		if ($char === '{') {
			$open[] = [trim($prelude), $from];
			$prelude = '';
		} elseif ($char === '}') {
			[$text, $start] = array_pop($open) ?? ['', $line];
			$rules[] = [$text, $start, $line];
			$prelude = '';
		} elseif ($char === ';') {
			$prelude = '';
		} else {
			if (trim($prelude) === '' && !ctype_space($char)) {
				$from = $line;
			}
			$prelude .= $char;
		}
		$line += $char === "\n" ? 1 : 0;
	}
	return $rules;
}

/**
 * What the stylesheet $css asks of a page's markup, as PROBE__SelectorNeedles says it, for the rules on the $lines
 * given - every rule of an at-rule whose own line is among them -, or for every rule when $lines is null or reaches none:
 * the needles, the names they ask for, whether one of the chosen rules is open - it asks for nothing a page's markup
 * shows, or it is a frame of @keyframes, which acts wherever its animation runs -, and the keyframes those frames are
 * of. Every rule's open selectors are left out.
 * @param list<int>|null $lines
 * @return array{list<list<string>>, list<string>, bool, list<string>}
 */
function PROBE__StyleNeedles(string $css, ?array $lines = null): array
{
	$rules = PROBE__StyleRules($css);
	$needles = [];
	$names = [];
	$open = false;
	$frames = [];
	$chosen = 0;
	foreach ($rules as [$prelude, $start, $end]) {
		if (str_starts_with($prelude, '@') || $prelude === '') {
			continue;
		}
		$touched = $lines === null || array_filter($lines, fn(int $line): bool => $line >= $start && $line <= $end) !== [];
		$frame = '';
		foreach ($rules as [$outer, $outerStart, $outerEnd]) {
			$around = str_starts_with($outer, '@') && $outerStart <= $start && $outerEnd >= $end && [$outer, $outerStart, $outerEnd] !== [$prelude, $start, $end];
			$touched = $touched || ($around && in_array($outerStart, $lines ?? [], true));
			$frame = $around && preg_match('#^@(?:-webkit-)?keyframes\s+([\w-]+)#', $outer, $m) === 1 ? $m[1] : $frame;
		}
		if (!$touched) {
			continue;
		}
		$chosen++;
		[$found, $named, $loose] = $frame !== '' ? [[], [], true] : PROBE__SelectorNeedles($prelude);
		$needles = [...$needles, ...$found];
		$names = [...$names, ...$named];
		$open = $open || $loose;
		$frames = $frame === '' ? $frames : [...$frames, $frame];
	}
	if ($chosen === 0 && $lines !== null) {
		return PROBE__StyleNeedles($css);
	}
	return [array_values(array_unique($needles, SORT_REGULAR)), array_values(array_unique($names)), $open, array_values(array_unique($frames))];
}

/**
 * What the rules of the components' stylesheets that run the keyframes $frame ask of a page's markup - an animation of
 * that name in their declarations -, and the names they ask for, as PROBE__SelectorNeedles says them.
 * @return array{list<list<string>>, list<string>}
 */
function PROBE__AnimationNeedles(string $frame): array
{
	$needles = [];
	$names = [];
	foreach (glob(PROBE_ROOT . '/css/components/*.css') ?: [] as $path) {
		$css = (string)file_get_contents($path);
		$lines = explode("\n", $css);
		foreach (PROBE__StyleRules($css) as [$prelude, $start, $end]) {
			if (!str_starts_with($prelude, '@') && $prelude !== '' && preg_match('#animation(?:-name)?\s*:[^;{}]*(?<![\w-])' . preg_quote($frame, '#') . '(?![\w-])#', implode("\n", array_slice($lines, $start - 1, $end - $start + 1))) === 1) {
				[$found, $named] = PROBE__SelectorNeedles($prelude);
				$needles = [...$needles, ...$found];
				$names = [...$names, ...$named];
			}
		}
	}
	return [$needles, $names];
}

/**
 * What each selector of a selector list asks of a page's markup to match, as patterns that must all hold: its classes,
 * else its elements - but html and body, which every page has -; one of the classes or elements :is(), :where() or
 * :has() hold - nothing when one of their selectors holds neither -; nothing of :not() or another functional
 * pseudo-class, as it may ask for less; nothing of an attribute, as a script sets most of them while the page lives - a
 * state, the theme, the direction, a role. Answers the needles, the names they ask for (".class" or "element"), and
 * whether a selector is open: it asks for none of those, or it has an escaped name.
 * @return array{list<list<string>>, list<string>, bool}
 */
function PROBE__SelectorNeedles(string $prelude): array
{
	if (str_contains($prelude, '\\')) {
		return [[], [], true];
	}
	$needles = [];
	$names = [];
	$open = false;
	$either = [];
	$prelude = (string)preg_replace('#\[[^\]]*\]#', '', $prelude);
	do {
		$prelude = (string)preg_replace_callback('#:([\w-]+)\(([^()]*)\)#', function (array $m) use (&$either): string {
			$alternatives = array_map('PROBE__SelectorNames', explode(',', $m[2]));
			if (!in_array($m[1], ['is', 'where', 'has'], true) || in_array([], $alternatives, true)) {
				return '';
			}
			$either[] = array_values(array_unique(array_merge(...$alternatives)));
			return ' %' . (count($either) - 1) . '% ';
		}, $prelude, -1, $count);
	} while ($count > 0);
	foreach (explode(',', $prelude) as $selector) {
		preg_match_all('#%(\d+)%#', $selector, $marks);
		$own = PROBE__SelectorNames((string)preg_replace('#%\d+%#', ' ', $selector));
		$one = array_map(fn(string $mark): array => $either[(int)$mark], $marks[1]);
		$needle = [...array_map(fn(string $name): string => PROBE__NameNeedle($name), $own), ...array_map(fn(array $names): string => PROBE__NameNeedle(...$names), $one)];
		if ($needle === []) {
			$open = true;
			continue;
		}
		$needles[] = array_values(array_unique($needle));
		$names = [...$names, ...$own, ...array_merge([], ...$one)];
	}
	return [$needles, array_values(array_unique($names)), $open];
}

/** The names a compound selector asks for: its classes as ".class", else its elements - but html and body.
 *  @return list<string> */
function PROBE__SelectorNames(string $selector): array
{
	$selector = (string)preg_replace(['#\[[^\]]*\]#', '#::?[\w-]+(\([^()]*\))?#'], '', $selector);
	if (preg_match_all('#\.(-?[_a-zA-Z][\w-]*)#', $selector, $classes) > 0) {
		return array_values(array_unique(array_map(fn(string $class): string => '.' . $class, $classes[1])));
	}
	preg_match_all('#(?:^|[\s>+~])([a-zA-Z][\w-]*)#', $selector, $types);
	return array_values(array_diff(array_unique(array_map('strtolower', $types[1])), ['html', 'body']));
}

/**
 * What a script's selector strings name that a page's markup could hold - classes, data attributes, roles, commands,
 * attributes with a value of their own -, and the classes and data its classList and dataset touch, as patterns, each
 * enough alone. An attribute any widget may carry - [href], [hidden], aria-hidden="true" - counts only for a script that
 * names nothing narrower.
 * @return list<list<string>>
 */
function PROBE__ScriptNeedles(string $js): array
{
	$js = PROBE__Code($js, 'js');
	// A class at the edge where a string is joined to a name is not one: key + '.other', '.chip-' + tone.
	preg_match_all('#(\+\s*)?([\'"`])((?:\\\\.|(?!\2).)*?)\2(\s*\+)?#s', $js, $found, PREG_SET_ORDER);
	$strings = [2 => array_map(fn(array $one): string => (string)preg_replace([...(($one[1] ?? '') === '' ? [] : ['#^\.[\w-]*#']), ...(($one[4] ?? '') === '' ? [] : ['#\.[\w-]*$#'])], '', $one[3]), $found)];
	$narrow = [];
	$broad = [];
	// The class words of a list a script tests an element's classes against: ['menu', 'popover'].some((name) =>
	// el.classList.contains(name)).
	foreach (explode("\n", $js) as $line) {
		if (preg_match('#classList\.(?:contains|add|remove|toggle)\(\s*[A-Za-z_$][\w$]*\s*\)#', $line) === 1 && preg_match_all('#\[\s*((?:[\'"][\w-]+[\'"]\s*,\s*)*[\'"][\w-]+[\'"])\s*\]#', $line, $lists) > 0) {
			preg_match_all('#[\'"]([\w-]+)[\'"]#', implode(',', $lists[1]), $words);
			$narrow = [...$narrow, ...array_map('PROBE__ClassNeedle', $words[1])];
		}
	}
	foreach ($strings[2] as $string) {
		preg_match_all('#\[([a-z][\w-]*)(?:\s*[~|^$*]?=\s*\\\\?["\']?([^"\'\]\\\\]*))?#', $string, $attributes, PREG_SET_ORDER);
		foreach ($attributes as $attribute) {
			[, $name, $value] = $attribute + [2 => ''];
			$common = preg_match('#^(aria-[\w-]+|value|hidden|disabled|tabindex|href|id|name|lang|dir|command|commandfor|popovertarget)$#', $name) === 1 && !str_starts_with($value, '--') && ($value === '' || !str_starts_with($name, 'aria-') || in_array($value, ['true', 'false'], true));
			$pattern = $value === '' ? '#\s' . preg_quote($name, '#') . '[\s=>/]#' : '#\s' . preg_quote($name, '#') . '="' . preg_quote($value, '#') . '"#';
			if ($common || ($value === '' && !str_starts_with($name, 'data-'))) {
				$broad[] = $pattern;
			} else {
				$narrow[] = $pattern;
			}
		}
		preg_match_all('#(?:^|[\s,>+~(])\.(-?[_a-zA-Z][\w-]*)#', $string, $classes);
		foreach ($classes[1] as $class) {
			// An icon stands on almost every page.
			if (preg_match('#^bi(-|$)#', $class) === 1) {
				$broad[] = PROBE__ClassNeedle($class);
			} else {
				$narrow[] = PROBE__ClassNeedle($class);
			}
		}
		if (preg_match('#^--[a-z][\w-]*$#', $string) === 1) {
			$narrow[] = '#command="' . preg_quote($string, '#') . '"#';
		}
	}
	preg_match_all('#classList\.(?:add|remove|toggle|contains|replace)\(\s*[\'"]([\w-]+)#', $js, $listed);
	preg_match_all('#dataset\.([a-zA-Z]+)#', $js, $data);
	$narrow = [...$narrow, ...array_map('PROBE__ClassNeedle', $listed[1]), ...array_map(fn(string $key): string => '#\sdata-' . strtolower((string)preg_replace('#[A-Z]#', '-$0', $key)) . '[\s=>/]#', $data[1])];
	return array_map(fn(string $pattern): array => [$pattern], array_values(array_unique($narrow ?: $broad)));
}

/**
 * What the change of the probes' workflow since $base reaches, as PROBE__Reach's marks: "part:NAME", every page of it,
 * for each part its list ALL adds or changes - a runner, a share -; "sample", the sample pages in every engine, which
 * prove the workflow still runs, for a change anywhere else but its comments - a step, a trigger -; everything when the
 * list cannot be read.
 * @return list<string>
 */
function PROBE__WorkflowReach(string $base): array
{
	$file = '.github/workflows/probes.yml';
	$list = '~^  ALL: >-\n((?:    .*\n)+)~m';
	// A part runs on its own runner, else on the one the probes job names when it has none.
	$default = '~matrix\.part\.runner \|\| \'([\w.-]+)\'~';
	$parts = fn(string $text): ?array => preg_match($list, $text, $m) === 1 && preg_match($default, $text, $d) === 1 && is_array($all = json_decode((string)preg_replace('~\s+~', ' ', $m[1]), true)) ? array_map(function (array $part) use ($d): array {
		$part += ['runner' => $d[1]];
		ksort($part);
		return $part;
	}, array_column($all, null, 'name')) : null;
	$rest = fn(string $text): string => (string)preg_replace([$list, '~^\s*#.*\n~m', $default], '', $text);
	try {
		$was = PROBE__Run(['git', '-C', PROBE_ROOT, 'show', $base . ':' . $file]);
	} catch (RuntimeException) {
		return ['*'];
	}
	$now = (string)@file_get_contents(PROBE_ROOT . '/' . $file);
	[$old, $new] = [$parts($was), $parts($now)];
	if ($old === null || $new === null) {
		return ['*'];
	}
	$marks = array_map(fn(string $name): string => 'part:' . $name, array_keys(array_filter($new, fn(array $part, string $name): bool => ($old[$name] ?? null) !== $part, ARRAY_FILTER_USE_BOTH)));
	return $rest($was) === $rest($now) ? $marks : [...$marks, 'sample'];
}

/**
 * What the config's change since $base reaches, as PROBE__Reach's marks: the engine whose entry changed; the page whose
 * speech steps changed, or every reader when a page lost them all; the engines an exception added or removed names
 * (every engine for one that names none); the NVDA engines for NVDA's settings; the sample pages for the sample; nothing
 * for "check"; everything for any other key.
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
		// The engines a Mac checks before a commit choose nothing a probe does.
		if ($was === $is || $key === 'check') {
			continue;
		}
		if ($key === 'engines' || $key === 'speech') {
			foreach (array_unique([...array_keys($was), ...array_keys($is)]) as $name) {
				// An engine's words of why change nothing it runs.
				$entry = fn(?array $engine): ?array => $engine === null || $key !== 'engines' ? $engine : array_diff_key($engine, ['why' => true]);
				if ($entry($was[$name] ?? null) !== $entry($is[$name] ?? null)) {
					$reach = [...$reach, ...($key === 'engines' ? ['engine:' . $name] : (isset($is[$name]) ? ['speech:' . $name] : ['kind:voiceover', 'kind:nvda']))];
				}
			}
		} elseif ($key === 'allow') {
			$entries = fn(array $list): array => array_map(fn(array $entry): string => json_encode($entry), $list);
			foreach (array_merge(array_diff($entries($was), $entries($is)), array_diff($entries($is), $entries($was))) as $entry) {
				$reach = [...$reach, ...array_map(fn(string $name): string => 'engine:' . $name, json_decode($entry, true)['engines'] ?? ['*'])];
			}
		} elseif ($key === 'simulators') {
			// The builds it blocks choose whether every iOS engine runs; its why, nothing.
			if (array_diff_key((array)$was, ['why' => true]) !== array_diff_key((array)$is, ['why' => true])) {
				$reach = [...$reach, ...array_map(fn(string $name): string => 'engine:' . $name, array_keys(array_filter($config['engines'], fn(array $engine): bool => isset($engine['ios']))))];
			}
		} else {
			$reach[] = match ($key) {
				'nvda' => 'kind:nvda',
				'sample' => 'sample',
				default => '*',
			};
		}
	}
	return array_values(array_unique(array_map(fn(string $mark): string => $mark === 'engine:*' ? '*' : $mark, $reach)));
}

/** Whether the stylesheet or script $file changed since $base in its comments and its spacing alone, which no engine
 *  renders or runs: its code - PROBE__Code - reads the same in both. Not for a file new or gone since $base. */
function PROBE__CommentsOnly(string $base, string $file): bool
{
	$now = @file_get_contents(PROBE_ROOT . '/' . $file);
	try {
		$was = PROBE__Run(['git', '-C', PROBE_ROOT, 'show', $base . ':' . $file]);
	} catch (RuntimeException) {
		return false;
	}
	$kind = str_ends_with($file, '.js') ? 'js' : 'css';
	if (!is_string($now) || PROBE__Code($was, $kind) !== PROBE__Code($now, $kind)) {
		return false;
	}
	// In a script each changed line is a comment's own, as a slash the reading above mistakes stays code.
	foreach ($kind === 'js' ? explode("\n", PROBE__Diff($base, $file)) : [] as $line) {
		if (preg_match('#^[+-](?![+-]{2} )#', $line) === 1 && preg_match('#^[+-]\s*(//|/\*|\*|$)#', $line) !== 1) {
			return false;
		}
	}
	return true;
}

/**
 * The code of a script ("js") or a stylesheet ("css") without its comments, its spacing made one: a run of white space
 * one space, or one line break when it holds one - a script's line breaks can end its statements. A string stays as
 * written, a comment marker inside it too; a stylesheet has no line comment, as // starts a URL in it.
 */
function PROBE__Code(string $text, string $kind): string
{
	// Kept as written: a string, and in a script a regular expression literal - a slash where an operand starts, after
	// an operator, a bracket or return -, whose slashes are no comment.
	$keep = '"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'' . ($kind === 'js' ? '|`(?:\\\\.|[^`\\\\])*`|(?:(?<=[(,=:\[!&|?{};+\-*%<>~^])|(?<=\breturn)|(?<=\btypeof)|^)[ \t]*/(?![*/])(?:\\\\.|\[(?:\\\\.|[^\]\\\\\n])*\]|[^/\\\\\n\[])+/[a-z]*' : '');
	$text = (string)preg_replace_callback('#(' . $keep . ')|/\*.*?\*/' . ($kind === 'js' ? '|//[^\n]*' : '') . '#sm', fn(array $m): string => ($m[1] ?? '') !== '' ? $m[1] : (str_starts_with($m[0], '/*') ? ' ' : ''), $text);
	return trim((string)preg_replace_callback('#(' . $keep . ')|\s+#sm', fn(array $m): string => ($m[1] ?? '') !== '' ? $m[1] : (str_contains($m[0], "\n") ? "\n" : ' '), $text));
}

/** The tree of the working copy as it stands, the files git does not track yet among them - but those it ignores -:
 *  git's index copied, the working copy added to the copy. The same tree for each call of one process. */
function PROBE__WorkTree(): string
{
	static $tree = null;
	if ($tree !== null) {
		return $tree;
	}
	$index = sys_get_temp_dir() . '/redz-ui-index-' . getmypid();
	@unlink($index);
	try {
		$real = trim(PROBE__Run(['git', '-C', PROBE_ROOT, 'rev-parse', '--path-format=absolute', '--git-path', 'index']));
		if (is_file($real)) {
			copy($real, $index);
		} else {
			PROBE__Run(['git', '-C', PROBE_ROOT, 'read-tree', 'HEAD'], ['GIT_INDEX_FILE' => $index]);
		}
		PROBE__Run(['git', '-C', PROBE_ROOT, 'add', '--all'], ['GIT_INDEX_FILE' => $index]);
		return $tree = trim(PROBE__Run(['git', '-C', PROBE_ROOT, 'write-tree'], ['GIT_INDEX_FILE' => $index]));
	} finally {
		@unlink($index);
	}
}

/** The changes of $file between $base - a commit or a tree - and the working copy, with no lines around them; a file
 *  moved is a file gone and a file new. */
function PROBE__Diff(string $base, string $file): string
{
	return PROBE__Run(['git', '-C', PROBE_ROOT, 'diff', '-U0', '--no-color', '--no-renames', $base, PROBE__WorkTree(), '--', $file]);
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

/** Each file changed between $base - a commit or a tree - and the working copy (PROBE__WorkTree), with what it asks of
 *  the probes (PROBE__Reach's marks). A built file of dist/ asks nothing when the sources it is built from changed with
 *  it and the build did not - the sources say what they reach -, and everything otherwise.
 *  @return array<string, list<string>> */
function PROBE__Changed(array $config, string $base): array
{
	$changed = [];
	foreach (array_filter(explode("\n", PROBE__Run(['git', '-C', PROBE_ROOT, 'diff', '--name-only', '--no-renames', $base, PROBE__WorkTree()]))) as $file) {
		$changed[$file] = PROBE__Reach($config, $base, $file);
	}
	$sources = preg_grep('~^(css|js|icons|' . implode('|', PROBE_PACKAGES) . ')/~', array_keys($changed));
	$build = preg_grep('~^tools/(build|min|lib|floor)(\.php$|/)~', array_keys($changed));
	foreach ($sources === [] || $build !== [] ? [] : preg_grep('~^dist/~', array_keys($changed)) as $file) {
		$changed[$file] = [];
	}
	return $changed;
}

/**
 * What the changed files $changed ask of a part of CI, whose engines are $part['engines'], in its $part['share'] of the
 * pages when it has one: "full" - every page of its engines, as a file reaches the whole of one ("visual" the whole of a
 * desktop engine), or a page no engine knows -, "pages" with the pages of its engines they reach - "behave" the full
 * pages of a desktop browser, "sample" the config's sample pages -, or "none"; and "why", the files that make it run -
 * those that make it run whole, when it does.
 * @param array<string, list<string>> $changed
 * @return array{mode: string, pages: list<string>, why: list<string>}
 */
function PROBE__PartRun(array $config, array $changed, array $part): array
{
	$known = PROBE__KnownPages($config);
	$share = PROBE__ShareOf($part['share'] ?? '');
	$config = $share === null ? $config : PROBE__Share($config, $share);
	$pages = [];
	$why = [];
	$whole = [];
	foreach ($changed as $file => $marks) {
		foreach ($marks as $mark) {
			[$what, $value] = explode(':', $mark, 2) + [1 => ''];
			foreach (preg_split('~\s+~', trim($part['engines'])) as $name) {
				$engine = $config['engines'][$name] ?? null;
				$reader = in_array($engine['kind'] ?? '', ['voiceover', 'nvda'], true);
				$full = $engine === null || match ($what) {
					'*' => true,
					'visual' => !$reader,
					'kind' => $engine['kind'] === $value,
					'browser' => ($engine['browser'] ?? '') === $value,
					'engine' => $name === $value,
					'part' => ($part['name'] ?? '') === $value,
					'page' => !in_array($value, $known, true),
					'look' => !$reader && !in_array($value, $known, true),
					default => false,
				};
				if ($full) {
					$whole[] = $file;
					continue;
				}
				$before = count($pages);
				[$by, $which] = explode(':', $value, 2) + [1 => ''];
				if ($what === 'sample' && ($value === '' || ($by === 'kind' && $engine['kind'] === $which) || ($by === 'browser' && ($engine['browser'] ?? '') === $which))) {
					$pages = [...$pages, ...array_intersect($config['sample'] ?? [], PROBE__EnginePages($config, $name))];
				}
				if (($what === 'page' || ($what === 'look' && !$reader) || ($what === 'speech' && $reader)) && in_array($value, PROBE__EnginePages($config, $name), true)) {
					$pages[] = $value;
				}
				if ($what === 'behave' && !$reader && !isset($engine['ios'])) {
					$pages = [...$pages, ...($value === '' ? $config['pages'] : array_intersect([$value], $config['pages']))];
				}
				if (count($pages) > $before) {
					$why[] = $file;
				}
			}
		}
	}
	if ($whole !== []) {
		return ['mode' => 'full', 'pages' => [], 'why' => array_values(array_unique($whole))];
	}
	$pages = array_values(array_unique($pages));
	return ['mode' => $pages === [] ? 'none' : 'pages', 'pages' => $pages, 'why' => array_values(array_unique($why))];
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
				$summary[] = '- ' . $part['name'] . ': it stands on ' . $on . ' - ' . ($verdict['mode'] === 'pages' ? 'again on ' . implode(', ', $verdict['pages']) : 'every page again') . ', for `' . implode('`, `', $verdict['why']) . '`.';
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
	// The job's log holds it too, for a reader of the run that has no page: the parts, their pages and why.
	if (getenv('GITHUB_STEP_SUMMARY') !== false) {
		echo implode("\n", $summary), "\n";
	}
	return 0;
}

/**
 * gather: one sheet of every part of the run in .dev/probes - each part's sheet from this run when it ran here ($RAN,
 * the plan's parts, unless $MODE is none) or from the run it stands on ($STANDING) - and, unless a lab run,
 * .dev/standing/standing.json naming the parts clean in it with the run that holds each one's sheet, and
 * .dev/verified/verified.json when every part of $ALL is - or is skipped by the platform's fault, which it names - and
 * the sheet is clean; the sheet's exit code, or 1 when a part's sheet cannot be had.
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
	// A pull request's run checks a merge no branch holds.
	if ($mode !== 'lab' && getenv('GITHUB_EVENT_NAME') !== 'pull_request') {
		// A part stands clean on a whole sheet with no finding: some pages run again and never laid over the sheet they
		// stood on - its download failed - stand on nothing, and so does an engine skipped, which checked nothing. CI names
		// every engine, so a skip with no finding is the platform's fault the config names: it blocks no verified commit.
		$reports = [];
		foreach ($holders as $name => $holder) {
			$reports[$name] = json_decode((string)@file_get_contents($root . '/' . $name . '/report.json'), true) ?: [];
		}
		$whole = fn(array $report): bool => ($report['findings'] ?? null) === [] && ($report['only'] ?? null) === [];
		$clean = array_filter($holders, fn(string $name): bool => $whole($reports[$name]) && ($reports[$name]['skipped'] ?? []) === [], ARRAY_FILTER_USE_KEY);
		$blocked = array_keys(array_filter($reports, fn(array $report): bool => $whole($report) && ($report['skipped'] ?? []) !== []));
		$commit = (string)getenv('GITHUB_SHA');
		foreach (['standing' => ['commit' => $commit, 'parts' => (object)$clean], 'verified' => ['commit' => $commit, 'mode' => $mode, ...($blocked === [] ? [] : ['blocked' => $blocked])]] as $what => $record) {
			if ($what === 'verified' && ($status !== 0 || count($clean) + count($blocked) !== count($all))) {
				continue;
			}
			@mkdir(PROBE_ROOT . '/.dev/' . $what, 0777, true);
			file_put_contents(PROBE_ROOT . '/.dev/' . $what . '/' . $what . '.json', json_encode($record, JSON_UNESCAPED_SLASHES) . "\n");
		}
	}
	return $missing === [] ? $status : max($status, 1);
}

/** Runs the engines at once - at most $options['jobs'] at a time when it is set, the next group as one ends -, a process
 *  a group, each writing a sheet of its own, then one sheet of them all: every engine safaridriver drives - desktop
 *  Safari, VoiceOver's, the simulators' - goes one after another, as two of its sessions starting together time out;
 *  every other engine runs alone. Answers the merged sheet's exit code. */
function PROBE__Parallel(array $config, array $groups, array $options): int
{
	$root = sys_get_temp_dir() . '/redz-ui-parallel-' . getmypid();
	PROBE__Remove($root);
	mkdir($root, 0777, true);
	$running = [];
	register_shutdown_function(function () use (&$running): void {
		foreach ($running as $proc) {
			proc_terminate($proc);
		}
	});
	for ($waiting = $groups; $running !== [] || $waiting !== []; usleep(500000)) {
		while ($waiting !== [] && ($options['jobs'] === 0 || count($running) < $options['jobs'])) {
			$group = array_key_first($waiting);
			$names = array_shift($waiting);
			$command = [PHP_BINARY, '-d', 'xdebug.mode=off', __FILE__, '--serial', '--sheet=' . $root . '/' . $group, ...($options['named'] ? [] : ['--full']), ...($options['pages'] === [] || $options['own'] !== [] ? [] : ['--pages=' . implode(',', $options['pages'])]), ...($options['share'] === '' ? [] : ['--share=' . $options['share']]), ...array_map(fn(string $name): string => isset($options['own'][$name]) ? $name . '@' . ($options['own'][$name] === '*' ? '*' : implode(',', $options['own'][$name])) : $name, $names)];
			$proc = proc_open($command, [0 => ['file', PROBE_NULL, 'r'], 1 => ['file', $root . '/' . $group . '.log', 'a'], 2 => ['file', $root . '/' . $group . '.log', 'a']], $pipes, PROBE_ROOT);
			if (!is_resource($proc)) {
				throw new RuntimeException('cannot start the run of ' . implode(', ', $names));
			}
			$running[$group] = $proc;
			echo 'started ', implode(', ', $names), "\n";
		}
		foreach ($running as $group => $proc) {
			if (!proc_get_status($proc)['running']) {
				proc_close($proc);
				unset($running[$group]);
				echo implode("\n", array_filter(file($root . '/' . $group . '.log', FILE_IGNORE_NEW_LINES) ?: [], fn(string $line): bool => preg_match('~ · \d+ cells · \d+ findings$| skipped: ~', $line) === 1)), "\n";
			}
		}
	}
	$status = PROBE__Merge($config, array_map(fn(string $group): string => $root . '/' . $group, array_keys($groups)));
	PROBE__Remove($root);
	return $status;
}

/** PROBE__Binary for check: an engine whose build cannot be had - a download that fails or does not match its sum -
 *  cannot run here, its reason in $why. */
function PROBE__CheckBinary(string $name, array $engine, string &$why): string
{
	try {
		return PROBE__Binary($name, $engine, $why);
	} catch (RuntimeException $e) {
		$why = $e->getMessage();
		return '';
	}
}

/**
 * check: the Mac's run before a commit - each engine of the config's "check" on what the files changed since $base,
 * HEAD when none, ask of it, as CI's parts take what changed since they last stood clean: every page, some pages, or
 * none. Prints the plan - each engine's pages and the files that ask for them -, then runs it, at most $options['jobs']
 * engines at once, 3 when not given; an engine that cannot run here is named and left out. With --dry the plan alone.
 * The run's exit code; 0 when nothing runs.
 */
function PROBE__Check(array $config, string $base, array $options): int
{
	try {
		$changed = PROBE__Changed($config, $base === '' ? 'HEAD' : $base);
	} catch (RuntimeException $e) {
		fwrite(STDERR, $e->getMessage() . "\n");
		return 2;
	}
	$args = [];
	$plan = [];
	foreach ($config['check'] ?? [] as $name) {
		if (!isset($config['engines'][$name])) {
			fwrite(STDERR, 'no engine ' . $name . ' in tools/probes/config.json, which "check" names' . "\n");
			return 2;
		}
		$part = PROBE__PartRun($config, $changed, ['engines' => $name]);
		$why = '';
		$pages = $part['mode'] === 'full' ? PROBE__EnginePages($config, $name) : $part['pages'];
		printf("%-15s %s\n", $name, match (true) {
			$part['mode'] === 'none' => 'nothing changed reaches it',
			!$options['dry'] && PROBE__CheckBinary($name, $config['engines'][$name], $why) === '' => 'cannot run here: ' . $why,
			default => ($part['mode'] === 'full' ? 'every page, ' : '') . count($pages) . ' ' . (count($pages) === 1 ? 'page' : 'pages') . ($part['mode'] === 'full' ? '' : ': ' . implode(', ', $pages)) . ' <- ' . implode(', ', $part['why']),
		});
		$plan[$name] = $why === '' ? ['mode' => $part['mode'], 'pages' => $part['pages']] : ['mode' => 'none', 'pages' => []];
		if ($part['mode'] !== 'none' && $why === '') {
			$args[] = $name . '@' . ($part['mode'] === 'full' ? '*' : implode(',', $part['pages']));
		}
	}
	if ($options['dry'] || $args === []) {
		return 0;
	}
	// The plan for a board, beside the engines' own live states.
	@mkdir(PROBE_ROOT . '/.dev/live', 0777, true);
	@file_put_contents(PROBE_ROOT . '/.dev/live/check.json', json_encode(['base' => $base === '' ? 'HEAD' : $base, 'pid' => getmypid(), 'started' => time(), 'engines' => $plan], JSON_UNESCAPED_SLASHES));
	return PROBE__Main(['probe.php', '--jobs=' . ($options['jobs'] ?: 3), ...$args]);
}

/** The config, tools/probes/config.json. */
function PROBE__Config(): array
{
	return json_decode((string)file_get_contents(PROBE_CONFIG), true, 512, JSON_THROW_ON_ERROR);
}

function PROBE__Main(array $argv): int
{
	$config = PROBE__Config();
	$options = ['pages' => [], 'sheet' => PROBE_SHEET, 'serial' => false, 'jobs' => 0, 'full' => false, 'base' => '', 'share' => '', 'dry' => false];
	$args = [];
	foreach (array_slice($argv, 1) as $arg) {
		match (true) {
			str_starts_with($arg, '--pages=') => $options['pages'] = preg_split('~[\s,]+~', substr($arg, strlen('--pages=')), -1, PREG_SPLIT_NO_EMPTY),
			str_starts_with($arg, '--sheet=') => $options['sheet'] = substr($arg, strlen('--sheet=')),
			str_starts_with($arg, '--base=') => $options['base'] = substr($arg, strlen('--base=')),
			str_starts_with($arg, '--share=') => $options['share'] = substr($arg, strlen('--share=')),
			str_starts_with($arg, '--jobs=') => $options['jobs'] = preg_match('~^--jobs=([1-9]\d*)$~', $arg, $m) === 1 ? (int)$m[1] : -1,
			$arg === '--serial' => $options['serial'] = true,
			$arg === '--dry' => $options['dry'] = true,
			// A group of a full run: its engines were not named, so one that cannot run here is only a note.
			$arg === '--full' => $options['full'] = true,
			default => $args[] = $arg,
		};
	}
	$options['named'] = $args !== [] && !$options['full'];
	if ($options['jobs'] < 0) {
		fwrite(STDERR, '--jobs takes N, the most engines that run at once, 1 or more' . "\n");
		return 2;
	}
	if (($args[0] ?? '') === 'merge') {
		return PROBE__Merge($config, array_slice($args, 1), $options['base']);
	}
	if (($args[0] ?? '') === 'check') {
		return PROBE__Check($config, $args[1] ?? '', $options);
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
	// ENGINE@PAGE,PAGE runs that engine on those pages alone, its lists joined when it is named more than once; ENGINE@*
	// runs it whole, and so does an engine named bare beside them - on the pages of --pages when given; the run's pages
	// are then all of the lists together. An engine run whole has its exceptions judged.
	$own = [];
	foreach ($args as $arg) {
		if (str_contains($arg, '@')) {
			[$name, $list] = explode('@', $arg, 2);
			$pages = $list === '*' ? '*' : preg_split('~[\s,]+~', $list, -1, PREG_SPLIT_NO_EMPTY);
			if ($pages === []) {
				fwrite(STDERR, $arg . ': no page named - ENGINE@PAGE,PAGE or ENGINE@*' . "\n");
				return 2;
			}
			$own[$name] = $pages === '*' || ($own[$name] ?? null) === '*' ? '*' : array_values(array_unique([...($own[$name] ?? []), ...$pages]));
		}
	}
	$bare = array_values(array_filter($args, fn(string $arg): bool => !str_contains($arg, '@')));
	$args = array_values(array_unique(array_map(fn(string $arg): string => explode('@', $arg, 2)[0], $args)));
	if ($own !== []) {
		foreach ($bare as $name) {
			$pages = $options['pages'] ?: '*';
			$own[$name] = $pages === '*' || ($own[$name] ?? null) === '*' ? '*' : array_values(array_unique([...($own[$name] ?? []), ...$pages]));
		}
		$options['pages'] = array_values(array_unique([...$options['pages'], ...array_merge([], ...array_values(array_filter($own, 'is_array')))]));
	}
	$names = $args ?: array_keys(array_filter($config['engines'], fn(array $engine): bool => $engine['default'] ?? true));
	foreach ($names as $name) {
		if (!isset($config['engines'][$name])) {
			fwrite(STDERR, 'no engine ' . $name . ' in tools/probes/config.json; there are ' . implode(', ', array_keys($config['engines'])) . "\n");
			return 2;
		}
	}
	$options['own'] = $own;
	$options['whole'] = $own === [] ? ($options['pages'] === [] ? $names : []) : array_keys(array_filter($own, fn(array|string $pages): bool => $pages === '*'));
	$whole = $config;
	try {
		$config = $options['pages'] === [] ? $config : PROBE__Only($config, $options['pages']);
		$own = array_map(fn(array|string $pages): array => $pages === '*' ? $whole : PROBE__Only($whole, $pages), $own);
	} catch (InvalidArgumentException $e) {
		fwrite(STDERR, $e->getMessage() . "\n");
		return 2;
	}
	if ($options['share'] !== '') {
		$share = PROBE__ShareOf($options['share']);
		if ($share === null) {
			fwrite(STDERR, '--share takes K/N - the K-th of N shares of the pages, 1 ≤ K ≤ N' . "\n");
			return 2;
		}
		$config = PROBE__Share($config, $share);
		$own = array_map(fn(array $config): array => PROBE__Share($config, $share), $own);
	}
	if ($options['dry']) {
		// The plan alone: the pages each engine would run, and the engines that run whole.
		echo json_encode(['engines' => array_combine($names, array_map(fn(string $name): array => PROBE__EnginePages($own[$name] ?? $config, $name), $names)), 'whole' => $options['whole']], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), "\n";
		return 0;
	}
	$groups = [];
	foreach ($names as $name) {
		$engine = $config['engines'][$name];
		$groups[in_array($engine['kind'], ['safari', 'voiceover'], true) ? 'safari' : $name][] = $name;
	}
	if (count($groups) > 1 && !$options['serial'] && getenv('CI') === false) {
		return PROBE__Parallel(PROBE__Config(), $groups, $options);
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
	$report = ['when' => gmdate('Y-m-d H:i') . ' UTC', 'commit' => $commit === '' ? 'no commit' : 'commit ' . $commit, 'widths' => array_keys($config['widths']), 'only' => $config['only'] ?? [], 'whole' => $options['whole'], 'share' => $options['share'] === '' ? [] : array_fill_keys($names, [$options['share']]), 'engines' => [], 'skipped' => [], 'findings' => [], 'guarded' => [], 'walked' => [], 'spoken' => [], 'read' => [], 'shots' => [], 'used' => []];
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
					// Named, it is a finding - unless the platform's fault the config names keeps it from running anywhere so.
					if ($options['named'] && !(isset($config['engines'][$name]['ios']) && $why !== '' && $why === PROBE__SimulatorFault())) {
						$report['findings'][] = $name . ' - named, but cannot run here: ' . $why;
					}
					echo $name, ' skipped: ', $why, "\n";
					continue;
				}
				// A share's logs keep their own names in the sheet the shares are joined into.
				$folder = $tmp . '/' . $name . ($options['share'] === '' ? '' : '-share-' . str_replace('/', '-of-', $options['share']));
				mkdir($folder, 0777, true);
				PROBE__EngineRun($name, $config['engines'][$name], $binary, $folder, isset($own[$name]) ? ['config' => $own[$name]] + $run : $run, $report);
			} catch (Throwable $e) {
				$report['findings'][] = $name . ' - stopped: ' . $e->getMessage();
			}
			PROBE__LiveEnd($name, count($report['findings']));
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
