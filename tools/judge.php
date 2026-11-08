<?php
// judge - outside judges of tools/min.php, on this machine and in the Check workflow, never in a release. Lightning CSS
// reprints each stylesheet the minifier squeezes - the library's, tools/min/hostile.css and every sample of the
// css-tokenizer-tests corpus it takes - as written and as squeezed, with no minifying and no targets: the two must read
// the same, but for what CSS does not tell apart and Lightning CSS keeps as written in a value it does not parse -
// comments, the length of a run of white space, the space after a comma. esbuild
// parses every script the minifier writes for the browser floor. A watch compares the size of the two main files with
// esbuild's --minify, gzip -9, and warns when the gap leaves its band. Each judge is a native binary from npm, pinned by
// version and sha512 and kept in .dev/judges/ with its sha256; one missing, changed or for no known platform fails.
// Usage: php tools/judge.php

require __DIR__ . '/lib.php';
require __DIR__ . '/min.php';

const JUDGE_ROOT = __DIR__ . '/..';
const JUDGE_CACHE = __DIR__ . '/../.dev/judges';
// The judges: the version, the binary in the package, and the package with its sha512 on each platform.
const JUDGE_BINARIES = [
	'esbuild' => ['version' => '0.28.2', 'file' => 'package/bin/esbuild', 'packages' => [
		'darwin-arm64' => ['@esbuild/darwin-arm64', 'sha512-n4KqkOQrraxHJcgjM1RvwbigfQKIKJVpM7xp+KsxiyUSrRdIXnt73VhrPAx0fV44hgfmIVKjxMN9J1t5jySVkw=='],
		'linux-x64' => ['@esbuild/linux-x64', 'sha512-4xTZr1FUmSoQW4XIWmit3tzQrUTZM+N3P0XV8xROKYF50XfI7xeO90+1bZvNwxIufQ9hDQVRJH5YhgPVF8A/HQ=='],
	]],
	'lightningcss' => ['version' => '1.33.0', 'file' => 'package/lightningcss', 'packages' => [
		'darwin-arm64' => ['lightningcss-cli-darwin-arm64', 'sha512-sso5hSFPis7ldw2FcBopsZviSVAXWRGX8ybUwMhQHssTlERenQJ88WihZs08tCdSnQULo2kunnrGhh4VjRw8Fg=='],
		'linux-x64' => ['lightningcss-cli-linux-x64-gnu', 'sha512-9Q4DAglm17bLhA+HZPB+vxjrHXdhR/8U44zyc8MQNA5Rw+tisvcoR/lv4iuBUFn2qreYVRWQq0wP0rgdhTSxyQ=='],
	]],
];
const JUDGE_CORPUS = ['@rmenke/css-tokenizer-tests', '1.4.0', 'package/index.mjs', 'sha512-vQstlz0BOhWz5fxKXm0lnmgDuXLmi0ZozUDwBreXV5vY2K/k2SY02iaGygj9jr+qaEQse1YalJ+2pPNdReef7Q=='];
// The browser floor as esbuild names it.
const JUDGE_TARGETS = '--target=chrome130,edge130,firefox132,safari18';
// The stylesheets the minifier squeezes in the library, beside the main file and the hostile sample.
const JUDGE_SHEETS = ['css/*.css', 'css/components/*.css', 'charts/*.css', 'calendar/*.css', 'media/*.css', 'editor/*.css'];
// The main files' size by gzip -9 as a share of esbuild --minify's, as measured on 2026-11-08, and how far it may drift
// before the watch warns.
const JUDGE_SIZE = ['css' => [1.004, 0.03], 'js' => [1.095, 0.03]];

/** The platform's name in the judges' packages; a refusal for one they are not built for here. */
function JUDGE__Platform(): string
{
	$platform = strtolower(PHP_OS_FAMILY) . '-' . match (php_uname('m')) {
		'arm64', 'aarch64' => 'arm64',
		'x86_64', 'amd64' => 'x64',
		default => php_uname('m'),
	};
	if (!isset(JUDGE_BINARIES['esbuild']['packages'][$platform])) {
		throw new RuntimeException('no judge is pinned for ' . $platform);
	}
	return $platform;
}

