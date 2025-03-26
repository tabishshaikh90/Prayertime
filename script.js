// Global variables for audio playback
const audioPlayer = new Audio();
let audioEnabled = false;
let playedAzans = { Fajr: false, Dhuhr: false, Asr: false, Maghrib: false, Isha: false };
let playedAlarm = false;
let playedReminders = {};
let lastHadithUpdate = null;
let lastMakruhState = false; // Track Makruh Waqt state to detect start
let lastHour = -1; // Track the last hour for hourly buzzer
let playedMakruhBuzzer = false; // Track if Makruh buzzer has been played for the current period
let settings = null; // Store the current settings globally to avoid reloading repeatedly

// Azan audio files
const azaanFiles = {
    Fajr: 'azan/fajr.mp3',
    Dhuhr: 'azan/dhuhr.mp3',
    Asr: 'azan/asr.mp3',
    Maghrib: 'azan/maghrib.mp3',
    Isha: 'azan/isha.mp3',
    MakruhBuzzer: 'azan/buzzer.mp3',
    HourlyBuzzer: 'azan/Alhamd.mp3'
};

// Enable audio playback after user interaction
document.addEventListener('click', () => {
    audioEnabled = true;
    console.log("Audio enabled after user interaction.");
});

// Check if the device is online
function isOnline() {
    return navigator.onLine;
}

// Toggle offline indicator (red dot in top-right corner)
function toggleOfflineIndicator(isOffline) {
    let offlineIndicator = document.getElementById('offline-indicator');
    if (!offlineIndicator) {
        offlineIndicator = document.createElement('div');
        offlineIndicator.id = 'offline-indicator';
        offlineIndicator.style.position = 'fixed';
        offlineIndicator.style.top = '10px';
        offlineIndicator.style.right = '10px';
        offlineIndicator.style.width = '10px';
        offlineIndicator.style.height = '10px';
        offlineIndicator.style.borderRadius = '50%';
        offlineIndicator.style.backgroundColor = 'red';
        document.body.appendChild(offlineIndicator);
    }
    offlineIndicator.style.display = isOffline ? 'block' : 'none';
}

// Load settings from localStorage
function loadSettings() {
    const defaultSettings = {
        location: 'Mumbai',
        calcMethod: '2', // Default to Islamic Society of North America (ISNA)
        asrMethod: 'hanafi', // Default to Hanafi
        alarmTime: '00:00',
        alarmAudio: '',
        reminders: []
    };
    const storedSettings = JSON.parse(localStorage.getItem('settings')) || defaultSettings;
    console.log("Loaded settings:", storedSettings);
    return storedSettings;
}

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
    const today = new Date();
    return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
}

