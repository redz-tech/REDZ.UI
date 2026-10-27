<?php
// probes, Firefox: WebDriver BiDi over a WebSocket of our own — one headless Firefox a profile; the viewport by
// browsingContext, forced colors by the profile's pref; full-page shots, print to PDF, errors from log and network events.

/** A WebSocket to ws://127.0.0.1:$port$path, its handshake checked; reads wait at most two minutes. */
function PROBE__WsOpen(int $port, string $path)
{
	$socket = stream_socket_client('tcp://127.0.0.1:' . $port, $errno, $error, 10);
	if ($socket === false) {
		throw new RuntimeException('cannot reach 127.0.0.1:' . $port . ': ' . $error);
	}
	$key = base64_encode(random_bytes(16));
	fwrite($socket, "GET $path HTTP/1.1\r\nHost: 127.0.0.1:$port\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: $key\r\nSec-WebSocket-Version: 13\r\n\r\n");
	$head = '';
	while (!str_contains($head, "\r\n\r\n")) {
		$chunk = fgets($socket);
		if ($chunk === false) {
			throw new RuntimeException('the WebSocket handshake got no answer');
		}
		$head .= $chunk;
	}
	$accept = base64_encode(sha1($key . '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', true));
	if (!str_starts_with($head, 'HTTP/1.1 101') || stripos($head, 'Sec-WebSocket-Accept: ' . $accept) === false) {
		throw new RuntimeException('the WebSocket handshake failed: ' . strtok($head, "\r\n"));
	}
	stream_set_timeout($socket, 120);
	return $socket;
}

/** Sends one frame of $opcode with $payload, masked as a client must. */
function PROBE__WsSend($socket, string $payload, int $opcode = 0x1): void
{
	$length = strlen($payload);
	$size = match (true) {
		$length < 126 => chr(0x80 | $length),
		$length < 65536 => chr(0x80 | 126) . pack('n', $length),
		default => chr(0x80 | 127) . pack('J', $length),
	};
	$mask = random_bytes(4);
	$frame = chr(0x80 | $opcode) . $size . $mask . ($payload ^ str_repeat($mask, intdiv($length + 3, 4)));
	for ($at = 0, $total = strlen($frame); $at < $total; $at += $written) {
		$written = fwrite($socket, substr($frame, $at));
		if ($written === false || $written === 0) {
			throw new RuntimeException('the WebSocket closed while sending');
		}
	}
}

/** Exactly $n bytes from the socket, or an exception when it ends or the read waits too long. */
function PROBE__WsBytes($socket, int $n): string
{
	$out = '';
	while (strlen($out) < $n) {
		$chunk = fread($socket, $n - strlen($out));
		if ($chunk === false || $chunk === '') {
			throw new RuntimeException(stream_get_meta_data($socket)['timed_out'] ? 'the WebSocket read timed out' : 'the WebSocket closed');
		}
		$out .= $chunk;
	}
	return $out;
}

/** The next text message, its fragments joined and pings answered; null when the peer closes. */
function PROBE__WsRead($socket): ?string
{
	$message = '';
	while (true) {
		$head = PROBE__WsBytes($socket, 2);
		$opcode = ord($head[0]) & 0x0F;
		$length = ord($head[1]) & 0x7F;
		if ($length === 126) {
			$length = unpack('n', PROBE__WsBytes($socket, 2))[1];
		} elseif ($length === 127) {
			$length = unpack('J', PROBE__WsBytes($socket, 8))[1];
		}
		$mask = (ord($head[1]) & 0x80) !== 0 ? PROBE__WsBytes($socket, 4) : '';
		$data = $length > 0 ? PROBE__WsBytes($socket, $length) : '';
		if ($mask !== '') {
			$data ^= str_repeat($mask, intdiv($length + 3, 4));
		}
		if ($opcode === 0x8) {
			return null;
		}
		if ($opcode === 0x9) {
			PROBE__WsSend($socket, $data, 0xA);
			continue;
		}
		if ($opcode === 0xA) {
			continue;
		}
		$message .= $data;
		if ((ord($head[0]) & 0x80) !== 0) {
			return $message;
		}
	}
}

/** Starts the Firefox at $binary headless with a fresh profile in $dir and $prefs, opens a BiDi session and subscribes to
 *  the page's log and network events. */
function PROBE__FirefoxStart(string $binary, string $dir, array $prefs = []): array
{
	@mkdir($dir . '/profile', 0777, true);
	$lines = [];
	foreach (['browser.shell.checkDefaultBrowser' => false, 'datareporting.policy.dataSubmissionEnabled' => false, 'toolkit.telemetry.reportingpolicy.firstRun' => false, ...$prefs] as $pref => $value) {
		$lines[] = 'user_pref(' . json_encode($pref) . ', ' . json_encode($value) . ');';
	}
	file_put_contents($dir . '/profile/user.js', implode("\n", $lines) . "\n");
	$port = PROBE__FreePort();
	$log = $dir . '/firefox.log';
	$proc = proc_open([$binary, '--headless', '--no-remote', '--profile', $dir . '/profile', '--remote-debugging-port', (string)$port, 'about:blank'], [0 => ['file', '/dev/null', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes);
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

/** A PNG of the whole page. */
function PROBE__FirefoxShot(array &$h): string
{
	return base64_decode(PROBE__FirefoxSend($h, 'browsingContext.captureScreenshot', ['context' => $h['context'], 'origin' => 'document'])['data']);
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
