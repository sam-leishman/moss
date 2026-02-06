#!/bin/sh
set -e

# Default UID/GID
PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "Starting Moss with UID=$PUID, GID=$PGID"

# Update moss group GID if different
CURRENT_GID=$(id -g moss 2>/dev/null || echo "")
if [ -n "$CURRENT_GID" ] && [ "$CURRENT_GID" != "$PGID" ]; then
    # Check if target GID is already in use by another group
    EXISTING_GROUP=$(getent group "$PGID" 2>/dev/null | cut -d: -f1 || true)
    if [ -n "$EXISTING_GROUP" ] && [ "$EXISTING_GROUP" != "moss" ]; then
        # Target GID in use, add moss to that group instead
        addgroup moss "$EXISTING_GROUP" 2>/dev/null || true
        sed -i "s/^moss:x:\([^:]*\):\([^:]*\):/moss:x:\1:${PGID}:/" /etc/passwd
    else
        sed -i "s/^moss:\([^:]*\):${CURRENT_GID}:/moss:\1:${PGID}:/" /etc/group
    fi
fi

# Update moss user UID if different
CURRENT_UID=$(id -u moss 2>/dev/null || echo "")
if [ -n "$CURRENT_UID" ] && [ "$CURRENT_UID" != "$PUID" ]; then
    sed -i "s/^moss:x:${CURRENT_UID}:/moss:x:${PUID}:/" /etc/passwd
fi

# Ensure ownership of application directories
chown -R moss:moss /app /config /metadata

# Drop privileges and run the app
exec su-exec moss node build
