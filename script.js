const audioPlayer = new Audio();
let audioEnabled = false;
let playedAzans = { Fajr: false, Dhuhr: false, Asr: false, Maghrib: false, Isha: false };
let playedAlarm = false;
let playedReminders = {};
let lastHadithUpdate = null;
let lastMakruhState = false;
let lastHour = -1;
let playedMakruhBuzzer = false;
let settings = null;
let currentTimings = null;
let currentlyPlayingReminder = null;
let userInteracted = false;
let prayerTimes30Days = {};

const azaanFiles = {
    Fajr: 'azan/fajr.mp3',
    Dhuhr: 'azan/dhuhr.mp3',
    Asr: 'azan/asr.mp3',
    Maghrib: 'azan/maghrib.mp3',
    Isha: 'azan/isha.mp3',
    MakruhBuzzer: 'azan/buzzer.mp3',
    HourlyBuzzer: 'azan/Alhamd.mp3',
    Silent: 'azan/silent.mp3'
};

function getDateRange() {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 29); // 30 days total, including today

    const formatDate = (date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    };

    return {
        from: formatDate(today),
        to: formatDate(endDate)
    };
}

// Show interaction popup if no interaction
function showInteractionPopup() {
    if (!userInteracted) {
        document.getElementById('interaction-popup').style.display = 'block';
    }
}

// Unlock audio on first user interaction
document.addEventListener('click', () => {
    if (!userInteracted) {
        userInteracted = true;
        audioEnabled = true;
        document.getElementById('interaction-popup').style.display = 'none';
        console.log("Audio enabled after user interaction.");
        audioPlayer.src = azaanFiles.Silent;
        audioPlayer.play().then(() => {
            console.log("Silent audio played successfully, unlocking autoplay.");
        }).catch(error => console.warn("Silent audio play failed:", error));
    }
});

function isOnline() { return navigator.onLine; }

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

const BASE_URL = window.location.origin;