// Calculate Qaza time (2 hours after Jamaat time)
function calculateQazaTime(jamaatTime) {
    const [hours, minutes] = jamaatTime.split(':').map(Number);
    let qazaHours = hours + 2;
    if (qazaHours >= 24) qazaHours -= 24;
    return `${qazaHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Convert time string (HH:MM) to seconds since midnight
function timeToSeconds(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 3600 + minutes * 60;
}

// Convert seconds to HH:MM format
function secondsToHHMM(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Fetch prayer times from Aladhan API with specific parameters, or load from cache if offline
async function fetchPrayerTimes() {
    const location = settings.location;
    const calcMethod = settings.calcMethod;
    const asrMethod = settings.asrMethod === 'hanafi' ? 1 : 0;
    const todayDate = getTodayDate();

    const country = 'IN';
    const state = 'Maharashtra';
    const shafaq = 'general';
    const tune = '5,3,5,7,9,-1,0,-12,-6'; // Adjusted Isha tune to -12
    const timezonestring = 'Asia/Kolkata';

    // Check if cached data exists
    const cachedPrayerTimes = JSON.parse(localStorage.getItem('cachedPrayerTimes')) || {};
    const cachedDate = cachedPrayerTimes.date || null;
    const cachedTimings = cachedPrayerTimes.timings || null;
    const cachedReadableDate = cachedPrayerTimes.readableDate || null;
    const cachedHijriDate = cachedPrayerTimes.hijriDate || null;

    if (!isOnline()) {
        console.warn("Device is offline. Loading cached prayer times.");
        toggleOfflineIndicator(true);
        if (cachedTimings && cachedDate === todayDate) {
            console.log("Using cached prayer times:", cachedTimings);
            // Update UI with cached data
            document.getElementById('fajr-begins').textContent = cachedTimings.Fajr;
            document.getElementById('fajr-jamaat').textContent = cachedTimings.Fajr;
            document.getElementById('fajr-additional').textContent = cachedTimings.Imsak;
            document.getElementById('dhuhr-begins').textContent = cachedTimings.Dhuhr;
            document.getElementById('dhuhr-jamaat').textContent = cachedTimings.Dhuhr;
            document.getElementById('dhuhr-additional').textContent = cachedTimings.Sunrise;
            document.getElementById('asr-begins').textContent = cachedTimings.Asr;
            document.getElementById('asr-jamaat').textContent = cachedTimings.Asr;
            document.getElementById('asr-additional').textContent = cachedTimings.Sunset;
            document.getElementById('maghrib-begins').textContent = cachedTimings.Maghrib;
            document.getElementById('maghrib-jamaat').textContent = cachedTimings.Maghrib;
            document.getElementById('maghrib-additional').textContent = cachedTimings.Sunset;
            document.getElementById('isha-begins').textContent = cachedTimings.Isha;
            document.getElementById('isha-jamaat').textContent = cachedTimings.Isha;
            document.getElementById('isha-qaza').textContent = calculateQazaTime(cachedTimings.Isha);
            document.getElementById('gregorian-date').textContent = cachedReadableDate || 'N/A';
            document.getElementById('islamic-date').textContent = cachedHijriDate || 'N/A';
            return cachedTimings;
        } else {
            console.error("No valid cached prayer times available for today.");
            document.getElementById('fajr-begins').textContent = 'N/A';
            document.getElementById('fajr-jamaat').textContent = 'N/A';
            document.getElementById('fajr-additional').textContent = 'N/A';
            document.getElementById('dhuhr-begins').textContent = 'N/A';
            document.getElementById('dhuhr-jamaat').textContent = 'N/A';
            document.getElementById('dhuhr-additional').textContent = 'N/A';
            document.getElementById('asr-begins').textContent = 'N/A';
            document.getElementById('asr-jamaat').textContent = 'N/A';
            document.getElementById('asr-additional').textContent = 'N/A';
            document.getElementById('maghrib-begins').textContent = 'N/A';
            document.getElementById('maghrib-jamaat').textContent = 'N/A';
            document.getElementById('maghrib-additional').textContent = 'N/A';
            document.getElementById('isha-begins').textContent = 'N/A';
            document.getElementById('isha-jamaat').textContent = 'N/A';
            document.getElementById('isha-qaza').textContent = 'N/A';
            document.getElementById('gregorian-date').textContent = 'N/A';
            document.getElementById('islamic-date').textContent = 'N/A';
            return null;
        }
    }

    try {
        const url = `http://api.aladhan.com/v1/timingsByCity?city=${location}&country=${country}&state=${state}&method=${calcMethod}&shafaq=${shafaq}&tune=${tune}&school=${asrMethod}&timezonestring=${timezonestring}&date=${todayDate}`;
        console.log("Fetching prayer times with URL:", url);
        console.log("Asr Method (school):", asrMethod === 1 ? "Hanafi" : "Standard");

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();

        if (!data.data) {
            throw new Error("No prayer times data in API response");
        }

        const timings = data.data.timings;

        console.log("API Response Timings:", timings);

        document.getElementById('fajr-begins').textContent = timings.Fajr;
        document.getElementById('fajr-jamaat').textContent = timings.Fajr;
        document.getElementById('fajr-additional').textContent = timings.Imsak;
        document.getElementById('dhuhr-begins').textContent = timings.Dhuhr;
        document.getElementById('dhuhr-jamaat').textContent = timings.Dhuhr;
        document.getElementById('dhuhr-additional').textContent = timings.Sunrise;
        document.getElementById('asr-begins').textContent = timings.Asr;
        document.getElementById('asr-jamaat').textContent = timings.Asr;
        document.getElementById('asr-additional').textContent = timings.Sunset;
        document.getElementById('maghrib-begins').textContent = timings.Maghrib;
        document.getElementById('maghrib-jamaat').textContent = timings.Maghrib;
        document.getElementById('maghrib-additional').textContent = timings.Sunset;
        document.getElementById('isha-begins').textContent = timings.Isha;
        document.getElementById('isha-jamaat').textContent = timings.Isha;
        document.getElementById('isha-qaza').textContent = calculateQazaTime(timings.Isha);

        // Set dates
        const readableDate = data.data.date.readable;
        const hijriDate = `${data.data.date.hijri.day} ${data.data.date.hijri.month.en} ${data.data.date.hijri.year}`;
        document.getElementById('gregorian-date').textContent = readableDate;
        document.getElementById('islamic-date').textContent = hijriDate;

        // Cache the prayer times and dates
        localStorage.setItem('cachedPrayerTimes', JSON.stringify({
            date: todayDate,
            timings: timings,
            readableDate: readableDate,
            hijriDate: hijriDate
        }));
        console.log("Cached prayer times for date:", todayDate);

        toggleOfflineIndicator(false);
        return timings;
    } catch (error) {
        console.error("Error fetching prayer times:", error);
        // Fallback to cached data if available
        if (cachedTimings && cachedDate === todayDate) {
            console.log("Falling back to cached prayer times:", cachedTimings);
            toggleOfflineIndicator(true);
            document.getElementById('fajr-begins').textContent = cachedTimings.Fajr;
            document.getElementById('fajr-jamaat').textContent = cachedTimings.Fajr;
            document.getElementById('fajr-additional').textContent = cachedTimings.Imsak;
            document.getElementById('dhuhr-begins').textContent = cachedTimings.Dhuhr;
            document.getElementById('dhuhr-jamaat').textContent = cachedTimings.Dhuhr;
            document.getElementById('dhuhr-additional').textContent = cachedTimings.Sunrise;
            document.getElementById('asr-begins').textContent = cachedTimings.Asr;
            document.getElementById('asr-jamaat').textContent = cachedTimings.Asr;
            document.getElementById('asr-additional').textContent = cachedTimings.Sunset;
            document.getElementById('maghrib-begins').textContent = cachedTimings.Maghrib;
            document.getElementById('maghrib-jamaat').textContent = cachedTimings.Maghrib;
            document.getElementById('maghrib-additional').textContent = cachedTimings.Sunset;
            document.getElementById('isha-begins').textContent = cachedTimings.Isha;
            document.getElementById('isha-jamaat').textContent = cachedTimings.Isha;
            document.getElementById('isha-qaza').textContent = calculateQazaTime(cachedTimings.Isha);
            document.getElementById('gregorian-date').textContent = cachedReadableDate || 'N/A';
            document.getElementById('islamic-date').textContent = cachedHijriDate || 'N/A';
            return cachedTimings;
        } else {
            console.error("No valid cached prayer times available for today.");
            document.getElementById('fajr-begins').textContent = 'N/A';
            document.getElementById('fajr-jamaat').textContent = 'N/A';
            document.getElementById('fajr-additional').textContent = 'N/A';
            document.getElementById('dhuhr-begins').textContent = 'N/A';
            document.getElementById('dhuhr-jamaat').textContent = 'N/A';
            document.getElementById('dhuhr-additional').textContent = 'N/A';
            document.getElementById('asr-begins').textContent = 'N/A';
            document.getElementById('asr-jamaat').textContent = 'N/A';
            document.getElementById('asr-additional').textContent = 'N/A';
            document.getElementById('maghrib-begins').textContent = 'N/A';
            document.getElementById('maghrib-jamaat').textContent = 'N/A';
            document.getElementById('maghrib-additional').textContent = 'N/A';
            document.getElementById('isha-begins').textContent = 'N/A';
            document.getElementById('isha-jamaat').textContent = 'N/A';
            document.getElementById('isha-qaza').textContent = 'N/A';
            document.getElementById('gregorian-date').textContent = 'N/A';
            document.getElementById('islamic-date').textContent = 'N/A';
            return null;
        }
    }
}

