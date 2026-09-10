"""Owner-managed connections and the bounded MCP action surface."""
import asyncio
from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, Field
from .devices import DeviceInput, DeviceAction


class Revision(BaseModel):
    model_config = ConfigDict(extra='forbid')
    revision: int = Field(ge=1)


class DeviceToolArguments(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    projectId: str = Field(min_length=1, max_length=100)
    id: str = Field(default='', max_length=64)
    action: DeviceAction | None = None


class DeviceTool(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    name: str = Field(pattern=r'^(device_list|device_action)$')
    workerId: str = Field(min_length=1, max_length=60)
    arguments: DeviceToolArguments


def routes(devices, network):
    router = APIRouter()

    @router.get('/api/devices')
    async def listing():
        return devices.list()

    @router.get('/api/devices/usb')
    async def usb():
        return await asyncio.to_thread(devices.usb)

    @router.post('/api/devices/save')
    async def save(b: DeviceInput):
        return devices.save(b)

    @router.post('/api/devices/{id}/revoke')
    async def revoke(id: str):
        return devices.revoke(id)

    @router.post('/api/devices/{id}/remove')
    async def remove(id: str, b: Revision):
        return devices.remove(id, b.revision)

    @router.get('/api/devices/{id}/audit')
    async def audit(id: str):
        return {'entries': [e for e in devices.state()['audit'] if e['deviceId'] == id][-50:]}

    @router.post('/api/devices/{id}/action')
    async def action(id: str, b: DeviceAction):
        return await asyncio.to_thread(devices.execute, id, b)

    # There are deliberately no setup, approval, shell-target or network tools here.
    @router.post('/internal/devices/tool')
    async def tool(b: DeviceTool):
        a = b.arguments
        if b.name == 'device_list':
            return devices.list(a.projectId, b.workerId)
        if not a.id or a.action is None:
            raise ValueError('Gerät und Aktion fehlen.')
        return await asyncio.to_thread(devices.execute, a.id, a.action, a.projectId, b.workerId)

    @router.get('/api/network/status')
    async def network_status():
        return await asyncio.to_thread(network.status)

    @router.post('/api/network/action')
    async def network_action(request: Request):
        b = await request.json()
        if not isinstance(b, dict) or set(b) - {'action', 'publicConfirmed'}:
            raise ValueError('Ungültige Netzwerkeinrichtung.')
        return await asyncio.to_thread(network.action, b.get('action'), b.get('publicConfirmed') is True)

    return router
