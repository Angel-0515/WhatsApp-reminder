const ical = require("node-ical");
const fetch = require("node-fetch");
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const fs = require("fs");

const CALENDAR_URL = "https://p155-caldav.icloud.com/published/2/ODMwMjgxMTIxODMwMjgxMV1RMGDKLWDxbXoVzt3ZSShrqZ0a_LoUqtW6YoAKGeXo"; // <-- Replace with your iCloud public .ics URL
const TARGET_PHONE = "+";       // <-- Replace with the client's WhatsApp number (international format)

const SENT_FILE = "sent.json"; // Store sent event IDs to avoid duplicates

// Load already-sent event IDs
function loadSentEvents() {
  if (!fs.existsSync(SENT_FILE)) return {};
  return JSON.parse(fs.readFileSync(SENT_FILE));
}

// Save sent event IDs
function saveSentEvents(data) {
  fs.writeFileSync(SENT_FILE, JSON.stringify(data, null, 2));
}

// Check if event was already sent
function wasSent(id, sentEvents) {
  return sentEvents[id];
}

// Add event to sent log
function markAsSent(id, sentEvents) {
  sentEvents[id] = true;
  saveSentEvents(sentEvents);
}

// Fetch and parse events
async function getUpcomingEvents() {
  const res = await fetch(CALENDAR_URL);
  const icsData = await res.text();
  const parsed = ical.parseICS(icsData);

  const now = new Date();
  const sentEvents = loadSentEvents();
  const upcomingEvents = [];

  for (const k in parsed) {
    const event = parsed[k];
    if (event.type === "VEVENT" && event.start > now) {
      const eventId = event.uid;
      if (!wasSent(eventId, sentEvents)) {
        upcomingEvents.push({
          id: eventId,
          summary: event.summary,
          start: event.start.toLocaleString(),
          phone: TARGET_PHONE,
        });
      }
    }
  }

  return { upcomingEvents, sentEvents };
}

// WhatsApp Client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true },
});

client.on("qr", (qr) => {
  console.log("Scan this QR code with WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  console.log("WhatsApp client is ready.");

  const { upcomingEvents, sentEvents } = await getUpcomingEvents();

  for (const event of upcomingEvents) {
    const message = `📅 Reminder:\n*${event.summary}*\n🕒 ${event.start}`;
    console.log(`Sending to ${event.phone}: ${message}`);
    await client.sendMessage(event.phone + "@c.us", message);
    markAsSent(event.id, sentEvents);
  }

  console.log("Done.");
  process.exit(); // Exit after sending
});

client.initialize();
