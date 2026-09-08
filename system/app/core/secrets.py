"""Vanilla never accesses the host keychain. Provision a local vault separately."""

def read_secret(id):
    raise ValueError("System-Schlüsselbund ist in der isolierten Vanilla-Basis deaktiviert.")

def save_secret(id, value):
    raise ValueError("System-Schlüsselbund ist in der isolierten Vanilla-Basis deaktiviert.")


def register_secret(db, id, name):
    with db.lock:
        state = db.get("control/state.json")["value"]
        if not state:
            return
        state["secrets"] = [s for s in state.get("secrets", []) if s["id"] != id] + [{"id": id, "name": name, "system": True}]
        db.put("control/state.json", state)