async function loadSettings() {
    const defaultSettings = {
        city: 'Mumbai',
        state: '',
        country: 'India',
        calcMethod: '2',
        asrMethod: 'hanafi',
        adjustment: '0',
        alarmTime: '00:00',
        alarmAudio: '',
        reminders: [],
        theme: 'default',
        layout: 'default'
    };
    try {
        const response = await fetch(`${BASE_URL}/prayer3/save_settings.php`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const loadedSettings = await response.json();
        const settings = {
            city: loadedSettings.city || loadedSettings.location || 'Mumbai',
            state: loadedSettings.state || '',
            country: loadedSettings.country || 'India',
            calcMethod: loadedSettings.calcMethod || '2',
            asrMethod: loadedSettings.asrMethod || 'hanafi',
            adjustment: loadedSettings.adjustment || '0',
            alarmTime: loadedSettings.alarmTime || '00:00',
            alarmAudio: loadedSettings.alarmAudio || '',
            reminders: loadedSettings.reminders || [],
            theme: loadedSettings.theme || 'default',
            layout: loadedSettings.layout || 'default'
        };
        console.log("Loaded settings from server:", settings);
        localStorage.setItem('settings', JSON.stringify(settings));
        return settings;
    } catch (error) {
        console.error("Error fetching settings:", error);
        const storedSettings = JSON.parse(localStorage.getItem('settings')) || defaultSettings;
        return storedSettings;
    }
}


async function pollSettings() {
    try {
        const response = await fetch(`${BASE_URL}/prayer3/save_settings.php`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const newSettings = await response.json();
        if (JSON.stringify(newSettings) !== JSON.stringify(settings)) {
            settings = {
                city: newSettings.city || newSettings.location || 'Mumbai',
                state: newSettings.state || '',
                country: newSettings.country || 'India',
                calcMethod: newSettings.calcMethod || '2',
                asrMethod: newSettings.asrMethod || 'hanafi',
                adjustment: newSettings.adjustment || '0',
                alarmTime: newSettings.alarmTime || '00:00',
                alarmAudio: newSettings.alarmAudio || '',
                reminders: newSettings.reminders || [],
                theme: newSettings.theme || 'default',
                layout: newSettings.layout || 'default'
            };
            console.log("Settings updated from server via polling:", settings);
            localStorage.setItem('settings', JSON.stringify(settings));
            document.body.classList.remove('theme-blue', 'theme-dark', 'theme-light');
            if (settings.theme && settings.theme !== 'default') {
                document.body.classList.add(`theme-${settings.theme}`);
            }
            const prayerGrid = document.querySelector('.prayer-grid');
            prayerGrid.classList.remove('layout-default', 'layout-compact', 'layout-modern');
            if (settings.layout) prayerGrid.classList.add(`layout-${settings.layout}`);
            playedAzans = { Fajr: false, Dhuhr: false, Asr: false, Maghrib: false, Isha: false };
            playedAlarm = false;
            playedReminders = {};
            playedMakruhBuzzer = false;
            lastHour = -1;
            prayerTimes30Days = {}; // Clear cache
            currentTimings = await fetchDayPrayerTimes(getTodayDate()); // Force refetch today’s timings
            if (currentTimings) {
                console.log("New timings applied:", currentTimings);
                updateTimeAndNextPrayer(currentTimings);
            } else {
                console.error("Failed to fetch new prayer times");
            }
            fetchPrayerTimes30Days(); // Refetch 30-day data in background
        }
    } catch (error) {
        console.error("Error polling settings:", error);
        toggleOfflineIndicator(true);
    }
}

// Add listener for General Settings updates
window.addEventListener('message', async (event) => {
    if (event.origin === BASE_URL && event.data.type === 'GENERAL_SETTINGS_UPDATED') {
        const updatedGeneralSettings = event.data.settings;
        const generalKeys = ['city', 'state', 'country', 'calcMethod', 'asrMethod', 'adjustment'];
        const hasGeneralChanges = generalKeys.some(key => settings[key] !== updatedGeneralSettings[key]);

        if (hasGeneralChanges) {
            // Update only General Settings
            settings.city = updatedGeneralSettings.city;
            settings.state = updatedGeneralSettings.state;
            settings.country = updatedGeneralSettings.country;
            settings.calcMethod = updatedGeneralSettings.calcMethod;
            settings.asrMethod = updatedGeneralSettings.asrMethod;
            settings.adjustment = updatedGeneralSettings.adjustment;

            console.log("General settings updated from admin:", settings);
            localStorage.setItem('settings', JSON.stringify(settings));
            prayerTimes30Days = {}; // Clear cache to force refetch
            currentTimings = await fetchPrayerTimes();
            if (currentTimings) updateTimeAndNextPrayer(currentTimings);
        }
    }
});


function getTodayDate(offset = 0) {
    const today = new Date();
    today.setDate(today.getDate() + offset);
    return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
}

function timeToSeconds(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return -1;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return -1;
    return hours * 3600 + minutes * 60;
}

function secondsToHHMM(seconds) {
    if (seconds < 0) return '00:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function calculateQazaTime(ishaTime) {
    const ishaSeconds = timeToSeconds(ishaTime);
    if (ishaSeconds === -1) return 'N/A';
    const midnightSeconds = 24 * 3600; // Midnight (24:00)
    const qazaSeconds = (ishaSeconds + midnightSeconds) / 2; // Midpoint between Isha and midnight
    return secondsToHHMM(Math.floor(qazaSeconds));
}

async function fetchPrayerTimes30Days() {
    if (!settings) return;
    const { city, state, country, calcMethod, asrMethod, adjustment } = settings;
    const shafaq = 'general';
    const tune = '5,3,5,7,9,-1,0,8,-6';
    const timezonestring = 'Asia/Kolkata';
    const { from, to } = getDateRange();

    try {
        const url = `https://api.aladhan.com/v1/calendarByCity/from/${from}/to/${to}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&state=${encodeURIComponent(state || '')}&method=${calcMethod}&school=${asrMethod === 'hanafi' ? 1 : 0}&adjustment=${adjustment}&shafaq=${shafaq}&tune=${tune}&timezonestring=${timezonestring}&calendarMethod=MATHEMATICAL`;
        console.log("Fetching 30-day prayer times from:", url);

        const response = await fetch(url, { mode: 'cors', headers: { 'Accept': 'application/json' } });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();

        prayerTimes30Days = {};
        data.data.forEach(day => {
            const date = day.date.gregorian.date.split('-').reverse().join('-'); // Convert DD-MM-YYYY to YYYY-MM-DD for internal consistency
            prayerTimes30Days[date] = {
                timings: day.timings,
                readableDate: day.date.readable,
                hijriDate: `${day.date.hijri.day} ${day.date.hijri.month.en} ${day.date.hijri.year}`,
                holidays: day.date.hijri.holidays || []
            };
        });

        localStorage.setItem('prayerTimes30Days', JSON.stringify(prayerTimes30Days));
        toggleOfflineIndicator(false);
        console.log("30-day prayer times fetched:", prayerTimes30Days);

        const todayDate = getTodayDate();
        if (prayerTimes30Days[todayDate]) {
            currentTimings = prayerTimes30Days[todayDate].timings;
            updatePrayerUI(currentTimings, prayerTimes30Days[todayDate].readableDate, prayerTimes30Days[todayDate].hijriDate);
            updateTimeAndNextPrayer(currentTimings);
        }
    } catch (error) {
        console.error("Error fetching 30-day prayer times:", error);
        toggleOfflineIndicator(true);
    }
}

async function fetchPrayerTimes() {
    if (!settings) return null;
    const todayDate = getTodayDate();
    prayerTimes30Days = JSON.parse(localStorage.getItem('prayerTimes30Days')) || {};

    if (!isOnline() && prayerTimes30Days[todayDate]) {
        console.warn("Offline: Using cached prayer times.");
        toggleOfflineIndicator(true);
        const cached = prayerTimes30Days[todayDate];
        updatePrayerUI(cached.timings, cached.readableDate, cached.hijriDate);
        return cached.timings;
    }

    return await fetchDayPrayerTimes(todayDate); // Always fetch fresh for today
}

async function fetchDayPrayerTimes(date) {
    const { city, state, country, calcMethod, asrMethod, adjustment } = settings;
    const shafaq = 'general';
    const tune = '5,3,5,7,9,-1,0,8,-6';
    const timezonestring = 'Asia/Kolkata';

    try {
        let url = `http://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&state=${encodeURIComponent(state || '')}&method=${calcMethod}&school=${asrMethod === 'hanafi' ? 1 : 0}&adjustment=${adjustment}&shafaq=${shafaq}&tune=${tune}&timezonestring=${timezonestring}&date=${date}&calendarMethod=MATHEMATICAL`;
        console.log("Fetching prayer times from:", url);

        let response = await fetch(url, { mode: 'cors', redirect: 'follow' });
        if (response.status === 302) {
            const redirectUrl = new URL(response.headers.get('Location'), 'http://api.aladhan.com').href;
            console.log("Redirecting to:", redirectUrl);
            response = await fetch(redirectUrl, { mode: 'cors' });
        }
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        const timings = data.data.timings;
        const readableDate = data.data.date.readable;
        const hijriDate = `${data.data.date.hijri.day} ${data.data.date.hijri.month.en} ${data.data.date.hijri.year}`;
        prayerTimes30Days[date] = { timings, readableDate, hijriDate, holidays: data.data.date.hijri.holidays || [] };
        localStorage.setItem('prayerTimes30Days', JSON.stringify(prayerTimes30Days));
        toggleOfflineIndicator(false);
        console.log("Fetched timings:", timings);
        updatePrayerUI(timings, readableDate, hijriDate);
        return timings;
    } catch (error) {
        console.error("Error fetching prayer times:", error);
        toggleOfflineIndicator(true);
        return null;
    }
}

function updatePrayerUI(timings, readableDate, hijriDate) {
    const fields = [
        { id: 'fajr-begins', value: timings?.Fajr },
        // [Other fields...]
        { id: 'gregorian-date', value: readableDate || 'Loading...' },
        { id: 'islamic-date', value: hijriDate || 'Loading...' }
    ];
    fields.forEach(field => {
        const element = document.getElementById(field.id);
        if (element) {
            element.textContent = field.value || 'N/A';
        } else {
            console.warn(`Element with ID ${field.id} not found`);
        }
    });
    console.log("UI updated with:", { timings, readableDate, hijriDate });
}

async function fetchHadith(day, prayer) {
    const cachedHadiths = JSON.parse(localStorage.getItem('cachedHadiths')) || {};
    const hadithCacheKey = `hadith-${day}-${prayer}`;
    const cachedHadith = cachedHadiths[hadithCacheKey];

    if (cachedHadith) {
        return cachedHadith;
    }

    if (!isOnline()) {
        toggleOfflineIndicator(true);
        return { Day: String(day), Prayer: prayer, English: 'Offline: No cached Hadith', Source: 'N/A' };
    }

    try {
        const response = await fetch(`${BASE_URL}/prayer3/load_hadiths.php?prayer=${prayer}&day=${day}`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const hadith = await response.json();
        cachedHadiths[hadithCacheKey] = hadith;
        localStorage.setItem('cachedHadiths', JSON.stringify(cachedHadiths));
        toggleOfflineIndicator(false);
        return hadith;
    } catch (error) {
        console.error(`Error fetching Hadith: ${error.message}`);
        try {
            const fallbackResponse = await fetch('hadiths.json');
            if (!fallbackResponse.ok) throw new Error(`HTTP error! Status: ${fallbackResponse.status}`);
            const hadiths = await fallbackResponse.json();
            const hadith = hadiths.find(h => h.Day === String(day) && h.Prayer === prayer);
            if (hadith) {
                cachedHadiths[hadithCacheKey] = hadith;
                localStorage.setItem('cachedHadiths', JSON.stringify(cachedHadiths));
                return hadith;
            }
            throw new Error('No Hadith found');
        } catch (fallbackError) {
            console.error("Error fetching fallback Hadith:", fallbackError);
            return { Day: String(day), Prayer: prayer, English: 'Unable to load Hadith', Source: 'N/A' };
        }
    }
}

async function displayHadithAndHolidays(timings) {
    if (!timings) return;

    const now = new Date();
    const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
    const jsonDay = ((dayOfYear - 1) % 360) + 1;

    const prayerTimes = [
        { name: 'Fajr', time: timings.Fajr },
        { name: 'Dhuhr', time: timings.Dhuhr },
        { name: 'Asr', time: timings.Asr },
        { name: 'Maghrib', time: timings.Maghrib },
        { name: 'Isha', time: timings.Isha },
    ];

    let mostRecentPrayer = 'Isha';
    let mostRecentPrayerSeconds = 0;

    for (const prayer of prayerTimes) {
        const prayerSeconds = timeToSeconds(prayer.time);
        if (prayerSeconds !== -1 && currentSeconds >= prayerSeconds && prayerSeconds > mostRecentPrayerSeconds) {
            mostRecentPrayer = prayer.name;
            mostRecentPrayerSeconds = prayerSeconds;
        }
    }

    const hadith = await fetchHadith(jsonDay, mostRecentPrayer);
    let holidayIndex = 0;

    const title = document.getElementById('hadith-title');
    const content = document.getElementById('hadith-english');
    const source = document.getElementById('hadith-source');

    title.textContent = 'HADITH';
    content.textContent = hadith.English || 'Not available';
    source.textContent = hadith.Source ? `Source: ${hadith.Source}` : 'Source: Not available';

    const holidays = [];
    for (let i = 0; i < 30; i++) {
        const date = getTodayDate(i);
        if (prayerTimes30Days[date]?.holidays?.length > 0) {
            holidays.push(...prayerTimes30Days[date].holidays.map(h => `${h} on ${prayerTimes30Days[date].readableDate}`));
        }
    }
    console.log("Holidays array:", holidays);

    function updateHadithDisplay() {
        if (Date.now() % 30000 < 20000) { // 20s Hadith
            title.textContent = 'HADITH';
            content.textContent = hadith.English || 'Not available';
            source.textContent = hadith.Source ? `Source: ${hadith.Source}` : 'Source: Not available';
        } else { // 10s Holidays
            title.textContent = 'HOLIDAY';
            if (holidays.length === 0) {
                content.textContent = 'No upcoming holidays';
            } else {
                content.textContent = holidays[holidayIndex];
                holidayIndex = (holidayIndex + 1) % holidays.length;
            }
            source.textContent = '';
        }
    }

    setInterval(updateHadithDisplay, 1000);
}

function resetPlayedFlags() {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() === 0) {
        playedAzans = { Fajr: false, Dhuhr: false, Asr: false, Maghrib: false, Isha: false };
        playedAlarm = false;
        playedReminders = {};
        playedMakruhBuzzer = false;
        lastHour = -1;
        currentlyPlayingReminder = null;
        console.log("Reset played flags at midnight.");
    }
}

function showPlayPrompt(reminderIndex, audio) {
    const nextPrayerElement = document.getElementById('next-prayer');
    nextPrayerElement.textContent = `Reminder ${reminderIndex + 1} Ready - Click to Play`;
    nextPrayerElement.classList.add('play-prompt');
    nextPrayerElement.onclick = () => {
        audioPlayer.src = audio;
        audioPlayer.play().then(() => {
            currentlyPlayingReminder = reminderIndex;
            updateTimeAndNextPrayer(currentTimings);
        }).catch(error => console.error(`Error playing Reminder ${reminderIndex}:`, error));
    };
}

async function updateTimeAndNextPrayer(timings) {
    if (!timings || typeof timings !== 'object') {
        document.getElementById('next-prayer').textContent = "Error: Prayer times unavailable";
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

    if (!userInteracted) showInteractionPopup();

    if (currentHour !== lastHour && currentMinute === 0 && currentSecond <= 60) {
        if (audioEnabled && userInteracted) {
            audioPlayer.src = azaanFiles.HourlyBuzzer;
            audioPlayer.play().catch(error => console.error("Error playing hourly buzzer:", error));
        }
        lastHour = currentHour;
    }

    const prayers = [
        { name: 'Fajr', time: timings.Fajr, audio: azaanFiles.Fajr },
        { name: 'Dhuhr', time: timings.Dhuhr, audio: azaanFiles.Dhuhr },
        { name: 'Asr', time: timings.Asr, audio: azaanFiles.Asr },
        { name: 'Maghrib', time: timings.Maghrib, audio: azaanFiles.Maghrib },
        { name: 'Isha', time: timings.Isha, audio: azaanFiles.Isha },
    ];

    const timeWindow = 60;
    for (const prayer of prayers) {
        const prayerSeconds = timeToSeconds(prayer.time);
        if (prayerSeconds === -1) continue;
        const diff = currentSeconds - prayerSeconds;
        if (diff >= 0 && diff <= timeWindow && !playedAzans[prayer.name]) {
            if (audioEnabled && userInteracted) {
                audioPlayer.src = prayer.audio;
                audioPlayer.play().then(() => {
                    playedAzans[prayer.name] = true;
                }).catch(error => console.error(`Error playing Azan for ${prayer.name}:`, error));
            } else if (!userInteracted) {
                console.log(`Azan for ${prayer.name} skipped due to no user interaction.`);
            }
        }
    }

    const alarmTime = settings?.alarmTime || '00:00';
    const alarmAudio = settings?.alarmAudio || '';
    const alarmSeconds = timeToSeconds(alarmTime);
    if (alarmSeconds !== -1) {
        const alarmDiff = currentSeconds - alarmSeconds;
        if (alarmDiff >= 0 && alarmDiff <= timeWindow && !playedAlarm && alarmAudio) {
            if (audioEnabled && userInteracted) {
                audioPlayer.src = alarmAudio;
                audioPlayer.play().then(() => {
                    playedAlarm = true;
                }).catch(error => console.error("Error playing Alarm:", error));
            }
        }
    }

    const reminders = settings?.reminders || [];
    reminders.forEach((reminder, index) => {
        const time = reminder?.time;
        let audio = reminder?.audio;
        const repeat = reminder?.repeat || false;
        if (audio && !audio.startsWith('azan/')) audio = `azan/${audio}`;
        const reminderSeconds = timeToSeconds(time);
        if (reminderSeconds === -1) return;
        const diff = currentSeconds - reminderSeconds;

        if (diff >= 0 && diff <= timeWindow && (!playedReminders[index] || repeat) && audio) {
            if (audioEnabled && userInteracted) {
                audioPlayer.src = audio;
                audioPlayer.play().then(() => {
                    currentlyPlayingReminder = index;
                    if (!repeat) playedReminders[index] = true;
                }).catch(error => console.error(`Error playing Reminder ${index}:`, error));
            } else if (!userInteracted) {
                showPlayPrompt(index, audio);
                if (!repeat) playedReminders[index] = true;
            }
        }
    });

    let currentPrayer = null;
    let mostRecentPrayerSeconds = -Infinity;
    let nextPrayer = null;
    let nextPrayerSeconds = Infinity;
    let nextPrayerDate = null;

    for (const prayer of prayers) {
        const prayerSeconds = timeToSeconds(prayer.time);
        if (prayerSeconds === -1) continue;
        if (currentSeconds >= prayerSeconds && prayerSeconds > mostRecentPrayerSeconds) {
            currentPrayer = prayer.name;
            mostRecentPrayerSeconds = prayerSeconds;
        }
        if (prayerSeconds > currentSeconds && prayerSeconds < nextPrayerSeconds) {
            nextPrayer = prayer;
            nextPrayerSeconds = prayerSeconds;
            nextPrayerDate = getTodayDate(0); // Today
        }
    }

    if (!currentPrayer) currentPrayer = 'Isha';

    if (!nextPrayer) {
        nextPrayer = prayers[0];
        nextPrayerSeconds = timeToSeconds(nextPrayer.time) + 24 * 3600;
        nextPrayerDate = getTodayDate(1); // Tomorrow
    }

    const imsakSeconds = timeToSeconds(timings.Imsak);
    const sunriseSeconds = timeToSeconds(timings.Sunrise);
    const dhuhrSeconds = timeToSeconds(timings.Dhuhr);
    const asrSeconds = timeToSeconds(timings.Asr);
    const sunsetSeconds = timeToSeconds(timings.Sunset);

    let isMakruh = false;
    let makruhEndSeconds = 0;

    if (imsakSeconds !== -1 && sunriseSeconds !== -1 && currentSeconds >= imsakSeconds && currentSeconds < sunriseSeconds) {
        isMakruh = true;
        makruhEndSeconds = sunriseSeconds;
    } else if (dhuhrSeconds !== -1 && currentSeconds >= (dhuhrSeconds - 300) && currentSeconds < dhuhrSeconds) {
        isMakruh = true;
        makruhEndSeconds = dhuhrSeconds;
    } else if (sunsetSeconds !== -1 && currentSeconds >= (sunsetSeconds - 300) && currentSeconds < sunsetSeconds) {
        isMakruh = true;
        makruhEndSeconds = sunsetSeconds;
    }

    if (isMakruh && !lastMakruhState && !playedMakruhBuzzer) {
        if (audioEnabled && userInteracted) {
            audioPlayer.src = azaanFiles.MakruhBuzzer;
            audioPlayer.play().then(() => {
                playedMakruhBuzzer = true;
            }).catch(error => console.error("Error playing Makruh buzzer:", error));
        }
    } else if (!isMakruh && lastMakruhState) {
        playedMakruhBuzzer = false;
    }
    lastMakruhState = isMakruh;

    const nextPrayerElement = document.getElementById('next-prayer');
    if (isMakruh) {
        const remainingSeconds = makruhEndSeconds - currentSeconds;
        const remainingTime = secondsToHHMM(remainingSeconds);
        nextPrayerElement.innerHTML = `<strong style="color: #FFFFFF; background-color: #FF0000; padding: 2px 5px; font-weight: bold;">Makruh Waqt ends at ${remainingTime}</strong>`;
        nextPrayerElement.classList.add('makruh-warning');
        nextPrayerElement.classList.remove('play-prompt');
        nextPrayerElement.onclick = null;
    } else if (currentlyPlayingReminder) {
        const reminderAudio = settings.reminders[currentlyPlayingReminder].audio.split('/').pop().replace(/\.[^/.]+$/, '');
        function updateReminderDisplay() {
            const timeElapsed = Date.now() % 25000;
            if (timeElapsed < 10000) { // 10s audio name
                nextPrayerElement.textContent = `${reminderAudio} Playing`;
            } else { // 15s next prayer
                const remainingSeconds = nextPrayerSeconds - currentSeconds;
                const remainingTime = secondsToHHMM(remainingSeconds);
                nextPrayerElement.textContent = `Next Prayer: ${nextPrayer.name} in ${remainingTime}`;
            }
        }
        updateReminderDisplay();
        setInterval(updateReminderDisplay, 1000);
        nextPrayerElement.classList.remove('makruh-warning', 'play-prompt');
        nextPrayerElement.onclick = () => {
            audioPlayer.pause();
            currentlyPlayingReminder = null;
            updateTimeAndNextPrayer(timings);
        };
    } else {
        nextPrayerElement.classList.remove('makruh-warning');
        if (!nextPrayerElement.classList.contains('play-prompt')) {
            nextPrayerElement.onclick = null;
            const remainingSeconds = nextPrayerSeconds - currentSeconds;
            const remainingTime = secondsToHHMM(remainingSeconds);
            nextPrayerElement.textContent = `Next Prayer: ${nextPrayer.name} in ${remainingTime}`;
        }
    }

    const prayerBoxes = ['fajr-box', 'dhuhr-box', 'asr-box', 'maghrib-box', 'isha-box'];
    const highlightClasses = ['fajr-highlight', 'dhuhr-highlight', 'asr-highlight', 'maghrib-highlight', 'isha-highlight'];

    prayerBoxes.forEach(box => {
        const element = document.getElementById(box);
        highlightClasses.forEach(cls => element.classList.remove(cls));
        element.classList.remove('makruh-highlight');
    });

    const currentBoxId = `${currentPrayer.toLowerCase()}-box`;
    const currentBox = document.getElementById(currentBoxId);
    if (isMakruh) {
        currentBox.classList.add('makruh-highlight');
    } else {
        currentBox.classList.add(`${currentPrayer.toLowerCase()}-highlight`);
    }

    await displayHadithAndHolidays(timings);
}

window.addEventListener('storage', async (event) => {
    if (event.key === 'settings' || event.key === null) {
        settings = await loadSettings();
        playedAzans = { Fajr: false, Dhuhr: false, Asr: false, Maghrib: false, Isha: false };
        playedAlarm = false;
        playedReminders = {};
        playedMakruhBuzzer = false;
        lastHour = -1;
        currentTimings = await fetchPrayerTimes();
        if (currentTimings) updateTimeAndNextPrayer(currentTimings);
    }
});

async function init() {
    settings = await loadSettings();
    if (!settings) return;

    // Apply theme from settings
    document.body.classList.remove('theme-blue', 'theme-dark', 'theme-light');
    if (settings.theme && settings.theme !== 'default') {
        document.body.classList.add(`theme-${settings.theme}`);
    }

    // Apply layout from settings
    const prayerGrid = document.querySelector('.prayer-grid');
    prayerGrid.classList.remove('layout-default', 'layout-compact', 'layout-modern');
    if (settings.layout) {
        prayerGrid.classList.add(`layout-${settings.layout}`);
    }

    currentTimings = await fetchPrayerTimes();
    if (!currentTimings) return;

    showInteractionPopup();
    updateTimeAndNextPrayer(currentTimings);
    fetchPrayerTimes30Days();

    // Poll for settings changes every 5 seconds
    setInterval(pollSettings, 5000);

    // Update time every second
    setInterval(() => {
        if (currentTimings) updateTimeAndNextPrayer(currentTimings);
    }, 1000);
}

window.onload = init;