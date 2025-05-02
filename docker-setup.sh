#!/bin/bash

# Set text colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to display messages with proper formatting
print_message() {
    echo -e "${BLUE}===========================================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${BLUE}===========================================================${NC}"
}

print_error() {
    echo -e "${RED}ERROR: $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
}

print_step() {
    echo -e "\n${BLUE}[$1] ${GREEN}$2${NC}"
}

# Function to prompt for yes/no confirmation
confirm() {
    while true; do
        read -p "$1 [y/n]: " yn
        case $yn in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes (y) or no (n).";;
        esac
    done
}

# Function to check if Docker and Docker Compose are installed
check_docker() {
    print_step "1" "Checking Docker and Docker Compose installation..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed."
        echo "Please install Docker first: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed."
        echo "Please install Docker Compose first: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Docker and Docker Compose are installed.${NC}"
}

# Function to configure hostname and network settings
configure_hostname() {
    print_step "2" "Configuring hostname settings..."
    
    # Default values
    HOST_IP="localhost"
    USE_SPECIFIC_IP=false
    USE_DOMAIN=false
    DOMAIN_NAME=""
    USE_HTTPS=false
    
    echo "The hostname setting defines how the application will be accessed."
    echo "Options:"
    echo "  1) localhost (default, for local development only)"
    echo "  2) specific IP address (for network access)"
    echo "  3) domain name (for production use)"
    
    read -p "Choose hostname type [1-3, default: 1]: " hostname_type
    
    case $hostname_type in
        2)
            USE_SPECIFIC_IP=true
            # Try to detect IP addresses
            echo "Detected IP addresses on this machine:"
            ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | sed 's/^/  /'
            read -p "Enter IP address to use: " ip_input
            if [ ! -z "$ip_input" ]; then
                HOST_IP=$ip_input
            else
                print_error "No IP address provided, using localhost instead."
                HOST_IP="localhost"
                USE_SPECIFIC_IP=false
            fi
            ;;
        3)
            USE_DOMAIN=true
            read -p "Enter domain name (e.g., example.com): " domain_input
            if [ ! -z "$domain_input" ]; then
                DOMAIN_NAME=$domain_input
                HOST_IP=$DOMAIN_NAME
            else
                print_error "No domain provided, using localhost instead."
                HOST_IP="localhost"
                USE_DOMAIN=false
            fi
            
            if confirm "Will you be using HTTPS/SSL?"; then
                USE_HTTPS=true
            fi
            ;;
        *)
            echo "Using localhost (default)"
            ;;
    esac
    
    # Determine protocol
    if [ "$USE_HTTPS" = true ]; then
        PROTOCOL="https"
        print_warning "Note: Using HTTPS requires additional SSL configuration after setup."
    else
        PROTOCOL="http"
    fi
    
    echo -e "${GREEN}✓ Hostname configuration complete.${NC}"
    if [ "$USE_DOMAIN" = true ]; then
        echo -e "   Using domain: ${YELLOW}$PROTOCOL://$HOST_IP${NC}"
    elif [ "$USE_SPECIFIC_IP" = true ]; then
        echo -e "   Using IP address: ${YELLOW}$PROTOCOL://$HOST_IP${NC}"
    else
        echo -e "   Using localhost: ${YELLOW}$PROTOCOL://$HOST_IP${NC}"
    fi
}

