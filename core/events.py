"""Compatibility entry point for the shared streaming module."""


async def event_stream(runtime, db, last_id=""):
    async for frame in runtime.stream.subscribe(last_id):
        yield frame