/** The path of judge $name: from .dev/judges/ when its sha256 still holds, else fetched by its pinned sha512. */
function JUDGE__Binary(string $name): string
{
	$judge = JUDGE_BINARIES[$name];
	$platform = JUDGE__Platform();
	$path = JUDGE_CACHE . '/' . $name . '-' . $judge['version'] . '-' . $platform;
	if (is_file($path) && is_file($path . '.sha256')) {
		if (hash_file('sha256', $path) !== trim((string)file_get_contents($path . '.sha256'))) {
			throw new RuntimeException($path . ' changed since it was fetched - delete it to fetch it again');
		}
		return $path;
	}
	[$package, $integrity] = $judge['packages'][$platform];
	$body = TOOL__NpmFile($package, $judge['version'], $judge['file'], $integrity)['body'];
	if (!is_dir(JUDGE_CACHE)) {
		mkdir(JUDGE_CACHE, 0777, true);
	}
	file_put_contents($path, $body);
	chmod($path, 0755);
	file_put_contents($path . '.sha256', hash('sha256', $body) . "\n");
	return $path;
}

/**
 * Runs $command with $input on its standard input; [exit code, standard output, standard error].
 * @param list<string> $command
 * @return array{int, string, string}
 */
function JUDGE__Run(array $command, string $input): array
{
	$dir = sys_get_temp_dir() . '/redz-ui-judge-' . getmypid();
	if (!is_dir($dir)) {
		mkdir($dir);
	}
	file_put_contents($dir . '/in', $input);
	$process = proc_open($command, [0 => ['file', $dir . '/in', 'r'], 1 => ['file', $dir . '/out', 'w'], 2 => ['file', $dir . '/err', 'w']], $pipes);
	if (!is_resource($process)) {
		throw new RuntimeException('cannot run ' . $command[0]);
	}
	$code = proc_close($process);
	$result = [$code, (string)file_get_contents($dir . '/out'), (string)file_get_contents($dir . '/err')];
	array_map('unlink', glob($dir . '/*') ?: []);
	rmdir($dir);
	return $result;
}

/** Lightning CSS's reprint of $css with no minifying and no targets, without the space after a comma outside strings;
 *  null when it does not take the sheet. */
function JUDGE__Reprint(string $css): ?string
{
	$dir = sys_get_temp_dir() . '/redz-ui-judge-css-' . getmypid();
	if (!is_dir($dir)) {
		mkdir($dir);
	}
	file_put_contents($dir . '/sheet.css', $css);
	[$code, $out] = JUDGE__Run([JUDGE__Binary('lightningcss'), $dir . '/sheet.css'], '');
	unlink($dir . '/sheet.css');
	rmdir($dir);
	if ($code !== 0) {
		return null;
	}
	$out = (string)preg_replace_callback('~"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|/\*.*?\*/|\s+~s', fn(array $m): string => match ($m[0][0]) {
		'"', "'" => $m[0],
		'/' => '',
		default => ' ',
	}, $out);
	return trim((string)preg_replace_callback('~"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|, ~s', fn(array $m): string => $m[0] === ', ' ? ',' : $m[0], $out));
}

/**
 * The library's stylesheets as the minifier takes them, by name: the main file's joined sources, each sheet alone and
 * the hostile sample.
 * @return array<string, string>
 */
function JUDGE__Sheets(): array
{
	preg_match_all('~^@import url\("([^"]+)"\);~m', (string)file_get_contents(JUDGE_ROOT . '/css/index.css'), $imports);
	$sheets = ['the main stylesheet' => implode("\n", array_map(fn(string $file): string => (string)file_get_contents(JUDGE_ROOT . '/css/' . $file), $imports[1]))];
	foreach ([...JUDGE_SHEETS, 'tools/min/hostile.css'] as $pattern) {
		foreach (glob(JUDGE_ROOT . '/' . $pattern) ?: [] as $file) {
			$sheets[substr($file, strlen(JUDGE_ROOT) + 1)] = (string)file_get_contents($file);
		}
	}
	return $sheets;
}

/**
 * The stylesheets' verdicts: each the minifier takes must reprint as its squeezed form does; a library sheet the
 * minifier refuses or Lightning CSS cannot read is a finding too, a corpus sample of either kind is passed over.
 * @return array{list<string>, array<string, int>}
 */
