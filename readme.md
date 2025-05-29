you can use this install.sh to install on your device 
copy and paste in any editor and run 

#!/bin/bash

# Exit on any error
set -e

# Variables
GIT_URL="https://github.com/tabishshaikh90/Prayertime.git"
CLONE_DIR="$HOME/prayertime"
PRAYER_URL="http://localhost/prayertime"
APACHE_DIR="/var/www/html/prayertime"
DESKTOP_FILE="$HOME/.config/autostart/prayertime.desktop"

# Function to check if a command exists
command_exists() {
    which "$1" >/dev/null 2>&1
}

echo "Starting installation process..."

# Step 1: Install Git and clone the repository
echo "Installing Git..."
sudo apt-get update -y
sudo apt-get install -y git

if [ -d "$CLONE_DIR" ]; then
    echo "Repository already cloned at $CLONE_DIR. Pulling latest changes..."
    cd "$CLONE_DIR"
    git pull origin main
else
    echo "Cloning prayer time repository from $GIT_URL..."
    git clone "$GIT_URL" "$CLONE_DIR"
fi

# Step 2: Install Apache and PHP
echo "Installing Apache and PHP..."
sudo apt-get install -y apache2 php libapache2-mod-php
sudo systemctl start apache2
sudo systemctl enable apache2

# Copy files to Apache web root
echo "Setting up prayer time application in Apache..."
sudo mkdir -p "$APACHE_DIR"
sudo cp -r "$CLONE_DIR"/* "$APACHE_DIR/"
sudo chown -R www-data:www-data "$APACHE_DIR"
sudo chmod -R 755 "$APACHE_DIR"

# Enable .htaccess for PHP
sudo a2enmod rewrite
echo "
    Options Indexes FollowSymLinks
    AllowOverride All
    Require all granted
" | sudo tee /etc/apache2/sites-available/prayertime.conf
sudo a2ensite prayertime.conf
sudo systemctl restart apache2

# Step 3: Check for Chrome or Chromium
echo "Checking for Google Chrome or Chromium..."
CHROME_BIN=""
if command_exists google-chrome; then
    CHROME_BIN="google-chrome"
elif command_exists chromium-browser; then
    CHROME_BIN="chromium-browser"
else
    echo "No Chrome browser found. Installing Google Chrome..."
    wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
    sudo apt-get install -y ./google-chrome-stable_current_amd64.deb
    rm google-chrome-stable_current_amd64.deb
    CHROME_BIN="google-chrome"
fi

# Step 4: Run the website in kiosk mode
echo "Launching prayer time website in $CHROME_BIN kiosk mode..."
$CHROME_BIN --kiosk "$PRAYER_URL" &

# Step 5: Configure startup (optional)
echo "Would you like to open the prayer time website automatically on system startup? (y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    echo "Configuring startup application..."
    mkdir -p "$HOME/.config/autostart"
    cat < "$DESKTOP_FILE"
[Desktop Entry]
Type=Application
Name=Prayer Time
Exec=$CHROME_BIN --kiosk $PRAYER_URL
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Comment=Open prayer time website in kiosk mode
EOF
    chmod +x "$DESKTOP_FILE"
    echo "Startup configuration complete. The prayer time website will open on boot."
else
    echo "Skipping startup configuration."
fi

echo "Installation and setup complete!"
