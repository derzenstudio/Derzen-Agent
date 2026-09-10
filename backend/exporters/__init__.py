"""
DERZEN - File exporters.

    from exporters import document
    document.export(body="...", filename="weekly", fmt="pdf")

Every writer lands inside the sandbox through file_manager, so no export can
reach outside ALLOWED_BASE.
"""
