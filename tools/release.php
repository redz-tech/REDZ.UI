<?php
// release - what a tag publishes, for the release jobs of the workflows. A tag v* is the library: it checks that the tag
// names the passport's version and that the changelog has that version's section, then writes into DIR the archive
// redz-ui-<version>.zip - `git archive` of the tag's dist/, the folder a project receives as it is, under
// redz-ui-<version>/ - and notes.md, the release notes: that section of the changelog, what the files are and how to
// check them. A tag icons-* is the icon pack: redz-ui-icons-<version>.zip, the pack's passport, its stylesheet and icons/,
// with its own notes. Each archive holds exactly what its passport lists, and is the same byte for byte wherever it is
// made, so anyone can rebuild a release's from its tag. Usage: php tools/release.php TAG DIR

const RELEASE_ROOT = __DIR__ . '/..';
const RELEASE_REPO = 'redz-tech/REDZ.UI';
const RELEASE_SITE = 'https://redz-tech.github.io/REDZ.UI/';

/** The changelog's section of $version without its heading; '' when it has none. */
function RELEASE__Section(string $version): string
{
	$changelog = (string)file_get_contents(RELEASE_ROOT . '/CHANGELOG.md');
	if (preg_match('~^## ' . preg_quote($version, '~') . ' - \d{4}-\d{2}-\d{2}\n(.*?)(?=^## |\z)~msu', $changelog, $m) !== 1) {
		return '';
	}
	return trim($m[1]);
}

/** The release notes of $version under $tag: the changelog's section, the two files and how to check the archive. */
function RELEASE__Notes(string $tag, string $version, string $section, string $icons): string
{
	return $section . "\n\n---\n\n"
		. '**Files.** `redz-ui-' . $version . '.zip` - the folder a project serves, as it is: `css/`, `js/`, `LICENSE`, `LICENSE-editor`, `NOTICE` and `redz-ui.json`, the passport (the version, the floor, the files to link, the vocabulary and the sha256 of every file). This release needs the icon pack `' . $icons . '`, a release of its own. `checks.zip` - the sheet of the probes this release passed in every engine, also at ' . RELEASE_SITE . $version . "/checks/.\n\n"
		. '**Check the archive:** `gh release verify-asset ' . $tag . ' redz-ui-' . $version . '.zip --repo ' . RELEASE_REPO . "`.\n";
}

/** The release notes of the icon pack $version under $tag. */
function RELEASE__IconNotes(string $tag, string $version, int $files): string
{
	return 'Bootstrap Icons ' . $version . ', unchanged, as CSS masks: `css/icons.min.css` and `icons/*.svg`, ' . $files . " files with the pack's passport `redz-ui-icons.json`. A project keeps the folder under its own path and links the stylesheet; it reaches each icon by a relative URL.\n\n"
		. '**Check the archive:** `gh release verify-asset ' . $tag . ' redz-ui-icons-' . $version . '.zip --repo ' . RELEASE_REPO . "`.\n";
}

/**
 * Runs git in the repository, in UTC: a zip keeps local times, and in UTC it comes out the same wherever it is made.
 * @param list<string> $command
 */
function RELEASE__Git(array $command): string
{
	$proc = proc_open(['git', '-C', RELEASE_ROOT, ...$command], [1 => ['pipe', 'w'], 2 => STDERR], $pipes, null, ['TZ' => 'UTC'] + getenv());
	if (!is_resource($proc)) {
		throw new RuntimeException('cannot run git');
	}
	$out = (string)stream_get_contents($pipes[1]);
	if (proc_close($proc) !== 0) {
		throw new RuntimeException('git ' . $command[0] . ' failed');
	}
	return $out;
}

/**
 * The names of the $folder of the tag $tag, every file, sorted.
 * @return list<string>
 */
function RELEASE__Tree(string $tag, string $folder): array
{
	$names = array_values(array_filter(explode("\n", RELEASE__Git(['ls-tree', '-r', '--name-only', $tag . ':' . $folder]))));
	sort($names, SORT_STRING);
	return $names;
}

/** Writes the library's archive and notes of the tag $tag into $dir; what it says, or throws. */
function RELEASE__Library(string $tag, string $dir): string
{
	$passport = json_decode(RELEASE__Git(['show', $tag . ':dist/redz-ui.json']), true, 512, JSON_THROW_ON_ERROR);
	$version = (string)$passport['version'];
	if ($tag !== 'v' . $version) {
		throw new RuntimeException('the tag ' . $tag . ' does not name the passport\'s version ' . $version);
	}
	$section = RELEASE__Section($version);
	if ($section === '') {
		throw new RuntimeException('CHANGELOG.md has no section "## ' . $version . ' - YYYY-MM-DD"');
	}
	$listed = [...array_keys($passport['files']), 'redz-ui.json'];
	sort($listed, SORT_STRING);
	if (RELEASE__Tree($tag, 'dist') !== $listed) {
		throw new RuntimeException('dist/ of ' . $tag . ' is not what its passport lists: ' . implode(', ', array_diff(RELEASE__Tree($tag, 'dist'), $listed)));
	}
	$zip = realpath($dir) . '/redz-ui-' . $version . '.zip';
	RELEASE__Git(['archive', '--format=zip', '--prefix=redz-ui-' . $version . '/', '--mtime=' . trim(RELEASE__Git(['log', '-1', '--format=%cI', $tag])), '-o', $zip, $tag . ':dist']);
	file_put_contents($dir . '/notes.md', RELEASE__Notes($tag, $version, $section, $passport['icons']['name'] . ' ' . $passport['icons']['version']));
	return sprintf('%s · %d files · %.0f KB', basename($zip), count($listed), filesize($zip) / 1024);
}

/** Writes the pack's archive and notes of the tag $tag into $dir; what it says, or throws. */
function RELEASE__Icons(string $tag, string $dir): string
{
	$passport = json_decode(RELEASE__Git(['show', $tag . ':redz-ui-icons.json']), true, 512, JSON_THROW_ON_ERROR);
	$version = (string)$passport['version'];
	if ($tag !== 'icons-' . $version) {
		throw new RuntimeException('the tag ' . $tag . ' does not name the pack\'s version ' . $version);
	}
	$icons = array_map(fn(string $file): string => 'icons/' . $file, RELEASE__Tree($tag, 'icons'));
	$there = [...$icons, $passport['css']];
	sort($there, SORT_STRING);
	if ($there !== array_keys($passport['files'])) {
		throw new RuntimeException('icons/ of ' . $tag . ' is not what the pack\'s passport lists');
	}
	$zip = realpath($dir) . '/redz-ui-icons-' . $version . '.zip';
	RELEASE__Git(['archive', '--format=zip', '--prefix=redz-ui-icons-' . $version . '/', '-o', $zip, $tag, '--', 'redz-ui-icons.json', $passport['css'], 'icons']);
	file_put_contents($dir . '/notes.md', RELEASE__IconNotes($tag, $version, count($there) + 1));
	return sprintf('%s · %d files · %.0f KB', basename($zip), count($there) + 1, filesize($zip) / 1024);
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
	if (!is_dir($dir) && !mkdir($dir, 0777, true)) {
		fwrite(STDERR, 'cannot make ' . $dir . "\n");
		return 1;
	}
	try {
		echo str_starts_with($tag, 'icons-') ? RELEASE__Icons($tag, $dir) : RELEASE__Library($tag, $dir), "\n";
	} catch (RuntimeException $e) {
		fwrite(STDERR, $e->getMessage() . "\n");
		return 1;
	}
	return 0;
}

exit(RELEASE__Main($argv));
