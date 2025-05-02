#!/bin/bash
set -e

# Start ClamAV daemon if it's not running
if ! pgrep clamd > /dev/null; then
    echo "Starting ClamAV daemon..."
    freshclam
    service clamav-daemon start
fi

# Check if the database exists, if not create it
if [ ! -f /app/instance/app.db ]; then
    echo "Initializing database..."
    flask db init
    flask db migrate -m "Initial migration"
    flask db upgrade
    
    # Create an admin user if specified in environment variables
    if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
        echo "Creating admin user..."
        python add_admin.py "$ADMIN_EMAIL" "$ADMIN_PASSWORD"
    fi
fi

# Create necessary directories if they don't exist
mkdir -p /app/uploads
mkdir -p /app/saved_files/html
mkdir -p /app/saved_files/pdf
mkdir -p /app/saved_files/uploads/fields

# Set proper permissions
chmod -R 777 /app/uploads
chmod -R 777 /app/saved_files

# Run the command
exec "$@" 