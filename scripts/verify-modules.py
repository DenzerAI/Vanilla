#!/usr/bin/env python3
"""Check the actual source tree; no application import, account or network required."""
import argparse
import ast
import io
import json
from pathlib import Path
import re
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = 'system/modules.json'


def tree(root, revision=None):
    if revision:
        data = subprocess.check_output(['git', 'archive', '--format=tar', revision], cwd=root)
        with tarfile.open(fileobj=io.BytesIO(data)) as archive:
            return {p.name: archive.extractfile(p).read() for p in archive if p.isfile()}
    names = subprocess.check_output(['git','ls-files','-c','-o','--exclude-standard','-z'], cwd=root).decode().split('\0')
    return {name: (root/name).read_bytes() for name in set(names) if name and (root/name).is_file() and not (root/name).is_symlink()}


def application_source(name):
    return name.split('/')[0] in {'core','backend','wrapper','system','scripts','frontend','jobs'} and '/test' not in name and '/assets/' not in name and Path(name).suffix in {'.py','.mjs','.js','.ts','.tsx','.jsx'}


def endpoints(files):
    result = set()
    for name, data in files.items():
        if not application_source(name):
            continue
        if name.endswith('.py'):
            for node in ast.walk(ast.parse(data, filename=name)):
                if isinstance(node, (ast.FunctionDef,ast.AsyncFunctionDef)):
                    for dec in node.decorator_list:
                        if isinstance(dec,ast.Call) and isinstance(dec.func,ast.Attribute) and dec.func.attr in {'get','post','put','patch','delete','options','head'} and dec.args and isinstance(dec.args[0],ast.Constant) and isinstance(dec.args[0].value,str) and dec.args[0].value.startswith('/'):
                            result.add(f'{dec.func.attr.upper()} {dec.args[0].value}')
        else:
            for method, path in re.findall(r"\broute\(\s*['\"](GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)['\"]\s*,\s*['\"]([^'\"]+)['\"]", data.decode()):
                result.add(f'{method} {path}')
    return result


def verify(files, previous=None):
    errors = []
    try:
        catalog = json.loads(files[MANIFEST])
        assert catalog['version'] == 1 and isinstance(catalog['modules'],list)
    except (KeyError, ValueError, AssertionError):
        return ['Gültige system/modules.json fehlt.']
    routes, registered, owned = endpoints(files), set(), set()
    modules = catalog['modules']; ids = [m.get('id') for m in modules]
    if len(set(ids)) != len(ids): errors.append('Doppelte Modul-ID.')
    old = {m['id']: m for m in json.loads(previous.get(MANIFEST,b'{"modules":[]}')).get('modules',[])} if previous else {}
    for m in modules:
        ident = m.get('id','?')
        if not re.fullmatch(r'[a-z][a-z0-9.-]*',ident): errors.append(f'{ident}: ungültige ID.')
        for field in ['title','purpose','contract','setup','data','verification','sources','entrypoints','status','dependencies','stage','limits','version','migration']:
            if field not in m or (field not in {'dependencies','entrypoints'} and not m[field]): errors.append(f'{ident}: {field} fehlt.')
        if not isinstance(m.get('version'),int) or isinstance(m.get('version'),bool) or m.get('version',0)<1: errors.append(f'{ident}: gültige Modulversion fehlt.')
        for field in ['sources','verification','entrypoints','dependencies']:
            if not isinstance(m.get(field),list) or not all(isinstance(v,str) and v for v in m.get(field,[])):
                return errors+[f'{ident}: {field} muss eine Liste gültiger Quellen sein.']
        for field in ['contract','setup']:
            ref=m.get(field,'');file,_,anchor=ref.partition('#')
            if not file.endswith('.md'): errors.append(f'{ident}: {field} muss einen Markdown-Vertrag nennen.')
            if anchor and file in files:
                headings=re.findall(r'^#+\s+(.+)$',files[file].decode(),re.M)
                anchors={re.sub(r'[^\w\s-]','',h).strip().lower().replace(' ','-') for h in headings}
                explicit=set(re.findall(r'<a\s+id=[\"\']([^\"\']+)',files[file].decode()))
                if anchor not in anchors|explicit: errors.append(f'{ident}: Abschnitt fehlt: {ref}')
        if m.get('stage') not in {'implemented','partial','preview'}: errors.append(f'{ident}: ungültiger Ausbaustand.')
        if not m.get('entrypoints') and m.get('stage') != 'preview' and not m.get('command'): errors.append(f'{ident}: kein aufrufbarer Anschluss.')
        for ref in [m.get('contract',''),m.get('setup',''),*m.get('sources',[]),*m.get('verification',[])]:
            if not ref or ref.split('#')[0] not in files: errors.append(f'{ident}: Quelle fehlt: {ref}')
        for dep in m.get('dependencies',[]):
            if dep not in ids or dep == ident: errors.append(f'{ident}: ungültige Abhängigkeit {dep}.')
        for route in m.get('entrypoints',[]):
            if route not in routes: errors.append(f'{ident}: Anschluss fehlt: {route}')
            registered.add(route)
        status = m.get('status',{})
        if status.get('endpoint') not in routes or not status.get('endpoint','').startswith('GET '): errors.append(f'{ident}: lesbare Statusquelle fehlt.')
        if not status.get('meaning'): errors.append(f'{ident}: Statusbedeutung fehlt.')
        owned.update(m.get('sources',[]))
        if previous and ident in old and any(files.get(p) != previous.get(p) for p in m.get('sources',[])):
            docs = [m.get('contract','').split('#')[0],m.get('setup','').split('#')[0]]
            if m == old[ident] and all(files.get(p)==previous.get(p) for p in docs): errors.append(f'{ident}: Quelländerung ohne aktualisierten Vertrag oder Bauplan.')
    # Fail on a new route even when it lives in an already registered module file.
    errors += [f'Unregistrierter Anschluss: {route}' for route in sorted(routes-registered)]
    errors += [f'Quelldatei ohne Modul: {name}' for name in sorted(files) if application_source(name) and name not in owned]
    def visit(ident, stack):
        if ident in stack: errors.append('Zyklische Modulabhängigkeit: ' + ' -> '.join([*stack,ident])); return
        module = next((m for m in modules if m.get('id')==ident),{})
        for dep in module.get('dependencies',[]):
            if dep in ids: visit(dep,[*stack,ident])
    for ident in ids: visit(ident,[])
    return errors


def main():
    p=argparse.ArgumentParser();p.add_argument('--index',action='store_true');p.add_argument('--revision');p.add_argument('--base');p.add_argument('--root',type=Path,default=ROOT);a=p.parse_args()
    revision = subprocess.check_output(['git','write-tree'],cwd=a.root,text=True).strip() if a.index else a.revision
    errors = verify(tree(a.root,revision),tree(a.root,a.base) if a.base else None)
    print(json.dumps({'ok':not errors,'errors':errors},ensure_ascii=False,indent=2))
    raise SystemExit(bool(errors))


if __name__=='__main__': main()