# Function to configure database options
configure_database() {
    print_step "3" "Configuring database settings..."
    
    # Default values
    USE_MARIADB=false
    DB_ROOT_PASSWORD="rootpassword"
    DB_NAME="violation"
    DB_USER="violation"
    DB_PASSWORD="violation"
    DB_PORT=3306
    
    if confirm "Would you like to use MariaDB instead of SQLite? (Recommended for production)"; then
        USE_MARIADB=true
        
        # Get MariaDB configuration
        read -p "Enter MariaDB root password [default: rootpassword]: " db_root_password_input
        if [ ! -z "$db_root_password_input" ]; then
            DB_ROOT_PASSWORD=$db_root_password_input
        fi
        
        read -p "Enter database name [default: violation]: " db_name_input
        if [ ! -z "$db_name_input" ]; then
            DB_NAME=$db_name_input
        fi
        
        read -p "Enter database user [default: violation]: " db_user_input
        if [ ! -z "$db_user_input" ]; then
            DB_USER=$db_user_input
        fi
        
        read -p "Enter database password [default: violation]: " db_password_input
        if [ ! -z "$db_password_input" ]; then
            DB_PASSWORD=$db_password_input
        fi
        
        read -p "Enter database port [default: 3306]: " db_port_input
        if [ ! -z "$db_port_input" ]; then
            DB_PORT=$db_port_input
        fi
        
        # Check if port is already in use
        if lsof -Pi :$DB_PORT -sTCP:LISTEN -t >/dev/null ; then
            print_warning "Port $DB_PORT is already in use. You might encounter issues."
            if ! confirm "Do you want to continue with this port?"; then
                echo "Please restart the script and choose a different port."
                exit 1
            fi
        fi
        
        echo -e "${GREEN}✓ MariaDB configuration complete.${NC}"
    else
        echo -e "${GREEN}✓ Using SQLite for database (default).${NC}"
    fi
}

# Function to configure ports and create .env.docker file
configure_env() {
    print_step "4" "Configuring environment settings..."
    
    # Default values
    BACKEND_PORT=5004
    FRONTEND_PORT=3001
    ADMIN_EMAIL="admin@example.com"
    ADMIN_PASSWORD="Admin123!"
    SECRET_KEY="docker-testing-secret-key"
    
    # Get user input for ports
    read -p "Enter backend port [default: 5004]: " backend_port_input
    if [ ! -z "$backend_port_input" ]; then
        BACKEND_PORT=$backend_port_input
    fi
    
    read -p "Enter frontend port [default: 3001]: " frontend_port_input
    if [ ! -z "$frontend_port_input" ]; then
        FRONTEND_PORT=$frontend_port_input
    fi
    
    # Check if ports are already in use
    if lsof -Pi :$BACKEND_PORT -sTCP:LISTEN -t >/dev/null ; then
        print_warning "Port $BACKEND_PORT is already in use. You might encounter issues."
        if ! confirm "Do you want to continue with this port?"; then
            echo "Please restart the script and choose a different port."
            exit 1
        fi
    fi
    
    if lsof -Pi :$FRONTEND_PORT -sTCP:LISTEN -t >/dev/null ; then
        print_warning "Port $FRONTEND_PORT is already in use. You might encounter issues."
        if ! confirm "Do you want to continue with this port?"; then
            echo "Please restart the script and choose a different port."
            exit 1
        fi
    fi
    
    # Get user input for admin credentials
    read -p "Enter admin email [default: admin@example.com]: " admin_email_input
    if [ ! -z "$admin_email_input" ]; then
        ADMIN_EMAIL=$admin_email_input
    fi
    
    read -p "Enter admin password [default: Admin123!]: " admin_password_input
    if [ ! -z "$admin_password_input" ]; then
        ADMIN_PASSWORD=$admin_password_input
    fi
    
    # Configure email settings
    configure_email
    
    # Determine database URL
    if [ "$USE_MARIADB" = true ]; then
        DB_URL="mysql+mysqldb://${DB_USER}:${DB_PASSWORD}@db/${DB_NAME}"
    else
        DB_URL="sqlite:////app/instance/app.db"
    fi
    
    # Create base URLs with protocol and hostname
    BACKEND_BASE_URL="${PROTOCOL}://${HOST_IP}:${BACKEND_PORT}"
    FRONTEND_BASE_URL="${PROTOCOL}://${HOST_IP}:${FRONTEND_PORT}"
    
    # Create .env.docker file
    cat > .env.docker << EOL
# Environment configuration for Docker

# Security settings
SECRET_KEY=$SECRET_KEY

# Database settings
DATABASE_URL=$DB_URL

# Base URL for the application
BASE_URL=$BACKEND_BASE_URL

# Host settings
HOST_IP=$HOST_IP
USE_HTTPS=$USE_HTTPS

# Email settings - these can be overridden by database settings
MAIL_SERVER=$MAIL_SERVER
MAIL_PORT=$MAIL_PORT
MAIL_USE_TLS=$MAIL_USE_TLS
MAIL_USERNAME=$MAIL_USERNAME
MAIL_PASSWORD=$MAIL_PASSWORD
MAIL_DEFAULT_SENDER=$MAIL_SENDER

# Admin settings
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD

# Upload folder
UPLOAD_FOLDER=/app/uploads

# Debug settings
FLASK_DEBUG=1
FLASK_APP=run.py

# Frontend settings
REACT_APP_API_URL=$BACKEND_BASE_URL
PORT=$FRONTEND_PORT
EOL

    echo -e "${GREEN}✓ Environment configuration file (.env.docker) created.${NC}"
}

