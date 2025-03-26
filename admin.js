// Audio object for playing reminders in the admin panel
let audioPlayer = new Audio();
let currentlyPlayingReminder = null; // Track the currently playing reminder index
let audioEnabled = false; // Track if audio is enabled (after user interaction)

// Load settings from localStorage
function loadSettings() {
    const location = localStorage.getItem('location') || 'Mumbai';
    const calcMethod = localStorage.getItem('calcMethod') || '2'; // Default to University of Islamic Sciences, Karachi
    const asrMethod = localStorage.getItem('asrMethod') || 'standard';
    const alarmTime = localStorage.getItem('alarmTime') || '01:00';
    const alarmAudio = localStorage.getItem('alarmAudio') || '';
    const reminders = JSON.parse(localStorage.getItem('reminders')) || [];

    document.getElementById('location').value = location;
    document.getElementById('calc-method').value = calcMethod;
    if (asrMethod === 'hanafi') {
        document.getElementById('asr-hanafi').classList.add('active');
        document.getElementById('asr-standard').classList.remove('active');
    } else {
        document.getElementById('asr-standard').classList.add('active');
        document.getElementById('asr-hanafi').classList.remove('active');
    }
    document.getElementById('alarm-time').value = alarmTime;
    document.getElementById('alarm-audio').value = alarmAudio;

    return { location, calcMethod, asrMethod, alarmTime, alarmAudio, reminders };
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('location', document.getElementById('location').value);
    localStorage.setItem('calcMethod', document.getElementById('calc-method').value);
    localStorage.setItem('asrMethod', document.getElementById('asr-hanafi').classList.contains('active') ? 'hanafi' : 'standard');
    localStorage.setItem('alarmTime', document.getElementById('alarm-time').value);
    localStorage.setItem('alarmAudio', document.getElementById('alarm-audio').value);
    const reminders = [];
    document.querySelectorAll('.reminder-item').forEach(item => {
        const time = item.querySelector('input[type="time"]').value;
        const audio = item.querySelector('select').value;
        reminders.push({ time, audio });
    });
    localStorage.setItem('reminders', JSON.stringify(reminders));
    console.log('Settings saved:', {
        location: document.getElementById('location').value,
        calcMethod: document.getElementById('calc-method').value,
        asrMethod: document.getElementById('asr-hanafi').classList.contains('active') ? 'hanafi' : 'standard',
        alarmTime: document.getElementById('alarm-time').value,
        alarmAudio: document.getElementById('alarm-audio').value,
        reminders: reminders
    });
}

// Fetch available MP3 files for Alarm and Reminders
let mp3Files = [];
async function fetchAzanFiles() {
    try {
        const response = await fetch('list_mp3.php');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        mp3Files = await response.json();
        console.log("Fetched MP3 files:", mp3Files);

        const selects = ['alarm-audio'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            select.innerHTML = '';
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'None';
            select.appendChild(defaultOption);
            mp3Files.forEach(file => {
                const option = document.createElement('option');
                option.value = `azan/${file}`;
                option.textContent = file;
                select.appendChild(option);
            });
            const savedValue = localStorage.getItem(selectId);
            if (savedValue) select.value = savedValue;
        });

        // Populate reminder selects after loading
        loadReminders(mp3Files);
    } catch (error) {
        console.error("Error fetching MP3 files:", error);
        mp3Files = [];
    }
}

// Load reminders from localStorage and populate the UI
function loadReminders(files) {
    const reminders = JSON.parse(localStorage.getItem('reminders')) || [];
    const remindersList = document.getElementById('reminders-list');
    remindersList.innerHTML = '';
    reminders.forEach((reminder, index) => {
        addReminder(reminder.time, reminder.audio, files, index);
    });
}

