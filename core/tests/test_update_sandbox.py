import io
import asyncio
import sys
import json
import tarfile
from pathlib import Path
from types import SimpleNamespace

import pytest
from core import update_sandbox as sandbox


def test_sandbox_only_mounts_neutral_readonly_input_and_limits_local_resources(tmp_path,monkeypatch):
    calls=[]
    monkeypatch.setattr(sandbox,'docker',lambda binary,*args:calls.append([binary,*args]) or '')
    inputs=tmp_path/'input';inputs.mkdir()
    profile={'binary':'docker','context':'fixture-local','image':'sha256:'+'a'*64}
    runner=sandbox.start(profile,inputs,tmp_path)
    args=calls[0]
    assert '--network=none' in args and '--read-only' in args and '--cap-drop=ALL' in args
    assert '--log-driver=none' in args and '--pull=never' in args
    mounts=[args[i+1] for i,a in enumerate(args) if a=='--mount']
    assert mounts==['type=bind,src='+str(inputs)+',dst=/input,readonly']
    assert not any('/var/run/docker.sock' in arg for arg in args)
    assert any('/candidate:rw,exec,nosuid,nodev,size=2g' in arg for arg in args)
    cmd=sandbox.command(runner,tmp_path,['node','test.js'],{'HOME':str(tmp_path/'.verify/home'),'PATH':'/host/tooling'})
    assert 'exec' in cmd and '/usr/bin/env' in cmd and '-i' in cmd
    assert 'HOME=/candidate/.verify/home' in cmd and '/host/tooling' not in str(cmd)


def test_remote_engine_and_foreign_container_are_never_used(tmp_path,monkeypatch):
    monkeypatch.setattr(sandbox,'docker',lambda *args:json.dumps([{'Endpoints':{'docker':{'Host':'ssh://example.invalid'}}}]))
    with pytest.raises(ValueError,match='lokal'):sandbox.local_context('docker','fixture')
    sandbox.write(tmp_path/'runner.json',{'name':'vanilla-check-'+'a'*32,'owner':'fixture-owner','context':'fixture'})
    monkeypatch.setattr(sandbox.shutil,'which',lambda name:'docker')
    calls=[]
    def run(args,**kwargs):
        calls.append(args)
        return SimpleNamespace(returncode=0,stdout=json.dumps([{'Config':{'Labels':{'io.vanilla.update.owner':'foreign'}}}]).encode())
    monkeypatch.setattr(sandbox.subprocess,'run',run)
    with pytest.raises(ValueError,match='gehört'):sandbox.cleanup(tmp_path)
    assert not any('rm' in args for args in calls)


def archive(name,kind=tarfile.REGTYPE):
    stream=io.BytesIO()
    with tarfile.open(fileobj=stream,mode='w') as tar:
        entry=tarfile.TarInfo(name);entry.type=kind
        if kind==tarfile.REGTYPE:entry.size=7;tar.addfile(entry,io.BytesIO(b'fixture'))
        else:entry.linkname='/outside';tar.addfile(entry)
    return stream.getvalue()


def test_build_copy_rejects_path_escape_links_and_duplicate_files(tmp_path):
    for name,kind in [('dist/../../outside',tarfile.REGTYPE),('/absolute',tarfile.REGTYPE),('dist/link',tarfile.SYMTYPE),('dist/hardlink',tarfile.LNKTYPE)]:
        with pytest.raises(ValueError):sandbox.extract_build(archive(name,kind),tmp_path/'dist')
    sandbox.extract_build(archive('dist/app.js'),tmp_path/'dist')
    assert (tmp_path/'dist/app.js').read_bytes()==b'fixture'
    with pytest.raises(FileExistsError):sandbox.extract_build(archive('dist/app.js'),tmp_path/'dist')


def test_build_export_streams_from_the_running_container(tmp_path, monkeypatch):
    source = tmp_path / 'container-dist'
    source.mkdir()
    (source / 'app.js').write_text('rendered application')
    spawn = asyncio.create_subprocess_exec

    async def local_container(*args, **kwargs):
        assert args[:6] == ('docker', '--context', 'fixture', 'exec', 'owned', '/usr/local/bin/python')
        script = args[-1].replace('/candidate/wrapper/dist', str(source))
        return await spawn(sys.executable, '-c', script, **kwargs)

    monkeypatch.setattr(sandbox.asyncio, 'create_subprocess_exec', local_container)
    asyncio.run(sandbox.copy_build({'binary':'docker','context':'fixture','name':'owned'}, tmp_path/'dist'))
    assert (tmp_path/'dist/app.js').read_text() == 'rendered application'