# Function to configure email settings
configure_email() {
    # Default email settings
    MAIL_SERVER="localhost"
    MAIL_PORT=25
    MAIL_USE_TLS=False
    MAIL_USERNAME=""
    MAIL_PASSWORD=""
    MAIL_SENDER="noreply@example.com"
    
    if confirm "Would you like to configure email settings now?"; then
        read -p "Enter SMTP server [default: localhost]: " mail_server_input
        if [ ! -z "$mail_server_input" ]; then
            MAIL_SERVER=$mail_server_input
        fi
        
        read -p "Enter SMTP port [default: 25]: " mail_port_input
        if [ ! -z "$mail_port_input" ]; then
            MAIL_PORT=$mail_port_input
        fi
        
        if confirm "Use TLS/SSL for email?"; then
            MAIL_USE_TLS=True
        fi
        
        read -p "Enter SMTP username [default: none]: " mail_username_input
        if [ ! -z "$mail_username_input" ]; then
            MAIL_USERNAME=$mail_username_input
        fi
        
        read -p "Enter SMTP password [default: none]: " mail_password_input
        if [ ! -z "$mail_password_input" ]; then
            MAIL_PASSWORD=$mail_password_input
        fi
        
        read -p "Enter default sender email [default: noreply@example.com]: " mail_sender_input
        if [ ! -z "$mail_sender_input" ]; then
            MAIL_SENDER=$mail_sender_input
        fi
        
        echo -e "${GREEN}✓ Email configuration complete.${NC}"
    else
        echo -e "${GREEN}✓ Using default email settings (can be configured later in the admin panel).${NC}"
    fi
}

