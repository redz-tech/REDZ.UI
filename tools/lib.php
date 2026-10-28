<?php
// lib — what the library's tools share: fetching over HTTPS within a budget, one file out of a gzipped tar, a file of
// an npm package checked against its sha512, and every class of the library's stylesheets.

/** The body at $url over HTTPS within two minutes, or an exception naming the address. */
function TOOL__Fetch(string $url): string
{
	$ch = curl_init($url);
	curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 120, CURLOPT_USERAGENT => 'REDZ.UI tools', CURLOPT_PROTOCOLS => CURLPROTO_HTTPS]);
	$body = curl_exec($ch);
	$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
	if (!is_string($body) || $status !== 200) {
		throw new RuntimeException('cannot fetch ' . $url . ': ' . ($status ?: curl_error($ch)));
	}
	return $body;
}

/** Writes the body at $url into $file over HTTPS within ten minutes, through a part file renamed at the end. */
function TOOL__Download(string $url, string $file): void
{
	$part = $file . '.part';
	$out = fopen($part, 'wb');
	$ch = curl_init($url);
	curl_setopt_array($ch, [CURLOPT_FILE => $out, CURLOPT_FOLLOWLOCATION => true, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 600, CURLOPT_USERAGENT => 'REDZ.UI tools', CURLOPT_PROTOCOLS => CURLPROTO_HTTPS]);
	$ok = curl_exec($ch);
	$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
	fclose($out);
	if ($ok !== true || $status !== 200) {
		@unlink($part);
		throw new RuntimeException('cannot download ' . $url . ': ' . ($status ?: curl_error($ch)));
	}
	rename($part, $file);
}

/** The file $name inside a gzipped tar archive. */
function TOOL__TarFile(string $tgz, string $name): string
{
	$tar = gzdecode($tgz);
	if ($tar === false) {
		throw new RuntimeException('the package is not gzip');
	}
	$at = 0;
	$long = '';
	while ($at + 512 <= strlen($tar)) {
		$head = substr($tar, $at, 512);
		if (trim($head, "\0") === '') {
			break;
		}
		$size = (int)octdec(trim(substr($head, 124, 12), " \0"));
		$prefix = rtrim(substr($head, 345, 155), "\0");
		$path = $long !== '' ? $long : ($prefix === '' ? '' : $prefix . '/') . rtrim(substr($head, 0, 100), "\0");
		$long = '';
		$body = substr($tar, $at + 512, $size);
		if ($head[156] === 'x' && preg_match('~\d+ path=([^\n]+)\n~', $body, $m) === 1) {
			$long = $m[1];
		} elseif ($path === $name) {
			return $body;
		}
		$at += 512 + (int)ceil($size / 512) * 512;
	}
	throw new RuntimeException('the package has no ' . $name);
}

/** The file $name of npm package $package at $version (a version or a tag), checked against the registry's sha512 —
 *  and against $integrity when given; answers the version, the integrity and the file. */
function TOOL__NpmFile(string $package, string $version, string $name, string $integrity = ''): array
{
	$meta = json_decode(TOOL__Fetch('https://registry.npmjs.org/' . $package . '/' . rawurlencode($version)), true, 512, JSON_THROW_ON_ERROR);
	$published = (string)($meta['dist']['integrity'] ?? '');
	if ($integrity !== '' && $published !== $integrity) {
		throw new RuntimeException($package . ' ' . $version . ' is published as ' . $published . ', not the pinned ' . $integrity);
	}
	$tgz = TOOL__Fetch((string)$meta['dist']['tarball']);
	if (!str_starts_with($published, 'sha512-') || !hash_equals(substr($published, 7), base64_encode(hash('sha512', $tgz, true)))) {
		throw new RuntimeException($package . ' ' . $version . ' does not match its sha512 ' . $published);
	}
	return ['version' => (string)$meta['version'], 'integrity' => $published, 'body' => TOOL__TarFile($tgz, $name)];
}

/**
 * Every class of the library's stylesheets, unescaped — components, utilities with their prefixes, icons — with the
 * docs page of its stylesheet ('' for the base layers).
 * @return array<string, string>
 */
function TOOL__Classes(): array
{
	$classes = [];
	foreach ([...glob(dirname(__DIR__) . '/css/*.css'), ...glob(dirname(__DIR__) . '/css/components/*.css')] as $file) {
		$page = basename($file, '.css');
		$page = in_array($page, ['base', 'reset', 'tokens', 'scales', 'layers', 'index'], true) ? '' : $page;
		$css = (string)preg_replace(['~/\*.*?\*/~s', '~url\([^)]*\)~'], '', (string)file_get_contents($file));
		preg_match_all('~([^{}]+)\{~', $css, $selectors);
		foreach ($selectors[1] as $selector) {
			if (str_starts_with(trim($selector), '@')) {
				continue;
			}
			preg_match_all('~\.((?:\\\\[0-9a-f]{1,6} ?|\\\\.|[\w-])+)~', $selector, $found);
			foreach ($found[1] as $class) {
				$class = (string)preg_replace_callback('~\\\\([0-9a-f]{1,6}) ?|\\\\(.)~', fn(array $m): string => ($m[2] ?? '') !== '' ? $m[2] : mb_chr((int)hexdec($m[1])), $class);
				$classes[$class][] = $page;
			}
		}
	}
	ksort($classes, SORT_STRING);
	foreach ($classes as $class => $pages) {
		$named = array_filter($pages, fn(string $page): bool => $page !== '' && ($class === $page || str_starts_with($class, $page . '-')));
		$classes[$class] = $named === [] ? $pages[0] : reset($named);
	}
	return $classes;
}
