"""Smoke-test the actual release archive, including an isolated installed run."""
import argparse
import json
import os
from pathlib import Path, PurePosixPath
import stat
import subprocess
import tempfile
import zipfile

from package_release import ROOT, PLATFORMS, archive_name, programs, version


def test_archive(path, target, ver):
    prefix = f'pmars-ai-{ver}/'
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        assert len(names) == len(archive.infolist()), 'Duplicate archive entries'
        assert archive.testzip() is None, 'Corrupt archive'
        for name in names:
            assert name.startswith(prefix) and '..' not in PurePosixPath(name).parts, name
            assert '/.git/' not in name and not name.endswith(('.o', '.dll')), name
        if target == 'wasm':
            for name in ('docs/pmars.mjs', 'docs/engine.mjs', 'docs/worker.mjs',
                         'docs/settings.mjs', 'docs/dist/pmars.mjs', 'docs/dist/pmars.wasm',
                         'docs/dist/editor.mjs', 'docs/dist/editor-LICENSES.txt',
                         'docs/COPYING', 'docs/pmars-source.zip', 'docs/INTEGRATION.md',
                         'docs/index.html', 'docs/.nojekyll', 'QUICKSTART.txt'):
                assert prefix + name in names, name
            assert not any('/test-output/' in n or '/test-' in n for n in names)
            assert archive.read(prefix + 'docs/dist/pmars.wasm')[:8] == b'\0asm\x01\0\0\0'
            metadata = json.loads(archive.read(prefix + 'release.json'))
            assert metadata['platform'] == target and metadata['version'] == ver
            with tempfile.TemporaryDirectory(prefix='pmars wasm ', dir=ROOT / 'security' / 'build') as folder:
                archive.extractall(folder)
                install = Path(folder) / prefix.rstrip('/')
                subprocess.run(['node', '--input-type=module', '-e', """
                    import assert from 'node:assert/strict';
                    import {Engine, settings, workerURL} from './docs/pmars.mjs';
                    assert.equal(settings().coreSize, 8000);
                    assert.equal(workerURL.pathname.endsWith('/worker.mjs'), true);
                    const engine = await Engine.create({warriors:2, rounds:3, cycles:20}, {visual:false});
                    engine.compile(Array(2).fill(';redcode\\n;assert 1\\nmov 0,1\\n'));
                    let update = engine.start();
                    while (!update.done) update = engine.advance(100000, 8);
                    assert.equal(update.completed, 3);
                    assert.equal(update.warriors[0].ties, 3);
                    console.log('PASS: extracted WASM public API runs a three-round match.');
                """], cwd=install, check=True, timeout=30)
            print('PASS: WASM ZIP contents, licenses, source and module integrity')
            return
        for name in ('src/Makefile', 'src/configpath.c', 'CMakeLists.txt', 'COPYING',
                     'config/nano.opt', 'config/pmars.mac', 'warriors/sunset.red',
                     'dependencies/SDL3-3.4.16.zip', 'licenses/SDL3.txt', 'QUICKSTART.txt'):
            assert prefix + name in names, name
        expected_binaries = {prefix + 'bin/' + name for name in programs(target)}
        assert {name for name in names if name.startswith(prefix + 'bin/')} == expected_binaries
        for name in expected_binaries:
            assert archive.getinfo(name).external_attr >> 16 & stat.S_IXUSR, name
        metadata = json.loads(archive.read(prefix + 'release.json'))
        assert metadata['platform'] == target and metadata['version'] == ver
        if target == 'source':
            print('PASS: source ZIP contents, licenses and integrity')
            return
        with tempfile.TemporaryDirectory(prefix='pmars release ', dir=ROOT / 'security' / 'build') as folder:
            folder = Path(folder)
            if os.name == 'nt':
                archive.extractall(folder)
            else:
                # Test a real unzip utility's preservation of executable bits.
                subprocess.run(['unzip', '-q', str(path.resolve()), '-d', str(folder)], check=True)
            install = folder / prefix.rstrip('/')
            cwd = folder / 'unrelated'
            cwd.mkdir()
            warrior = cwd / 'probe.red'
            warrior.write_text(';redcode\n;assert CORESIZE == 80\ndat 0,0\n')
            env = dict(os.environ, SDL_VIDEO_DRIVER='dummy')
            env.pop('PMARSHOME', None)
            env['PATH'] = str(Path(os.environ['SystemRoot']) / 'System32') if os.name == 'nt' else '/usr/bin:/bin'
            baseline = None
            for name in programs(target):
                exe = install / 'bin' / name
                result = subprocess.run([str(exe), '-@', 'nano.opt', '-b', '-k', '-r', '1',
                                         '-c', '10', '-F', '20', str(warrior), str(warrior)],
                                        env=env, cwd=cwd, input=b'', capture_output=True, timeout=30)
                assert result.returncode == 0, (name, result)
                assert result.stdout, (name, 'Missing scores')
                if baseline is None:
                    baseline = result.stdout
                assert result.stdout == baseline, (name, 'Score mismatch', result.stdout, baseline)
            print(f'PASS: {len(programs(target))} packaged executables run from an unrelated directory; '
                  'config lookup and battle scores agree, without compiler/SDL runtime on PATH')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--platform', required=True, choices=PLATFORMS)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist')
    args = parser.parse_args()
    (ROOT / 'security' / 'build').mkdir(parents=True, exist_ok=True)
    ver = version()
    test_archive(args.output / archive_name(ver, args.platform), args.platform, ver)
