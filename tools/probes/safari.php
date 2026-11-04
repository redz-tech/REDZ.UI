<?php
// probes, Safari: classic WebDriver over HTTP to safaridriver - Safari on this Mac, or Safari of an iOS runtime in the
// simulator; one session at a time, no headless mode; viewport shots; no print command and no events, so errors stay
// unseen here.

/** Starts safaridriver with its log in $dir and a session: Safari on this Mac, or the Safari of iOS $ios in a simulator
 *  booted for it. A run that ends without PROBE__SafariStop - stopped by a signal, which skips finally - still ends its
 *  session at shutdown. Only the session ends: the Safari it runs in is the Mac owner's browser too, with the owner's
 *  windows, and is never quit. */
function PROBE__SafariStart(string $dir, string $ios = ''): array
{
	$port = PROBE__FreePort();
	$proc = proc_open(['/usr/bin/safaridriver', '-p', (string)$port], [0 => ['file', '/dev/null', 'r'], 1 => ['file', $dir . '/safaridriver.log', 'a'], 2 => ['file', $dir . '/safaridriver.log', 'a']], $pipes);
	if (!is_resource($proc)) {
		throw new RuntimeException('cannot start safaridriver');
	}
	$h = ['kind' => 'safari', 'proc' => $proc, 'base' => 'http://127.0.0.1:' . $port, 'session' => '', 'ios' => $ios, 'booted' => ''];
	for ($tries = 0; !PROBE__SafariReady($h); $tries++) {
		if ($tries > 40) {
			PROBE__SafariStop($h);
			throw new RuntimeException('safaridriver did not answer');
		}
		usleep(250000);
	}
	$caps = ['browserName' => 'safari'];
	$udid = '';
	if ($ios !== '') {
		[$udid, $h['booted'], $version] = PROBE__SafariSimulator($ios);
		$caps += ['platformName' => 'ios', 'safari:useSimulator' => true, 'safari:platformVersion' => $version, 'safari:deviceUDID' => $udid];
	}
	for ($tries = 1; $h['session'] === ''; $tries++) {
		try {
			$session = PROBE__SafariCall($h, 'POST', '/session', ['capabilities' => ['alwaysMatch' => $caps]]);
			$h['session'] = '/session/' . $session['sessionId'];
			$h['version'] = 'Safari ' . $session['capabilities']['browserVersion'] . ($ios === '' ? '' : ' · iOS ' . $session['capabilities']['safari:platformVersion'] . ' simulator');
		} catch (RuntimeException $e) {
			if ($tries >= 3) {
				PROBE__SafariStop($h);
				throw $e;
			}
			// A simulator's Safari that ended while pairing (CI's iOS 18.5) pairs again once it is started afresh.
			if ($udid !== '') {
				try {
					PROBE__Run(['xcrun', 'simctl', 'terminate', $udid, 'com.apple.mobilesafari']);
				} catch (RuntimeException) {
					// Not running is the state wanted.
				}
			}
			sleep(5);
		}
	}
	PROBE__SafariCall($h, 'POST', $h['session'] . '/timeouts', ['script' => 120000, 'pageLoad' => 60000]);
	$left = $h;
	register_shutdown_function(function () use ($left): void {
		if (is_resource($left['proc'])) {
			PROBE__SafariStop($left);
		}
	});
	return $h;
}

/** Why desktop Safari cannot be driven here now; '' when it can: Safari 27 takes an automation session only in a Safari
 *  safaridriver starts ("Safari was not launched for automation"), and the Mac owner's open Safari is never quit. */
function PROBE__SafariBusy(): string
{
	try {
		PROBE__Run(['/usr/bin/pgrep', '-x', 'Safari']);
	} catch (RuntimeException) {
		return '';
	}
	return 'Safari is open as the Mac owner\'s browser, and Safari takes an automation session only when safaridriver starts it - close Safari to run it here; CI runs it';
}

/** Whether safaridriver answers its status. */
function PROBE__SafariReady(array $h): bool
{
	try {
		PROBE__SafariCall($h, 'GET', '/status');
		return true;
	} catch (RuntimeException) {
		return false;
	}
}

/** The UDID of an iPhone simulator of iOS $ios, booted, settled and with Safari launched once - a session on a cold
 *  Safari fails -, the UDID to shut down at the end ('' when it ran already) and the runtime's exact version, which
 *  the session must name (26.4 is 26.4.1). */