// Fetch Hadith data from load_hadiths.php with fallback to hadiths.json or cached data
async function fetchHadith(day, prayer) {
    console.log(`Fetching Hadith for Day ${day}, Prayer ${prayer}`);

    // Check if cached Hadith exists
    const cachedHadiths = JSON.parse(localStorage.getItem('cachedHadiths')) || {};
    const hadithCacheKey = `hadith-${day}-${prayer}`;
    const cachedHadith = cachedHadiths[hadithCacheKey];

    if (!isOnline()) {
        console.warn("Device is offline. Loading cached Hadith.");
        toggleOfflineIndicator(true);
        if (cachedHadith) {
            console.log(`Using cached Hadith for Day ${day}, Prayer ${prayer}:`, cachedHadith);
            return cachedHadith;
        } else {
            console.error(`No cached Hadith available for Day ${day}, Prayer ${prayer}.`);
            return {
                Day: String(day),
                Prayer: prayer,
                English: 'Offline: No cached Hadith',
                Source: 'N/A'
            };
        }
    }

    try {
        const response = await fetch(`load_hadiths.php?prayer=${prayer}&day=${day}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const hadith = await response.json();
        console.log(`Fetched Hadith from load_hadiths.php:`, hadith);

        // Cache the Hadith
        cachedHadiths[hadithCacheKey] = hadith;
        localStorage.setItem('cachedHadiths', JSON.stringify(cachedHadiths));
        console.log(`Cached Hadith for Day ${day}, Prayer ${prayer}`);

        toggleOfflineIndicator(false);
        return hadith;
    } catch (error) {
        console.error(`Error fetching Hadith from load_hadiths.php: ${error.message}. Falling back to hadiths.json or cached data.`);
        // Fallback to loading from hadiths.json
        try {
            const fallbackResponse = await fetch('hadiths.json');
            if (!fallbackResponse.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const hadiths = await fallbackResponse.json();
            console.log(`Loaded hadiths.json:`, hadiths);
            const hadith = hadiths.find(h => h.Day === String(day) && h.Prayer === prayer);
            if (hadith) {
                console.log(`Fetched Hadith from hadiths.json for Day ${day}, Prayer ${prayer}:`, hadith);
                // Cache the Hadith
                cachedHadiths[hadithCacheKey] = hadith;
                localStorage.setItem('cachedHadiths', JSON.stringify(cachedHadiths));
                console.log(`Cached Hadith from hadiths.json for Day ${day}, Prayer ${prayer}`);
                return hadith;
            } else {
                console.log(`No Hadith found in hadiths.json for Day ${day}, Prayer ${prayer}`);
                throw new Error('No Hadith found in hadiths.json');
            }
        } catch (fallbackError) {
            console.error("Error fetching Hadith from hadiths.json:", fallbackError);
            // Fallback to cached Hadith if available
            if (cachedHadith) {
                console.log(`Falling back to cached Hadith for Day ${day}, Prayer ${prayer}:`, cachedHadith);
                toggleOfflineIndicator(true);
                return cachedHadith;
            } else {
                // Return a default Hadith if both attempts fail
                return {
                    Day: String(day),
                    Prayer: prayer,
                    English: 'Unable to load Hadith',
                    Source: 'N/A'
                };
            }
        }
    }
}

// Display the appropriate Hadith based on the current day and most recent prayer
async function displayHadith(timings) {
    try {
        const now = new Date();
        const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

        // Calculate the day of the year (1 to 365) to map to the JSON "Day" field (1 to 360)
        const startOfYear = new Date(now.getFullYear(), 0, 0);
        const dayOfYear = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
        const jsonDay = ((dayOfYear - 1) % 360) + 1; // Ensure it stays within 1 to 360

        // Convert prayer times to seconds for comparison
        const prayerTimes = [
            { name: 'Fajr', time: timings.Fajr },
            { name: 'Dhuhr', time: timings.Dhuhr },
            { name: 'Asr', time: timings.Asr },
            { name: 'Maghrib', time: timings.Maghrib },
            { name: 'Isha', time: timings.Isha },
        ];

        let mostRecentPrayer = 'Isha'; // Default to Isha from the previous day if before Fajr
        let mostRecentPrayerSeconds = 0;

        for (const prayer of prayerTimes) {
            const prayerSeconds = timeToSeconds(prayer.time);
            if (currentSeconds >= prayerSeconds && prayerSeconds > mostRecentPrayerSeconds) {
                mostRecentPrayer = prayer.name;
                mostRecentPrayerSeconds = prayerSeconds;
            }
        }

        // Check if we need to update the Hadith
        const currentHadithKey = `${jsonDay}-${mostRecentPrayer}`;
        if (lastHadithUpdate !== currentHadithKey) {
            const hadith = await fetchHadith(jsonDay, mostRecentPrayer);
            document.getElementById('hadith-english').textContent = hadith.English || 'Not available';
            document.getElementById('hadith-source').textContent = hadith.Source ? `Source: ${hadith.Source}` : 'Source: Not available';
            lastHadithUpdate = currentHadithKey;
            console.log(`Hadith updated for Day ${jsonDay} after ${mostRecentPrayer}`);
        }
    } catch (error) {
        console.error("Error in displayHadith:", error);
        document.getElementById('hadith-english').textContent = 'Error loading Hadith';
        document.getElementById('hadith-source').textContent = '';
    }
}

// Reset played flags for Azan, alarm, reminders, and Makruh buzzer at midnight
function resetPlayedFlags() {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() === 0) {
        playedAzans = { Fajr: false, Dhuhr: false, Asr: false, Maghrib: false, Isha: false };
        playedAlarm = false;
        playedReminders = {};
        playedMakruhBuzzer = false;
        lastHour = -1;
        console.log("Reset played flags at midnight.");
    }
}

// Update current time, highlight current Jamaat with prayer-specific color, display next prayer with remaining time in HH:MM, and Hadith
async function updateTimeAndNextPrayer(timings) {
    try {
        if (!timings) {
            console.warn("No timings available, skipping updateTimeAndNextPrayer");
            return;
        }

        const now = new Date();
        const currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        document.getElementById('current-time').textContent = currentTime;

        const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentSecond = now.getSeconds();

        resetPlayedFlags();

        // Check for hourly buzzer (play Alhamd.mp3 at the start of every hour)
        if (currentHour !== lastHour && currentMinute === 0 && currentSecond <= 60) {
            if (audioEnabled) {
                console.log(`Playing hourly buzzer at ${currentHour}:00: ${azaanFiles.HourlyBuzzer}`);
                audioPlayer.src = azaanFiles.HourlyBuzzer;
                audioPlayer.play().then(() => {
                    console.log("Hourly buzzer played successfully.");
                }).catch(error => {
                    console.error("Error playing hourly buzzer:", error);
                });
            } else {
                console.warn("Audio not enabled. User interaction required to play hourly buzzer.");
            }
            lastHour = currentHour;
        }

        // Check for Azan playback with a 60-second window
        const prayers = [
            { name: 'Fajr', time: timings.Fajr, audio: azaanFiles.Fajr },
            { name: 'Dhuhr', time: timings.Dhuhr, audio: azaanFiles.Dhuhr },
            { name: 'Asr', time: timings.Asr, audio: azaanFiles.Asr },
            { name: 'Maghrib', time: timings.Maghrib, audio: azaanFiles.Maghrib },
            { name: 'Isha', time: timings.Isha, audio: azaanFiles.Isha },
        ];

        const timeWindow = 60; // 60-second window to trigger Azan

        for (const prayer of prayers) {
            const prayerSeconds = timeToSeconds(prayer.time);
            const diff = currentSeconds - prayerSeconds;
            console.log(`Checking ${prayer.name}: Current=${currentSeconds}s, Prayer=${prayerSeconds}s, Diff=${diff}s, Played=${playedAzans[prayer.name]}`);
            if (diff >= 0 && diff <= timeWindow && !playedAzans[prayer.name]) {
                if (audioEnabled) {
                    console.log(`Playing Azan for ${prayer.name}: ${prayer.audio}`);
                    audioPlayer.src = prayer.audio;
                    audioPlayer.play().then(() => {
                        console.log(`Azan for ${prayer.name} played successfully.`);
                    }).catch(error => {
                        console.error(`Error playing Azan for ${prayer.name}:`, error);
                    });
                    playedAzans[prayer.name] = true;
                } else {
                    console.warn(`Audio not enabled. User interaction required to play Azan for ${prayer.name}.`);
                }
            }
        }

        // Check for Alarm playback using the latest settings
        const alarmTime = settings.alarmTime;
        const alarmAudio = settings.alarmAudio;
        const alarmSeconds = timeToSeconds(alarmTime);
        const alarmDiff = currentSeconds - alarmSeconds;
        console.log(`Checking Alarm: Current=${currentSeconds}s, Alarm=${alarmSeconds}s, Diff=${alarmDiff}s, Played=${playedAlarm}, Audio=${alarmAudio}`);
        if (alarmDiff >= 0 && alarmDiff <= timeWindow && !playedAlarm && alarmAudio) {
            if (audioEnabled) {
                console.log(`Playing Alarm: ${alarmAudio}`);
                audioPlayer.src = alarmAudio;
                audioPlayer.play().then(() => {
                    console.log("Alarm played successfully.");
                }).catch(error => {
                    console.error("Error playing Alarm:", error);
                });
                playedAlarm = true;
            } else {
                console.warn("Audio not enabled. User interaction required to play Alarm.");
            }
        }

        // Check for Reminders playback using the latest settings
        const reminders = settings.reminders || [];
        console.log("Checking Reminders:", reminders);
        console.log("Audio Enabled:", audioEnabled);
        console.log("Current Time (seconds):", currentSeconds);
        const newPlayedReminders = {};
        reminders.forEach((_, index) => {
            if (playedReminders[index] !== undefined) {
                newPlayedReminders[index] = playedReminders[index];
            } else {
                newPlayedReminders[index] = false;
            }
        });
        playedReminders = newPlayedReminders;
        console.log("Played Reminders State:", playedReminders);

        reminders.forEach((reminder, index) => {
            const time = reminder.time;
            let audio = reminder.audio;
            if (audio && !audio.startsWith('azan/')) {
                audio = `azan/${audio}`;
                console.warn(`Fixed audio path for Reminder ${index}: ${audio}`);
            }
            const reminderSeconds = timeToSeconds(time);
            const diff = currentSeconds - reminderSeconds;
            console.log(`Checking Reminder ${index}: Time=${time}, Current=${currentSeconds}s, Reminder=${reminderSeconds}s, Diff=${diff}s, Played=${playedReminders[index]}, Audio=${audio}, AudioEnabled=${audioEnabled}`);
            if (diff >= 0 && diff <= timeWindow && !playedReminders[index] && audio) {
                if (audioEnabled) {
                    console.log(`Playing Reminder ${index}: ${audio}`);
                    audioPlayer.src = audio;
                    audioPlayer.play().then(() => {
                        console.log(`Reminder ${index} played successfully.`);
                    }).catch(error => {
                        console.error(`Error playing Reminder ${index}:`, error);
                    });
                    playedReminders[index] = true;
                } else {
                    console.warn(`Audio not enabled. User interaction required to play Reminder ${index}.`);
                }
            } else {
                console.log(`Reminder ${index} not played: Diff=${diff}, Played=${playedReminders[index]}, Audio=${audio}, AudioEnabled=${audioEnabled}`);
            }
        });

        // Determine current Jamaat and next prayer
        let currentPrayer = null;
        let mostRecentPrayerSeconds = -Infinity;
        let nextPrayer = null;
        let nextPrayerSeconds = Infinity;

        for (const prayer of prayers) {
            const prayerSeconds = timeToSeconds(prayer.time);
            // Find the most recent prayer (current Jamaat)
            if (currentSeconds >= prayerSeconds && prayerSeconds > mostRecentPrayerSeconds) {
                currentPrayer = prayer.name;
                mostRecentPrayerSeconds = prayerSeconds;
            }
            // Find the next prayer
            if (prayerSeconds > currentSeconds && prayerSeconds < nextPrayerSeconds) {
                nextPrayer = prayer;
                nextPrayerSeconds = prayerSeconds;
            }
        }

        // If no prayer has occurred yet today, default to Isha from the previous day
        if (!currentPrayer) {
            currentPrayer = 'Isha';
        }

        // Calculate remaining time to next prayer in HH:MM format
        const nextPrayerElement = document.getElementById('next-prayer');
        let isMakruh = false;
        let makruhEndSeconds = 0;

        // Define Makruh Waqt periods
        const imsakSeconds = timeToSeconds(timings.Imsak);
        const sunriseSeconds = timeToSeconds(timings.Sunrise);
        const dhuhrSeconds = timeToSeconds(timings.Dhuhr);
        const asrSeconds = timeToSeconds(timings.Asr);
        const sunsetSeconds = timeToSeconds(timings.Sunset);

        // Makruh Waqt 1: From Subah Sadiq (Imsak) to Sunrise
        if (currentSeconds >= imsakSeconds && currentSeconds < sunriseSeconds) {
            isMakruh = true;
            makruhEndSeconds = sunriseSeconds;
            console.log("Makruh Waqt: Subah Sadiq to Sunrise");
        }
        // Makruh Waqt 2: 5 minutes before Zohr (sun at zenith)
        const dhuhrMakruhStart = dhuhrSeconds - 5 * 60; // 5 minutes before Zohr
        if (currentSeconds >= dhuhrMakruhStart && currentSeconds < dhuhrSeconds) {
            isMakruh = true;
            makruhEndSeconds = dhuhrSeconds;
            console.log("Makruh Waqt: Sun at Zenith (before Zohr)");
        }
        // Makruh Waqt 3: From Asr to Sunset
        if (currentSeconds >= asrSeconds && currentSeconds < sunsetSeconds) {
            isMakruh = true;
            makruhEndSeconds = sunsetSeconds;
            console.log("Makruh Waqt: Asr to Sunset");
        }

        // Check if Makruh Waqt just started to play the buzzer
        if (isMakruh && !lastMakruhState && !playedMakruhBuzzer) {
            if (audioEnabled) {
                console.log(`Makruh Waqt started at ${currentTime}. Playing buzzer: ${azaanFiles.MakruhBuzzer}`);
                audioPlayer.src = azaanFiles.MakruhBuzzer;
                audioPlayer.play().then(() => {
                    console.log("Makruh buzzer played successfully.");
                }).catch(error => {
                    console.error("Error playing Makruh buzzer:", error);
                });
                playedMakruhBuzzer = true;
            } else {
                console.warn("Audio not enabled. User interaction required to play Makruh buzzer.");
            }
        } else if (!isMakruh && lastMakruhState) {
            // Reset the Makruh buzzer flag when Makruh Waqt ends
            playedMakruhBuzzer = false;
        }
        lastMakruhState = isMakruh;

        if (isMakruh) {
            // Display Makruh Waqt warning
            const remainingSeconds = makruhEndSeconds - currentSeconds;
            const remainingTime = secondsToHHMM(remainingSeconds);
            nextPrayerElement.textContent = `Makruh Waqt ends in ${remainingTime}`;
            nextPrayerElement.classList.add('makruh-warning');
        } else {
            // Display next prayer with remaining time in HH:MM
            nextPrayerElement.classList.remove('makruh-warning');
            if (!nextPrayer) {
                // If no upcoming prayer today, use Fajr of the next day
                nextPrayer = prayers[0]; // Fajr
                nextPrayerSeconds = timeToSeconds(nextPrayer.time) + 24 * 3600; // Add 24 hours
            }
            const remainingSeconds = nextPrayerSeconds - currentSeconds;
            const remainingTime = secondsToHHMM(remainingSeconds);
            nextPrayerElement.textContent = `Next Prayer: ${nextPrayer.name} in ${remainingTime}`;
        }

        // Highlight the current Jamaat with prayer-specific color or Makruh highlight
        const prayerBoxes = ['fajr-box', 'dhuhr-box', 'asr-box', 'maghrib-box', 'isha-box'];
        const highlightClasses = ['fajr-highlight', 'dhuhr-highlight', 'asr-highlight', 'maghrib-highlight', 'isha-highlight'];

        // Remove all highlight classes from all prayer boxes
        prayerBoxes.forEach(box => {
            const element = document.getElementById(box);
            highlightClasses.forEach(cls => element.classList.remove(cls));
            element.classList.remove('makruh-highlight'); // Remove Makruh highlight as well
        });

        // Apply the appropriate highlight class based on the current prayer
        const currentBoxId = `${currentPrayer.toLowerCase()}-box`;
        const currentBox = document.getElementById(currentBoxId);
        if (isMakruh) {
            // Apply Makruh highlight (red blinking) during Makruh Waqt
            currentBox.classList.add('makruh-highlight');
        } else {
            // Apply the prayer-specific highlight
            const highlightClass = `${currentPrayer.toLowerCase()}-highlight`;
            currentBox.classList.add(highlightClass);
        }

        // Update Hadith display
        await displayHadith(timings);
    } catch (error) {
        console.error("Error in updateTimeAndNextPrayer:", error);
    }
}

// Listen for changes to localStorage to update settings in real-time
window.addEventListener('storage', (event) => {
    if (event.key === 'settings') {
        console.log("Detected change in localStorage 'settings':", event.newValue);
        settings = loadSettings();
        // Reset the playedAlarm flag to allow the new alarm to play immediately
        playedAlarm = false;
        console.log("Updated settings and reset playedAlarm flag:", settings);
    }
});

// Initialize the app
async function init() {
    try {
        // Load initial settings
        settings = loadSettings();

        // Fetch prayer times
        const timings = await fetchPrayerTimes();
        if (!timings) {
            console.error("Failed to fetch prayer times. Cannot proceed.");
            return;
        }

        // Update time and prayer info every second
        updateTimeAndNextPrayer(timings);
        setInterval(() => updateTimeAndNextPrayer(timings), 1000);

        // Fetch new prayer times at midnight
        setInterval(async () => {
            const now = new Date();
            if (now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() === 0) {
                console.log("Midnight: Fetching new prayer times.");
                const newTimings = await fetchPrayerTimes();
                if (newTimings) {
                    updateTimeAndNextPrayer(newTimings);
                }
            }
        }, 1000);
    } catch (error) {
        console.error("Error initializing app:", error);
    }
}

// Start the app when the page loads
window.onload = init;