// Add a new reminder to the UI
function addReminder(time = '21:00', audio = '', files = mp3Files, index = null) {
    const remindersList = document.getElementById('reminders-list');
    const reminderIndex = index !== null ? index : remindersList.children.length;
    const reminderItem = document.createElement('div');
    reminderItem.className = 'reminder-item';
    reminderItem.setAttribute('data-index', reminderIndex);
    reminderItem.innerHTML = `
        <input type="time" value="${time}">
        <select></select>
        <button class="play-pause-btn" onclick="togglePlayPause(${reminderIndex})">▶️</button>
        <button onclick="removeReminder(this)">Remove</button>
    `;
    const select = reminderItem.querySelector('select');
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'None';
    select.appendChild(defaultOption);
    files.forEach(file => {
        const option = document.createElement('option');
        option.value = `azan/${file}`;
        option.textContent = file;
        select.appendChild(option);
    });
    if (audio) select.value = audio;

    remindersList.appendChild(reminderItem);
}

// Remove a reminder from the UI
function removeReminder(button) {
    const reminderItem = button.parentElement;
    const index = parseInt(reminderItem.getAttribute('data-index'));
    if (currentlyPlayingReminder === index) {
        audioPlayer.pause();
        currentlyPlayingReminder = null;
        updatePlayPauseButtons();
    }
    reminderItem.remove();
    // Re-index remaining reminders
    document.querySelectorAll('.reminder-item').forEach((item, newIndex) => {
        item.setAttribute('data-index', newIndex);
        const playPauseBtn = item.querySelector('.play-pause-btn');
        playPauseBtn.setAttribute('onclick', `togglePlayPause(${newIndex})`);
    });
}

// Toggle play/pause for a reminder
function togglePlayPause(index) {
    if (!audioEnabled) {
        console.warn(`Audio not enabled. User interaction required to play Reminder ${index} in admin panel.`);
        // Attempt to enable audio on this interaction
        audioPlayer.src = ''; // No source needed for silent play
        audioPlayer.play().catch(error => {
            console.warn("Silent audio play failed:", error);
        });
        audioEnabled = true;
        console.log("Audio playback enabled after user interaction in admin panel.");
    }

    const reminderItem = document.querySelector(`.reminder-item[data-index="${index}"]`);
    const audioSrc = reminderItem.querySelector('select').value;

    if (!audioSrc) {
        alert("Please select an audio file for this reminder.");
        return;
    }

    if (currentlyPlayingReminder === index) {
        // Pause the currently playing reminder
        audioPlayer.pause();
        currentlyPlayingReminder = null;
    } else {
        // Stop any currently playing audio
        if (currentlyPlayingReminder !== null) {
            audioPlayer.pause();
        }

        // Play the selected reminder
        audioPlayer.src = audioSrc;
        audioPlayer.play().catch(error => console.error(`Error playing reminder ${index}:`, error));
        currentlyPlayingReminder = index;
    }

    updatePlayPauseButtons();
}

// Update play/pause button icons and highlight the currently playing reminder
function updatePlayPauseButtons() {
    document.querySelectorAll('.reminder-item').forEach(item => {
        const index = parseInt(item.getAttribute('data-index'));
        const playPauseBtn = item.querySelector('.play-pause-btn');
        if (index === currentlyPlayingReminder) {
            playPauseBtn.textContent = '⏸️'; // Pause icon
            item.classList.add('playing'); // Highlight the playing reminder
        } else {
            playPauseBtn.textContent = '▶️'; // Play icon
            item.classList.remove('playing'); // Remove highlight
        }
    });
}

// Show specific tab in settings panel
function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`${tabName}-settings`).style.display = 'block';
}

// Handle Asr method button clicks
document.getElementById('asr-standard').addEventListener('click', () => {
    document.getElementById('asr-standard').classList.add('active');
    document.getElementById('asr-hanafi').classList.remove('active');
});

document.getElementById('asr-hanafi').addEventListener('click', () => {
    document.getElementById('asr-hanafi').classList.add('active');
    document.getElementById('asr-standard').classList.remove('active');
});

// Initial setup
async function initializeAdmin() {
    try {
        loadSettings();
        await fetchAzanFiles();
        showTab('general'); // Show the General tab by default
    } catch (error) {
        console.error("Error initializing admin:", error);
    }
}

// Start the admin panel
initializeAdmin();