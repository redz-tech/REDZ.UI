<?php
// probes, Safari: classic WebDriver over HTTP to safaridriver — Safari on this Mac, or Safari of an iOS runtime in the
// simulator; one session at a time, no headless mode; viewport shots; no print command and no events, so errors stay
// unseen here.

/** Starts safaridriver with its log in $dir and a session: Safari on this Mac, or the Safari of iOS $ios in a simulator
 *  booted for it. */
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
		}
	}
	PROBE__SafariCall($h, 'POST', $h['session'] . '/timeouts', ['script' => 120000, 'pageLoad' => 60000]);
	return $h;
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

/** The UDID of an iPhone simulator of iOS $ios, booted, settled and with Safari launched once — a session on a cold
 *  Safari fails —, the UDID to shut down at the end ('' when it ran already) and the runtime's exact version, which
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
	$script = 'const done = arguments[arguments.length - 1]; Promise.resolve().then(() => ' . $expression . ').then((v) => done(JSON.stringify({value: v === undefined ? null : v})), (e) => done(JSON.stringify({error: String(e && e.stack || e)})));';
	$answer = json_decode((string)PROBE__SafariCall($h, 'POST', $h['session'] . '/execute/async', ['script' => $script, 'args' => []]), true);
	if (isset($answer['error'])) {
		throw new RuntimeException('the page threw: ' . $answer['error']);
	}
	return $answer['value'];
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
