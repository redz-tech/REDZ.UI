<?php
// probes, Firefox: WebDriver BiDi over a WebSocket of our own — one headless Firefox a profile, a shown one for a screen
// reader; the viewport by browsingContext, forced colors by the profile's pref; full-page shots, print to PDF, errors
// from log and network events.

/** Starts the Firefox at $binary with a fresh profile in $dir and $prefs — headless, or $shown in a window a screen
 *  reader can read —, opens a BiDi session and subscribes to the page's log and network events. */
function PROBE__FirefoxStart(string $binary, string $dir, array $prefs = [], bool $shown = false): array
{
	@mkdir($dir . '/profile', 0777, true);
	$lines = [];
	foreach (['browser.shell.checkDefaultBrowser' => false, 'datareporting.policy.dataSubmissionEnabled' => false, 'toolkit.telemetry.reportingpolicy.firstRun' => false, ...$prefs] as $pref => $value) {
		$lines[] = 'user_pref(' . json_encode($pref) . ', ' . json_encode($value) . ');';
	}
	file_put_contents($dir . '/profile/user.js', implode("\n", $lines) . "\n");
	$port = PROBE__FreePort();
	$log = $dir . '/firefox.log';
	$window = $shown ? ['--width', '1280', '--height', '900'] : ['--headless'];
	$proc = proc_open([$binary, ...$window, '--no-remote', '--profile', $dir . '/profile', '--remote-debugging-port', (string)$port, 'about:blank'], [0 => ['file', PROBE_NULL, 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes);
	if (!is_resource($proc)) {
		throw new RuntimeException('cannot start ' . $binary);
	}
	$until = microtime(true) + 60;
	while (!str_contains((string)@file_get_contents($log), 'WebDriver BiDi listening on ws://')) {
		if (microtime(true) > $until || !proc_get_status($proc)['running']) {
			proc_terminate($proc);
			throw new RuntimeException('Firefox did not open WebDriver BiDi, see ' . $log);
		}
		usleep(100000);
	}
	$h = ['kind' => 'firefox', 'proc' => $proc, 'socket' => PROBE__WsOpen($port, '/session'), 'id' => 0, 'events' => []];
	$h['version'] = 'Firefox ' . PROBE__FirefoxSend($h, 'session.new', ['capabilities' => (object)[]])['capabilities']['browserVersion'];
	PROBE__FirefoxSend($h, 'session.subscribe', ['events' => ['log.entryAdded', 'network.responseCompleted', 'network.fetchError']]);
	$h['context'] = PROBE__FirefoxSend($h, 'browsingContext.getTree', ['maxDepth' => 0])['contexts'][0]['context'];
	return $h;
}

/** Sends $method and answers its result, keeping the events that arrive before it; an error answer throws. */
function PROBE__FirefoxSend(array &$h, string $method, array $params = []): array
{
	$id = ++$h['id'];
	PROBE__WsSend($h['socket'], json_encode(['id' => $id, 'method' => $method, 'params' => (object)$params], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
	while (true) {
		$text = PROBE__WsRead($h['socket']);
		if ($text === null) {
			throw new RuntimeException('Firefox closed the session during ' . $method);
		}
		$message = json_decode($text, true);
		if (($message['type'] ?? '') === 'event') {
			$h['events'][] = $message;
			continue;
		}
		if (($message['id'] ?? null) !== $id) {
			continue;
		}
		if ($message['type'] === 'error') {
			throw new RuntimeException('Firefox ' . $method . ': ' . $message['error'] . ' ' . ($message['message'] ?? ''));
		}
		return $message['result'] ?? [];
	}
}

/** Loads $url in a $width × $height viewport (two device pixels a CSS pixel below 600 px); answers when complete. */
function PROBE__FirefoxLoad(array &$h, string $url, int $width, int $height): void
{
	PROBE__FirefoxSend($h, 'browsingContext.setViewport', ['context' => $h['context'], 'viewport' => ['width' => $width, 'height' => $height], 'devicePixelRatio' => $width < 600 ? 2 : 1]);
	$h['events'] = [];
	PROBE__FirefoxSend($h, 'browsingContext.navigate', ['context' => $h['context'], 'url' => $url, 'wait' => 'complete']);
}

/** Runs the script $source in the page. */
function PROBE__FirefoxInject(array &$h, string $source): void
{
	$r = PROBE__FirefoxSend($h, 'script.evaluate', ['expression' => $source, 'target' => ['context' => $h['context']], 'awaitPromise' => false, 'resultOwnership' => 'none']);
	if (($r['type'] ?? '') === 'exception') {
		throw new RuntimeException('the page threw: ' . ($r['exceptionDetails']['text'] ?? ''));
	}
}

/** The value of $expression in the page, a promise awaited; the value travels as JSON. */
function PROBE__FirefoxEval(array &$h, string $expression): mixed
{
	$r = PROBE__FirefoxSend($h, 'script.evaluate', ['expression' => '(async () => JSON.stringify(await (' . $expression . ')))()', 'target' => ['context' => $h['context']], 'awaitPromise' => true, 'resultOwnership' => 'none']);
	if (($r['type'] ?? '') === 'exception') {
		throw new RuntimeException('the page threw: ' . ($r['exceptionDetails']['text'] ?? ''));
	}
	return json_decode((string)($r['result']['value'] ?? 'null'), true);
}

/** Presses and releases the key, a name of PROBE_KEYS, as the user would. */
function PROBE__FirefoxKey(array &$h, string $key): void
{
	$value = PROBE_KEYS[$key][0];
	PROBE__FirefoxSend($h, 'input.performActions', ['context' => $h['context'], 'actions' => [['type' => 'key', 'id' => 'keyboard', 'actions' => [['type' => 'keyDown', 'value' => $value], ['type' => 'keyUp', 'value' => $value]]]]]);
}

/** Clicks the primary mouse button at the point of the viewport. */
function PROBE__FirefoxClick(array &$h, int $x, int $y): void
{
	PROBE__FirefoxSend($h, 'input.performActions', ['context' => $h['context'], 'actions' => [['type' => 'pointer', 'id' => 'mouse', 'parameters' => ['pointerType' => 'mouse'], 'actions' => [['type' => 'pointerMove', 'x' => $x, 'y' => $y], ['type' => 'pointerDown', 'button' => 0], ['type' => 'pointerUp', 'button' => 0]]]]]);
}

/** Moves the mouse to the point of the viewport. */
function PROBE__FirefoxHover(array &$h, int $x, int $y): void
{
	PROBE__FirefoxSend($h, 'input.performActions', ['context' => $h['context'], 'actions' => [['type' => 'pointer', 'id' => 'mouse', 'parameters' => ['pointerType' => 'mouse'], 'actions' => [['type' => 'pointerMove', 'x' => $x, 'y' => $y]]]]]);
}

/** Brings the page's window in front of the others. */
function PROBE__FirefoxFront(array &$h): void
{
	PROBE__FirefoxSend($h, 'browsingContext.activate', ['context' => $h['context']]);
}

/** A PNG of the whole page. */
function PROBE__FirefoxShot(array &$h): string
{
	[$width, $height] = PROBE__FirefoxEval($h, '[document.documentElement.scrollWidth, document.documentElement.scrollHeight]');
	$clip = ['type' => 'box', 'x' => 0, 'y' => 0, 'width' => $width, 'height' => min($height, PROBE_SHOT_MAX)];
	return base64_decode(PROBE__FirefoxSend($h, 'browsingContext.captureScreenshot', ['context' => $h['context'], 'origin' => 'document', 'clip' => $clip])['data']);
}

/** A PDF of the page printed on A4 the way a reader prints it, backgrounds off. */
function PROBE__FirefoxPrint(array &$h): string
{
	return base64_decode(PROBE__FirefoxSend($h, 'browsingContext.print', ['context' => $h['context'], 'page' => ['width' => 21.0, 'height' => 29.7], 'background' => false])['data']);
}

/** The page's errors since its load: console and script errors and warnings, failed requests, answers from 400. */
function PROBE__FirefoxErrors(array &$h): array
{
	$errors = [];
	foreach ($h['events'] as $m) {
		$params = $m['params'] ?? [];
		$url = (string)($params['request']['url'] ?? '');
		if (str_ends_with($url, '/favicon.ico')) {
			continue;
		}
		$errors[] = match ($m['method'] ?? '') {
			'log.entryAdded' => in_array($params['level'] ?? '', ['error', 'warn'], true) ? 'log ' . ($params['text'] ?? '') : '',
			'network.responseCompleted' => ($params['response']['status'] ?? 0) >= 400 ? $params['response']['status'] . ' ' . $url : '',
			'network.fetchError' => 'failed ' . ($params['errorText'] ?? '') . ' ' . $url,
			default => '',
		};
	}
	return array_values(array_unique(array_filter($errors)));
}

/** Closes Firefox and waits for it to leave. */
function PROBE__FirefoxStop(array &$h): void
{
	try {
		PROBE__FirefoxSend($h, 'browser.close');
	} catch (Throwable) {
		// Firefox may drop the socket before it answers; PROBE__Wait ends it either way.
	}
	@fclose($h['socket']);
	PROBE__Wait($h['proc']);
}