function PROBE__SafariSimulator(string $ios): array
{
	$runtime = 'com.apple.CoreSimulator.SimRuntime.iOS-' . str_replace('.', '-', $ios);
	$version = '';
	foreach (json_decode((string)shell_exec('xcrun simctl list runtimes -j'), true)['runtimes'] ?? [] as $known) {
		$version = $known['identifier'] === $runtime ? $known['version'] : $version;
	}
	$list = json_decode((string)shell_exec('xcrun simctl list devices available -j'), true);
	foreach ($version === '' ? [] : $list['devices'][$runtime] ?? [] as $device) {
		if (str_starts_with($device['name'], 'iPhone')) {
			if ($device['state'] === 'Booted') {
				return [$device['udid'], '', $version];
			}
			PROBE__Run(['xcrun', 'simctl', 'boot', $device['udid']]);
			PROBE__Run(['xcrun', 'simctl', 'bootstatus', $device['udid'], '-b']);
			PROBE__Run(['xcrun', 'simctl', 'launch', $device['udid'], 'com.apple.mobilesafari']);
			PROBE__Run(['xcrun', 'simctl', 'terminate', $device['udid'], 'com.apple.mobilesafari']);
			return [$device['udid'], $device['udid'], $version];
		}
	}
	throw new RuntimeException('no iPhone simulator of iOS ' . $ios);
}

/** Sends a WebDriver command and answers its value; an error answer throws. */
function PROBE__SafariCall(array $h, string $method, string $path, ?array $body = null): mixed
{
	$ch = curl_init($h['base'] . $path);
	curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 240, CURLOPT_HTTPHEADER => ['Content-Type: application/json']]);
	if ($body !== null) {
		curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
	}
	$raw = curl_exec($ch);
	$answer = is_string($raw) ? json_decode($raw, true) : null;
	if (!is_array($answer) || !array_key_exists('value', $answer)) {
		throw new RuntimeException('safaridriver ' . $method . ' ' . $path . ': ' . (is_string($raw) ? substr($raw, 0, 200) : curl_error($ch)));
	}
	if (is_array($answer['value']) && isset($answer['value']['error'])) {
		throw new RuntimeException('safaridriver ' . $method . ' ' . $path . ': ' . $answer['value']['error'] . ' ' . ($answer['value']['message'] ?? ''));
	}
	return $answer['value'];
}

/** Loads $url with the window at $width × $height on a Mac (a simulator keeps its screen); answers when complete. */
function PROBE__SafariLoad(array &$h, string $url, int $width, int $height): void
{
	if ($h['ios'] === '') {
		PROBE__SafariCall($h, 'POST', $h['session'] . '/window/rect', ['width' => $width, 'height' => $height]);
	}
	PROBE__SafariCall($h, 'POST', $h['session'] . '/url', ['url' => $url]);
}

/** Runs the script $source in the page. */
function PROBE__SafariInject(array &$h, string $source): void
{
	PROBE__SafariCall($h, 'POST', $h['session'] . '/execute/sync', ['script' => $source . "\nreturn true;", 'args' => []]);
}

/** The value of $expression in the page, a promise awaited; the value travels as JSON. */
function PROBE__SafariEval(array &$h, string $expression): mixed
{
	$script = 'const done = arguments[arguments.length - 1]; Promise.resolve().then(() => ' . $expression . ').then((v) => done(JSON.stringify({value: v === undefined ? null : v})), (e) => done(JSON.stringify({error: e instanceof Error ? e.name + ": " + e.message + " " + e.stack : String(e)})));';
	$answer = json_decode((string)PROBE__SafariCall($h, 'POST', $h['session'] . '/execute/async', ['script' => $script, 'args' => []]), true);
	if (isset($answer['error'])) {
		throw new RuntimeException('the page threw: ' . $answer['error']);
	}
	return $answer['value'];
}

/** Presses and releases the key, a name of PROBE_KEYS, as the user would. */
function PROBE__SafariKey(array &$h, string $key): void
{
	// Tab with Option: Safari's Tab skips buttons and links while "Press Tab to highlight each item" is off, as it is.
	$values = $key === 'Tab' ? ["\u{E00A}", PROBE_KEYS[$key][0]] : [PROBE_KEYS[$key][0]];
	$actions = [...array_map(fn(string $v): array => ['type' => 'keyDown', 'value' => $v], $values), ...array_map(fn(string $v): array => ['type' => 'keyUp', 'value' => $v], array_reverse($values))];
	PROBE__SafariCall($h, 'POST', $h['session'] . '/actions', ['actions' => [['type' => 'key', 'id' => 'keyboard', 'actions' => $actions]]]);
}

/** Types the text key by key, as the user would. */
function PROBE__SafariType(array &$h, string $text): void
{
	$actions = [];
	foreach (mb_str_split($text) as $char) {
		array_push($actions, ['type' => 'keyDown', 'value' => $char], ['type' => 'keyUp', 'value' => $char]);
	}
	PROBE__SafariCall($h, 'POST', $h['session'] . '/actions', ['actions' => [['type' => 'key', 'id' => 'keyboard', 'actions' => $actions]]]);
}