# Function to update docker-compose.yml with configured ports and database
update_docker_compose() {
    print_step "5" "Updating Docker Compose configuration..."
    
    # Make a backup of the original file
    cp docker-compose.yml docker-compose.yml.bak
    
    # Update the ports in docker-compose.yml
    sed -i "s/\"5004:5004\"/\"$BACKEND_PORT:5004\"/g" docker-compose.yml
    sed -i "s/\"3001:3001\"/\"$FRONTEND_PORT:3001\"/g" docker-compose.yml
    
    # Update the environment variables
    sed -i "s|BASE_URL=http://localhost:5004|BASE_URL=$BACKEND_BASE_URL|g" docker-compose.yml
    
    # Update the REACT_APP_API_URL in the frontend service
    sed -i "s|REACT_APP_API_URL=http://localhost:5004|REACT_APP_API_URL=$BACKEND_BASE_URL|g" docker-compose.yml
    
    # Handle MariaDB configuration
    if [ "$USE_MARIADB" = true ]; then
        # First check if the db service is commented out
        if grep -q "^  # db:" docker-compose.yml; then
            # Uncomment the db service and its configuration
            sed -i 's/^  # db:/  db:/g' docker-compose.yml
            sed -i 's/^  #   image:/    image:/g' docker-compose.yml
            sed -i 's/^  #   environment:/    environment:/g' docker-compose.yml
            sed -i 's/^  #     - MYSQL_ROOT_PASSWORD=/    - MYSQL_ROOT_PASSWORD=/g' docker-compose.yml
            sed -i 's/^  #     - MYSQL_DATABASE=/    - MYSQL_DATABASE=/g' docker-compose.yml
            sed -i 's/^  #     - MYSQL_USER=/    - MYSQL_USER=/g' docker-compose.yml
            sed -i 's/^  #     - MYSQL_PASSWORD=/    - MYSQL_PASSWORD=/g' docker-compose.yml
            sed -i 's/^  #   volumes:/    volumes:/g' docker-compose.yml
            sed -i 's/^  #     - mariadb_data:/    - mariadb_data:/g' docker-compose.yml
            sed -i 's/^  #   networks:/    networks:/g' docker-compose.yml
            sed -i 's/^  #     - app-network/    - app-network/g' docker-compose.yml
            sed -i 's/^  #   healthcheck:/    healthcheck:/g' docker-compose.yml
            sed -i 's/^  #     test:/    test:/g' docker-compose.yml
            sed -i 's/^  #     interval:/    interval:/g' docker-compose.yml
            sed -i 's/^  #     timeout:/    timeout:/g' docker-compose.yml
            sed -i 's/^  #     retries:/    retries:/g' docker-compose.yml
            sed -i 's/^  #     start_period:/    start_period:/g' docker-compose.yml
        fi
        
        # Uncomment the mariadb_data volume at the bottom
        sed -i 's/^  # mariadb_data:  # Uncomment if using MariaDB/  mariadb_data:/g' docker-compose.yml
        
        # Update MariaDB configuration
        sed -i "s/MYSQL_ROOT_PASSWORD=rootpassword/MYSQL_ROOT_PASSWORD=$DB_ROOT_PASSWORD/g" docker-compose.yml
        sed -i "s/MYSQL_DATABASE=violation/MYSQL_DATABASE=$DB_NAME/g" docker-compose.yml
        sed -i "s/MYSQL_USER=violation/MYSQL_USER=$DB_USER/g" docker-compose.yml
        sed -i "s/MYSQL_PASSWORD=violation/MYSQL_PASSWORD=$DB_PASSWORD/g" docker-compose.yml
        
        # Add the database port mapping if it's not the default
        if [ "$DB_PORT" != "3306" ]; then
            sed -i "/image: mariadb:10.6/a\\    ports:\\      - \"$DB_PORT:3306\"" docker-compose.yml
        fi
        
        # Update backend dependencies to include db
        sed -i "/depends_on:/a\\      - db" docker-compose.yml
    fi
    
    echo -e "${GREEN}✓ Docker Compose configuration updated.${NC}"
    echo -e "   Backend URL: ${YELLOW}$BACKEND_BASE_URL${NC}"
    echo -e "   Frontend URL: ${YELLOW}$FRONTEND_BASE_URL${NC}"
    if [ "$USE_MARIADB" = true ]; then
        echo -e "   Database: ${YELLOW}MariaDB on port $DB_PORT${NC}"
    else
        echo -e "   Database: ${YELLOW}SQLite (default)${NC}"
    fi
}

# Function to build and start containers
start_containers() {
    print_step "6" "Building and starting containers..."
    
    if confirm "Would you like to build and start the containers now?"; then
        docker-compose --env-file .env.docker up --build -d
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Containers are being built and started in the background.${NC}"
        else
            print_error "Container build failed. Please check the Docker logs."
            exit 1
        fi
    else
        echo "You can start the containers later with: docker-compose --env-file .env.docker up --build -d"
    fi
}

# Function to check container status
check_container_status() {
    print_step "7" "Checking container status..."
    
    echo "Waiting for containers to start..."
    sleep 10
    
    if [ $(docker-compose ps | grep -c "Up") -ge 2 ]; then
        echo -e "${GREEN}✓ Containers are running.${NC}"
        
        echo -e "\nCurrent container status:"
        docker-compose ps
    else
        print_warning "Some containers may not be running correctly."
        echo -e "\nCurrent container status:"
        docker-compose ps
    fi
}

