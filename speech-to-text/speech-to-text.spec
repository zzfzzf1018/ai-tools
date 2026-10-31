from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_data_files

datas = []
binaries = []
hiddenimports = []
for package in ('faster_whisper', 'ctranslate2', 'av', 'tokenizers'):
    package_datas, package_binaries, package_hidden = collect_all(package)
    datas += package_datas
    binaries += package_binaries
    hiddenimports += package_hidden
datas += collect_data_files('setuptools')
# Written by scripts/versioning.py in build.ps1; refuse to package an unversioned EXE.
version_file = Path('.artifacts/build-version.json')
if not version_file.is_file():
    raise SystemExit('Missing .artifacts/build-version.json; run build.ps1 to calculate the version.')
datas.append((str(version_file), 'speech_to_text'))

analysis = Analysis(
    ['scripts/launcher.py'],
    pathex=['src'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports + ['speech_to_text.gui', 'pkg_resources'],
    excludes=['onnxruntime', 'torch', 'pytest', 'ruff'],
)
archive = PYZ(analysis.pure)
executable = EXE(
    archive,
    analysis.scripts,
    [],
    exclude_binaries=True,
    name='SpeechToText',
    console=True,
)
collection = COLLECT(executable, analysis.binaries, analysis.datas, name='SpeechToText')