/** Presses a combination as aria-keyshortcuts writes it - Meta+K - its modifiers held around the key. */
function PROBE__SafariChord(array &$h, string $combination): void
{
	$codes = ['Meta' => "\u{E03D}", 'Control' => "\u{E009}", 'Alt' => "\u{E00A}", 'Shift' => "\u{E008}"];
	$values = array_map(fn(string $part): string => $codes[$part] ?? strtolower($part), explode('+', $combination));
	$actions = [...array_map(fn(string $v): array => ['type' => 'keyDown', 'value' => $v], $values), ...array_map(fn(string $v): array => ['type' => 'keyUp', 'value' => $v], array_reverse($values))];
	PROBE__SafariCall($h, 'POST', $h['session'] . '/actions', ['actions' => [['type' => 'key', 'id' => 'keyboard', 'actions' => $actions]]]);
}

/** How far safaridriver's viewport points sit from the page's: it counts from the window's edge, so a page right to
 *  left, whose scrollbar WebKit draws on the left, moves every point by the scrollbar's width. */
function PROBE__SafariShift(array &$h): int
{
	return (int)PROBE__SafariEval($h, 'getComputedStyle(document.documentElement).direction === "rtl" ? innerWidth - document.documentElement.clientWidth : 0');
}

/** Clicks the primary mouse button at the point of the viewport. */
function PROBE__SafariClick(array &$h, int $x, int $y): void
{
	$x += PROBE__SafariShift($h);
	PROBE__SafariCall($h, 'POST', $h['session'] . '/actions', ['actions' => [['type' => 'pointer', 'id' => 'mouse', 'parameters' => ['pointerType' => 'mouse'], 'actions' => [['type' => 'pointerMove', 'origin' => 'viewport', 'x' => $x, 'y' => $y], ['type' => 'pointerDown', 'button' => 0], ['type' => 'pointerUp', 'button' => 0]]]]]);
}

/** Drags the mouse from one point of the viewport to another with the left button held, in five moves. */
function PROBE__SafariDrag(array &$h, int $x, int $y, int $toX, int $toY): void
{
	$shift = PROBE__SafariShift($h);
	$moves = array_map(fn(float $t): array => ['type' => 'pointerMove', 'origin' => 'viewport', 'duration' => 40, 'x' => (int)round($x + ($toX - $x) * $t) + $shift, 'y' => (int)round($y + ($toY - $y) * $t)], [0.1, 0.3, 0.6, 0.9, 1.0]);
	PROBE__SafariCall($h, 'POST', $h['session'] . '/actions', ['actions' => [['type' => 'pointer', 'id' => 'mouse', 'parameters' => ['pointerType' => 'mouse'], 'actions' => [['type' => 'pointerMove', 'origin' => 'viewport', 'x' => $x + $shift, 'y' => $y], ['type' => 'pointerDown', 'button' => 0], ...$moves, ['type' => 'pointerUp', 'button' => 0]]]]]);
}

/** Moves the mouse to the point of the viewport. */
function PROBE__SafariHover(array &$h, int $x, int $y): void
{
	$x += PROBE__SafariShift($h);
	PROBE__SafariCall($h, 'POST', $h['session'] . '/actions', ['actions' => [['type' => 'pointer', 'id' => 'mouse', 'parameters' => ['pointerType' => 'mouse'], 'actions' => [['type' => 'pointerMove', 'origin' => 'viewport', 'x' => $x, 'y' => $y]]]]]);
}

/** A PNG of the viewport: safaridriver shoots no more than the window. */
function PROBE__SafariShot(array &$h): string
{
	return base64_decode((string)PROBE__SafariCall($h, 'GET', $h['session'] . '/screenshot'));
}

/** No PDF: safaridriver has no print command. */
function PROBE__SafariPrint(array &$h): string
{
	return '';
}

/** No errors: classic WebDriver brings no events from Safari. */
function PROBE__SafariErrors(array &$h): array
{
	return [];
}

/** Ends the session, the driver and a simulator booted for it. */
function PROBE__SafariStop(array &$h): void
{
	if ($h['session'] !== '') {
		try {
			PROBE__SafariCall($h, 'DELETE', $h['session']);
		} catch (RuntimeException) {
			// The session may be gone with its Safari already; the driver ends below either way.
		}
	}
	proc_terminate($h['proc']);
	PROBE__Wait($h['proc']);
	if ($h['booted'] !== '') {
		PROBE__Run(['xcrun', 'simctl', 'shutdown', $h['booted']]);
	}
}