# Function to initialize database if using MariaDB
initialize_database() {
    print_step "8" "Initializing database..."
    
    if [ "$USE_MARIADB" = true ]; then
        echo "Waiting for MariaDB to be ready..."
        sleep 10
        
        echo "Running database migrations..."
        docker-compose exec backend flask db init || print_warning "Database initialization failed"
        docker-compose exec backend flask db migrate -m "Initial migration" || print_warning "Database migration failed"
        docker-compose exec backend flask db upgrade || print_warning "Database upgrade failed"
        
        echo -e "${GREEN}✓ Database initialized.${NC}"
    else
        echo -e "${GREEN}✓ SQLite database will be created automatically.${NC}"
    fi
}

# Function to display application access information
display_access_info() {
    print_step "9" "Application access information"
    
    echo -e "\nYour Strata Violation Logging App is now set up!"
    echo -e "\nAccess the application at:"
    echo -e "   - Frontend: ${YELLOW}$FRONTEND_BASE_URL${NC}"
    echo -e "   - Backend API: ${YELLOW}$BACKEND_BASE_URL${NC}"
    
    echo -e "\nAdmin login:"
    echo -e "   - Email: ${YELLOW}$ADMIN_EMAIL${NC}"
    echo -e "   - Password: ${YELLOW}$ADMIN_PASSWORD${NC}"
    
    if [ "$USE_MARIADB" = true ]; then
        echo -e "\nDatabase (MariaDB):"
        echo -e "   - Host: ${YELLOW}localhost${NC}"
        echo -e "   - Port: ${YELLOW}$DB_PORT${NC}"
        echo -e "   - Database: ${YELLOW}$DB_NAME${NC}"
        echo -e "   - Username: ${YELLOW}$DB_USER${NC}"
        echo -e "   - Password: ${YELLOW}$DB_PASSWORD${NC}"
    fi
    
    echo -e "\nEmail Configuration:"
    echo -e "   - SMTP Server: ${YELLOW}$MAIL_SERVER${NC}"
    echo -e "   - SMTP Port: ${YELLOW}$MAIL_PORT${NC}"
    echo -e "   - TLS Enabled: ${YELLOW}$MAIL_USE_TLS${NC}"
    
    echo -e "\nUseful commands:"
    echo -e "   - View logs: ${YELLOW}docker-compose logs -f${NC}"
    echo -e "   - Stop containers: ${YELLOW}docker-compose down${NC}"
    echo -e "   - Restart containers: ${YELLOW}docker-compose restart${NC}"
    echo -e "   - Reset everything: ${YELLOW}docker-compose down -v && ./docker-setup.sh${NC}"
    
    if [ "$USE_HTTPS" = true ]; then
        echo -e "\n${YELLOW}HTTPS Configuration:${NC}"
        echo -e "You've chosen to use HTTPS. To complete the setup, you'll need to:"
        echo -e "1. Obtain SSL certificates for your domain"
        echo -e "2. Configure a reverse proxy like Nginx or Traefik"
        echo -e "3. Point the reverse proxy to your Docker containers"
        echo -e "\nExample Nginx configuration for HTTPS:"
        echo -e "   ${YELLOW}https://github.com/nginx-proxy/docker-letsencrypt-nginx-proxy-companion${NC}"
    fi
}

# Main script execution
print_message "Strata Violation Logging App - Docker Setup"
echo "This script will guide you through setting up the application with Docker."

# Run all the functions
check_docker
configure_hostname
configure_database
configure_env
update_docker_compose
start_containers
check_container_status

if [ "$USE_MARIADB" = true ]; then
    initialize_database
fi

display_access_info

print_message "Setup Complete!"
echo "Thank you for using the Strata Violation Logging App." 