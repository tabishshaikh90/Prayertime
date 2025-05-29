# Prayer Time App

The **Prayer Time App** is a modern, responsive web application designed to provide accurate Islamic prayer times for Muslims worldwide. Powered by the [Aladhan API](https://aladhan.com/prayer-times-api), it delivers precise timings for **Fajr, Dhuhr, Asr, Maghrib, and Isha**, along with additional timings like **Subah Sadiq** and **Qaza**. With a user-friendly interface, customizable features, and offline support, this app is perfect for personal use, mosque displays, or community settings.

Try it live at [prayer.tabish.in](https://prayer.tabish.in) and customize it via the admin panel at [prayer.tabish.in/admin.html](https://prayer.tabish.in/admin.html).

## Features

- **Accurate Prayer Times**: Fetches real-time prayer schedules using the Aladhan API, supporting calculation methods like Muslim World League and Umm al-Qura.
- **Real-Time Display**: Shows current English and Islamic (Hijri) dates, with a countdown timer to the next prayer.
- **Dynamic Prayer Highlighting**: Highlights the current prayer and displays a red blinking bar during Makruh Waqt, with an optional buzzer sound (`azan/buzzer.mp3`).
- **Customizable Audio Notifications**: Plays Azan audio (e.g., `azan/fajr.mp3`) at prayer times and supports hourly reminders with custom MP3 playback.
- **Responsive UI/UX**: Offers grid or list layouts, light/dark themes.
- **Dynamic Backgrounds**: Customize backgrounds via the admin panel.
- **Offline Support**: Caches prayer data in `localStorage` for offline access, with real-time updates via `postMessage`.
- **Admin Panel**: Configure location, calculation method, audio, and display settings.

## Prerequisites

To host the Prayer Time App, ensure you have:
- A web server (e.g., Apache or Nginx) with PHP support.
- Git for cloning the repository.
- A modern web browser (e.g., Chrome or Chromium) for kiosk mode.
- For Raspberry Pi: A Raspberry Pi (e.g., Pi 3 or 4) running Raspberry Pi OS (Debian-based).

## Installation

### General Installation (Linux/Mac/Windows)

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/tabishshaikh90/Prayertime.git
   cd Prayertime
   ```

2. **Set Up a Web Server**:
   - **Linux**: Install Apache and PHP:
     ```bash
     sudo apt-get update
     sudo apt-get install -y apache2 php libapache2-mod-php
     sudo systemctl start apache2
     sudo systemctl enable apache2
     ```
   - **Windows**: Install [XAMPP](https://www.apachefriends.org/), then copy the `Prayertime` folder to `C:\xampp\htdocs\prayertime`.
   - **Mac**: Use Homebrew to install Apache and PHP or use XAMPP.

3. **Copy Files to Web Root**:
   - For Apache on Linux:
     ```bash
     sudo cp -r ./* /var/www/html/prayertime/
     sudo chown -R www-data:www-data /var/www/html/prayertime
     sudo chmod -R 755 /var/www/html/prayertime
     ```
   - For XAMPP on Windows: Ensure the folder is in `htdocs/prayertime`.

4. **Enable .htaccess (Linux/Apache)**:
   ```bash
   sudo a2enmod rewrite
   echo "<Directory /var/www/html/prayertime>
       Options Indexes FollowSymLinks
       AllowOverride All
       Require all granted
   </Directory>" | sudo tee /etc/apache2/sites-available/prayertime.conf
   sudo a2ensite prayertime.conf
   sudo systemctl restart apache2
   ```

5. **Access the App**:
   Open `http://localhost/prayertime` in a browser. Customize settings via `http://localhost/prayertime/admin.html`.

## Hosting on Raspberry Pi

The Prayer Time App is ideal for running on a Raspberry Pi, especially for home displays using kiosk mode on raspberry pi devices. Follow these steps to host the app on a Raspberry Pi:

### Requirements
- Raspberry Pi (Pi 3 or 4 recommended) with Raspberry Pi OS (latest version).
- Internet connection for initial setup and API calls.
- Monitor or touchscreen display.
- Optional: Speaker for Azan and buzzer audio.

### Step-by-Step Instructions

1. **Set Up Raspberry Pi OS**:
   - Download and install [Raspberry Pi OS](https://www.raspberrypi.com/software/) using Raspberry Pi Imager.
   - Boot the Pi, connect to Wi-Fi or Ethernet, and update the system:
     ```bash
     sudo apt-get update && sudo apt-get upgrade -y
     ```

2. **Install Dependencies**:
   Install Git, Apache, PHP, and a browser (Chromium recommended):
   ```bash
   sudo apt-get install -y git apache2 php libapache2-mod-php chromium-browser
   sudo systemctl start apache2
   sudo systemctl enable apache2
   ```

3. **Clone the Repository**:
   ```bash
   git clone https://github.com/tabishshaikh90/Prayertime.git /home/pi/prayertime
   ```

4. **Set Up Apache Web Server**:
   Copy the app files to the Apache web root:
   ```bash
   sudo cp -r /home/pi/prayertime/* /var/www/html/prayertime/
   sudo chown -R www-data:www-data /var/www/html/prayertime
   sudo chmod -R 755 /var/www/html/prayertime
   ```

5. **Enable .htaccess for PHP**:
   ```bash
   sudo a2enmod rewrite
   echo "<Directory /var/www/html/prayertime>
       Options Indexes FollowSymLinks
       AllowOverride All
       Require all granted
   </Directory>" | sudo tee /etc/apache2/sites-available/prayertime.conf
   sudo a2ensite prayertime.conf
   sudo systemctl restart apache2
   ```

6. **Configure Kiosk Mode**:
   - Install `unclutter` to hide the mouse cursor:
     ```bash
     sudo apt-get install -y unclutter
     ```
   - Create an autostart script to launch Chromium in kiosk mode:
     ```bash
     mkdir -p /home/pi/.config/autostart
     cat <<EOF > /home/pi/.config/autostart/prayertime.desktop
   [Desktop Entry]
   Type=Application
   Name=Prayer Time
   Exec=chromium-browser --kiosk http://localhost/prayertime
   Hidden=false
   NoDisplay=false
   X-GNOME-Autostart-enabled=true
   Comment=Open Prayer Time App in kiosk mode
   EOF
     ```
   - Disable screen blanking:
     ```bash
     sudo nano /etc/lightdm/lightdm.conf
     ```
     Add under `[Seat:*]`:
     ```
     xserver-command=X -s 0 -dpms
     ```
     Save and reboot:
     ```bash
     sudo reboot
     ```

7. **Test the App**:
   - After reboot, the Raspberry Pi should automatically launch Chromium in kiosk mode, displaying the app at `http://localhost/prayertime`.
   - Access the admin panel at `http://localhost/prayertime/admin.html` from another device on the same network to configure location, calculation method, and alarm settings.


8. **Audio Setup**:
   - Connect a speaker to the Raspberry Pi’s audio jack or USB sound card.
   - Test Azan audio (`azan/fajr.mp3`) and buzzer (`azan/buzzer.mp3`) via the admin panel.


## Usage

1. Visit [prayer.tabish.in](https://prayer.tabish.in) or `http://localhost/prayertime` to access the app.
2. Use the admin panel (`admin.html`) to:
   - Set your city and country.
   - Choose a calculation method (e.g., Muslim World League).
   - Customize audio notifications and background themes.
3. For mosque displays, run in kiosk mode for a full-screen, distraction-free experience.

## Contributing

Contributions are welcome! To contribute:
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/your-feature`).
3. Commit changes (`git commit -m "Add your feature"`).
4. Push to the branch (`git push origin feature/your-feature`).
5. Open a pull request.

## Feedback

Have questions or feedback? Reach out via the app’s contact section or open an issue on GitHub. Check the browser console for debugging tips.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

Stay connected to your prayers with the **Prayer Time App**—your reliable companion for spiritual mindfulness!
