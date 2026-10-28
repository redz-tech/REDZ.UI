<?php
// release — what a tag v* publishes, for the release job of the Probes workflow: checks that the tag names the
// passport's version and that the changelog has that version's section, then writes into DIR the archive
// redz-ui-<version>.zip — `git archive` of the tag: the passport and every file it names, under redz-ui-<version>/ —
// and notes.md, the release notes: that section of the changelog, what the files are and how to check them. Usage:
// php tools/release.php TAG DIR

const RELEASE_ROOT = __DIR__ . '/..';
const RELEASE_REPO = 'redz-tech/REDZ.UI';
const RELEASE_SITE = 'https://redz-tech.github.io/REDZ.UI/';

/** The changelog's section of $version without its heading; '' when it has none. */
function RELEASE__Section(string $version): string
{
	$changelog = (string)file_get_contents(RELEASE_ROOT . '/CHANGELOG.md');
	if (preg_match('~^## ' . preg_quote($version, '~') . ' — \d{4}-\d{2}-\d{2}\n(.*?)(?=^## |\z)~ms', $changelog, $m) !== 1) {
		return '';
	}
	return trim($m[1]);
}

/** The release notes of $version under $tag: the changelog's section, the two files and how to check the archive. */
function RELEASE__Notes(string $tag, string $version, string $section): string
{
	return $section . "\n\n---\n\n"
		. '**Files.** `redz-ui-' . $version . '.zip` — the library as released: `redz-ui.json`, its passport (the version, the floor, the stylesheets a bundle joins in their order, the modules, the vocabulary and the sha256 of every file), and every file it names. `checks.zip` — the sheet of the probes this release passed in every engine, also at ' . RELEASE_SITE . $version . "/checks/.\n\n"
		. '**Check the archive:** `gh release verify-asset ' . $tag . ' redz-ui-' . $version . '.zip --repo ' . RELEASE_REPO . "`.\n";
}

/**
 * Checks the tag, writes the archive and the notes into the folder; the exit code.
 * @param list<string> $argv
 */
function RELEASE__Main(array $argv): int
{
	[$tag, $dir] = [$argv[1] ?? '', $argv[2] ?? ''];
	if ($tag === '' || $dir === '') {
		fwrite(STDERR, "usage: php tools/release.php TAG DIR\n");
		return 2;
	}
	$passport = json_decode((string)file_get_contents(RELEASE_ROOT . '/redz-ui.json'), true, 512, JSON_THROW_ON_ERROR);
	$version = (string)$passport['version'];
	if ($tag !== 'v' . $version) {
		fwrite(STDERR, 'the tag ' . $tag . ' does not name the passport\'s version ' . $version . "\n");
		return 1;
	}
	$section = RELEASE__Section($version);
	if ($section === '') {
		fwrite(STDERR, 'CHANGELOG.md has no section "## ' . $version . " — YYYY-MM-DD\"\n");
		return 1;
	}
	if (!is_dir($dir) && !mkdir($dir, 0777, true)) {
		fwrite(STDERR, 'cannot make ' . $dir . "\n");
		return 1;
	}
	$zip = realpath($dir) . '/redz-ui-' . $version . '.zip';
	$git = proc_open(['git', '-C', RELEASE_ROOT, 'archive', '--format=zip', '--prefix=redz-ui-' . $version . '/', '-o', $zip, $tag, '--', 'redz-ui.json', ...array_keys($passport['files'])], [1 => STDOUT, 2 => STDERR], $pipes);
	if (!is_resource($git) || proc_close($git) !== 0) {
		@unlink($zip);
		fwrite(STDERR, 'git archive of ' . $tag . " failed\n");
		return 1;
	}
	file_put_contents($dir . '/notes.md', RELEASE__Notes($tag, $version, $section));
	printf("%s · %d files · %.0f KB\n", basename($zip), count($passport['files']) + 1, filesize($zip) / 1024);
	return 0;
}

exit(RELEASE__Main($argv));
