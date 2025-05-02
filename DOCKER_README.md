# Docker Setup for Strata Violation Logging App

This document explains how to use Docker to set up a testing environment for the Strata Violation Logging application.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Quick Start

1. Create a `.env.docker` file in the root directory with the following content:

```
# Environment configuration for Docker

# Security settings
SECRET_KEY=docker-testing-secret-key

# Database settings
DATABASE_URL=sqlite:////app/instance/app.db
# Use this for MariaDB if you uncomment the db service in docker-compose.yml
# DATABASE_URL=mysql+mysqldb://violation:violation@db/violation

# Base URL for the application
BASE_URL=http://localhost:5004

# Email settings - these can be overridden by database settings
MAIL_SERVER=localhost
MAIL_PORT=25
MAIL_USE_TLS=False
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_DEFAULT_SENDER=noreply@example.com

# Upload folder
UPLOAD_FOLDER=/app/uploads

# Debug settings
FLASK_DEBUG=1
FLASK_APP=run.py

# Frontend settings
REACT_APP_API_URL=http://localhost:5004
```

2. Build and start the containers:

```bash
docker-compose up --build
```

3. Access the application:
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:5004

## Services

The Docker setup includes the following services:

1. **Backend (Flask)**: Python application with all dependencies
2. **Frontend (React)**: Node.js application with React
3. **ClamAV**: Antivirus service for file scanning
4. **Database**: SQLite by default (MariaDB optional)

## Development and Testing

For development and testing, the setup includes:

- Volume mounts for hot-reloading code changes
- Persistent storage for database and uploads
- Environment variables for configuration
- Debug mode enabled

## Database Options

The default setup uses SQLite, but you can switch to MariaDB:

1. Uncomment the `db` service in `docker-compose.yml`
2. Uncomment the MariaDB volume
3. Update the `DATABASE_URL` in `.env.docker` to use MariaDB

## Common Tasks

### Initialize the Database

```bash
docker-compose exec backend flask db upgrade
```

### Create an Admin User

```bash
docker-compose exec backend python add_admin.py
```

### View Logs

```bash
# Backend logs
docker-compose logs backend

# Frontend logs
docker-compose logs frontend

# ClamAV logs
docker-compose logs clamav
```

## Troubleshooting

### ClamAV Issues

If you encounter ClamAV connection issues, you can try:

```bash
docker-compose exec backend service clamav-daemon restart
```

### Database Migration Issues

If you need to reset the database:

```bash
docker-compose down -v  # This removes volumes!
docker-compose up --build
```

### CORS Issues

If you encounter CORS issues, check:
1. The `REACT_APP_API_URL` in `.env.docker`
2. The CORS configuration in `app/__init__.py`

## Production Usage

This Docker setup is designed for testing and development. For production:

1. Build optimized frontend with `npm run build`
2. Configure proper SSL/TLS
3. Use a production-ready database like MariaDB
4. Set up proper email settings
5. Disable debug mode
6. Use proper secrets management

## Security Notes

- The default `.env.docker` file contains testing credentials
- For real testing with sensitive data, use secure passwords
- The uploads and saved files directories are mounted as volumes for persistence 