function JUDGE__Css(): array
{
	$findings = [];
	$counts = ['library' => 0, 'corpus' => 0, 'corpus refused' => 0, 'corpus unread' => 0];
	$corpus = json_decode(substr(TOOL__NpmFile(...JUDGE_CORPUS)['body'], strlen('export const testCorpus = ')), true, 512, JSON_THROW_ON_ERROR);
	$samples = [];
	foreach (JUDGE__Sheets() as $name => $css) {
		$samples[] = ['library', $name, $css];
	}
	foreach ($corpus as $name => $test) {
		$samples[] = ['corpus', $name, $test['css']];
		$samples[] = ['corpus', $name . ' as a value', '.a { content: ' . $test['css'] . ' }'];
	}
	foreach ($samples as [$kind, $name, $css]) {
		try {
			$min = MIN__CssSafe($css);
		} catch (RuntimeException $e) {
			$kind === 'library' ? $findings[] = $name . '  the minifier refuses it: ' . $e->getMessage() : $counts['corpus refused']++;
			continue;
		} catch (LogicException $e) {
			$findings[] = $name . '  a fault of the minifier: ' . $e->getMessage();
			continue;
		}
		$written = JUDGE__Reprint($css);
		$squeezed = $written === null ? null : JUDGE__Reprint($min);
		if ($written === null || $squeezed === null) {
			$kind === 'library' ? $findings[] = $name . '  Lightning CSS cannot read it ' . ($written === null ? 'as written' : 'squeezed') : $counts['corpus unread']++;
			continue;
		}
		$counts[$kind]++;
		if ($written !== $squeezed) {
			$at = strspn($written ^ $squeezed, "\0");
			$findings[] = $name . '  squeezed, Lightning CSS reads …' . substr($squeezed, max(0, $at - 30), 80) . '… where as written …' . substr($written, max(0, $at - 30), 80) . '…';
		}
	}
	return [$findings, $counts];
}

/**
 * The scripts the minifier writes, each parsed by esbuild for the browser floor: the release's, and tools/min/*.js
 * squeezed and named.
 * @return array{list<string>, int}
 */
function JUDGE__Js(): array
{
	$scripts = [];
	foreach (glob(JUDGE_ROOT . '/dist/js/*.min.js') ?: [] as $file) {
		$scripts[substr($file, strlen(JUDGE_ROOT) + 1)] = (string)file_get_contents($file);
	}
	foreach (glob(JUDGE_ROOT . '/tools/min/*.js') ?: [] as $file) {
		$scripts[substr($file, strlen(JUDGE_ROOT) + 1) . ' minified'] = MIN__JsNamesSafe(MIN__JsSafe((string)file_get_contents($file)));
	}
	$findings = [];
	foreach ($scripts as $name => $js) {
		[$code, , $err] = JUDGE__Run([JUDGE__Binary('esbuild'), '--loader=js', JUDGE_TARGETS, '--log-level=error'], $js);
		if ($code !== 0) {
			$findings[] = $name . '  esbuild does not parse it for the floor: ' . trim(substr($err, 0, 400));
		}
	}
	return [$findings, count($scripts)];
}

/**
 * The watch on size: the main stylesheet and script by gzip -9 against esbuild --minify of their sources, warned when
 * the share leaves its band.
 * @return list<string>
 */
function JUDGE__Sizes(): array
{
	$warnings = [];
	foreach (['css' => ['css/index.css', 'dist/css/redz-ui.min.css'], 'js' => ['js/index.js', 'dist/js/redz-ui.min.js']] as $kind => [$entry, $ours]) {
		[$code, $theirs, $err] = JUDGE__Run([JUDGE__Binary('esbuild'), JUDGE_ROOT . '/' . $entry, '--bundle', '--minify', JUDGE_TARGETS, '--log-level=error', ...($kind === 'js' ? ['--format=esm'] : [])], '');
		if ($code !== 0) {
			$warnings[] = $entry . '  esbuild cannot bundle it: ' . trim(substr($err, 0, 300));
			continue;
		}
		$share = strlen((string)gzencode((string)file_get_contents(JUDGE_ROOT . '/' . $ours), 9)) / strlen((string)gzencode($theirs, 9));
		[$usual, $band] = JUDGE_SIZE[$kind];
		$warnings[] = sprintf('%s  %.3f of esbuild --minify by gzip -9 (usually %.3f)%s', $ours, $share, $usual, abs($share - $usual) > $band ? ' - WARNING: out of its band of ' . $band : '');
	}
	return $warnings;
}

/** Runs the judges; 1 on any finding, 2 when a judge cannot be had. */
function JUDGE__Main(): int
{
	try {
		[$css, $counts] = JUDGE__Css();
		[$js, $scripts] = JUDGE__Js();
		$sizes = JUDGE__Sizes();
	} catch (RuntimeException $e) {
		fwrite(STDERR, 'judge: ' . $e->getMessage() . "\n");
		return 2;
	}
	$findings = [...$css, ...$js];
	foreach ([...$findings, ...$sizes] as $line) {
		echo $line, "\n";
	}
	printf("judges · Lightning CSS %s: %d library sheets, %d corpus samples (%d refused by the minifier, %d unread by Lightning CSS) · esbuild %s: %d scripts · %s\n", JUDGE_BINARIES['lightningcss']['version'], $counts['library'], $counts['corpus'], $counts['corpus refused'], $counts['corpus unread'], JUDGE_BINARIES['esbuild']['version'], $scripts, $findings === [] ? 'CLEAN' : count($findings) . ' findings');
	return $findings === [] ? 0 : 1;
}

exit(JUDGE__Main());
