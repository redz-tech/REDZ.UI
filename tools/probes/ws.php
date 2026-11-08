<?php
// probes, WebSocket: the client of our drivers - Firefox's WebDriver BiDi everywhere, Chrome's DevTools protocol where
// its pipe cannot run (Windows); text messages, fragments joined, pings answered.

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
