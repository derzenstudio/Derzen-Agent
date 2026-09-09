"""
DERZEN - Shared runtime state.

Holds the global emergency-stop flag so every module can check it without
creating circular imports. When the stop flag is set, long-running operations
should bail out and refuse new work until it is cleared.
"""
from __future__ import annotations

import threading

emergency_stop = threading.Event()


class EmergencyStopped(RuntimeError):
    """Raised when work is attempted while the emergency stop is engaged."""


def check_not_stopped() -> None:
    """Raise EmergencyStopped if the emergency stop is currently engaged."""
    if emergency_stop.is_set():
        raise EmergencyStopped("Emergency stop is engaged; automation is halted.")


def engage() -> None:
    """Engage the emergency stop."""
    emergency_stop.set()


def reset() -> None:
    """Clear the emergency stop so automation can resume."""
    emergency_stop.clear()


def is_engaged() -> bool:
    return emergency_stop.is_set()
