require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const mongoose = require('mongoose');

// --- CONFIGURATION ---
const BOT_TOKEN = "8641069487:AAEpCameV9iRrj2BHjHT9gBvN8jAG_-IJsU";
const GROUP_ID = -1003752493443;
const OWNER_ID = 7077890783;
const API_URL = "https://numberpanel.tech/api/otp?count=200";
const POLL_INTERVAL = 10000; // 10 seconds

// MongoDB URI
const MONGO_URI = 'mongodb+srv://kojiv58207_db_user:9QRspjWGLwqIdVVt@tznumberbot.jsrs9mx.mongodb.net/tznumberbot?retryWrites=true&w=majority&appName=TZNUMBERBOT';

// --- DATABASE SETUP ---
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ TEAM ZERO Database Connected Successfully!'))
    .catch(err => console.error('❌ Database connection error:', err));

const userSchema = new mongoose.Schema({
    chatId: { type: Number, unique: true },
    joinedAt: { type: Date, default: Date.now },
    isVerified: { type: Boolean, default: false }
});
const User = mongoose.model('User', userSchema);

const orderSchema = new mongoose.Schema({
    uid: { type: String, unique: true },
    service: String,
    phoneNumber: String,
    otp: String,
    createdAt: { type: Date, default: Date.now }
});
const SentOTP = mongoose.model('SentOTP', orderSchema);

// --- BOT SETUP ---
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("🚀 TEAM ZERO OTP Forwarder Bot is running...");

let adminState = {};

// --- FORCE JOIN VERIFICATION ---
async function checkForceJoin(userId) {
    if (userId === OWNER_ID) return true;
    try {
        const channelCheck = await bot.getChatMember('@teamzerochanel', userId);
        const groupCheck = await bot.getChatMember('@teamzerootp', userId);
        
        const validStatuses = ['member', 'administrator', 'creator'];
        return validStatuses.includes(channelCheck.status) && validStatuses.includes(groupCheck.status);
    } catch (error) {
        console.error("Force Join Check Error:", error.message);
        return true; 
    }
}

// --- MENUS ---
function sendForceJoinMenu(chatId) {
    const message = `
✨ *Assalamualaikum!* ✨

Mubarak ho! Aap is NUMBER BOT ko bilkul FREE use kar sakte hain. ❤️

⚠️ *Note:* Bot use karne ke liye Telegram Channel, OTP Group aur WHATSAPP CHANNEL join karna lazmi hai.

⚡ *POWERED BY TEAM ZERO*
    `;
    const options = {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [{ text: '📢 Join Telegram Channel', url: 'https://t.me/teamzerochanel' }],
                [{ text: '💬 Join Telegram Group', url: 'https://t.me/teamzerootp' }],
                [{ text: '🟢 Join WhatsApp Channel', url: 'https://whatsapp.com/channel/0029Vb7CHRO96H4QS1ynKI1J' }],
                [{ text: '📞 Contact Bot', url: 'https://t.me/teamzerocontectbot' }],
                [{ text: '✅ Main Ne Join Kar Liya (Verify)', callback_data: 'verify_join' }]
            ]
        }
    };
    bot.sendMessage(chatId, message, options);
}

function sendMainMenu(chatId) {
    const welcomeMessage = `
Welcome to *TEAM ZERO OTP BOT* 🚀

Neeche diye gaye buttons se apni service select karein ya live OTPs group mein check karein.

*Support & Contact:* @teamzerocontectbot

_POWERED BY TEAM ZERO_
    `;
    const options = {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [{ text: '🟢 WhatsApp', callback_data: 'service_whatsapp' }, { text: '🔵 Facebook', callback_data: 'service_facebook' }],
                [{ text: '✈️ Telegram', callback_data: 'service_telegram' }, { text: '📸 Instagram', callback_data: 'service_instagram' }],
                [{ text: '👤 Admin Panel', callback_data: 'admin_panel' }]
            ]
        }
    };
    bot.sendMessage(chatId, welcomeMessage, options);
}

function sendAdminPanel(chatId) {
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📊 Stats', callback_data: 'admin_stats' }],
                [{ text: '📢 Broadcast', callback_data: 'admin_broadcast' }]
            ]
        }
    };
    bot.sendMessage(chatId, "🛠 *TEAM ZERO Admin Panel*", { parse_mode: 'Markdown', ...options });
}

// --- START COMMAND ---
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        await User.updateOne({ chatId }, { $set: { chatId } }, { upsert: true });
    } catch (e) {}

    const isJoined = await checkForceJoin(chatId);
    if (!isJoined) {
        return sendForceJoinMenu(chatId);
    }
    sendMainMenu(chatId);
});

// --- ADMIN COMMAND ---
bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;
    if (chatId !== OWNER_ID) return bot.sendMessage(chatId, "❌ Not authorized.");
    sendAdminPanel(chatId);
});

// --- CALLBACK QUERY HANDLER ---
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === 'verify_join') {
        const isJoined = await checkForceJoin(chatId);
        if (isJoined) {
            bot.answerCallbackQuery(query.id, { text: "✅ Verification Successful!" });
            await User.updateOne({ chatId }, { $set: { isVerified: true } });
            bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
            sendMainMenu(chatId);
        } else {
            bot.answerCallbackQuery(query.id, { text: "❌ Aapne abhi tak Channel ya Group join nahi kiya!", show_alert: true });
        }
        return;
    }

    if (data.startsWith('admin_') || data === 'admin_panel') {
        if (chatId !== OWNER_ID) return bot.answerCallbackQuery(query.id, { text: "❌ Not Authorized!", show_alert: true });
    }

    if (data === 'admin_panel') {
        sendAdminPanel(chatId);
    } 
    else if (data === 'admin_stats') {
        const totalUsers = await User.countDocuments();
        const totalSent = await SentOTP.countDocuments();
        bot.sendMessage(chatId, `📊 *TEAM ZERO STATS*\n\n👥 Total Users: ${totalUsers}\n📨 Total OTPs Forwarded: ${totalSent}`, { parse_mode: 'Markdown' });
    } 
    else if (data === 'admin_broadcast') {
        adminState[chatId] = 'waiting_for_broadcast';
        bot.sendMessage(chatId, "📢 *Broadcast Mode*\n\nApna message bhejein jo sab users ko jayega. (Cancel ke liye /cancel likhein)");
    }
    else if (data.startsWith('service_')) {
        const isJoined = await checkForceJoin(chatId);
        if (!isJoined) return sendForceJoinMenu(chatId);

        const sName = data.split('_')[1];
        bot.answerCallbackQuery(query.id, { text: `Service: ${sName.toUpperCase()}` });
        bot.sendMessage(chatId, `📱 Aapne *${sName.toUpperCase()}* select ki hai. Live OTPs automatically group mein aur yahan forward honge jab bhi receive honge.`, { parse_mode: 'Markdown' });
    }

    try { bot.answerCallbackQuery(query.id); } catch(e) {}
});

// --- BROADCAST LISTENER ---
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return;

    if (adminState[chatId] === 'waiting_for_broadcast') {
        if (text === '/cancel') {
            adminState[chatId] = null;
            return bot.sendMessage(chatId, "❌ Broadcast cancelled.");
        }

        adminState[chatId] = null;
        bot.sendMessage(chatId, "⏳ Broadcast shuru ho gaya hai...");
        
        const users = await User.find();
        let count = 0;
        for (let u of users) {
            try {
                await bot.sendMessage(u.chatId, `📢 *TEAM ZERO UPDATE*\n\n${text}`, { parse_mode: 'Markdown' });
                count++;
            } catch (e) {}
        }
        bot.sendMessage(chatId, `✅ Broadcast complete! Sent to ${count} users.`);
    }
});

// --- HELPER FUNCTIONS FOR OTP PROCESSING ---
function extractOtp(msgText) {
    const match = msgText.match(/\d{3}[-\s]?\d{3,4}|\d{4,8}/);
    return match ? match[0] : 'Unknown';
}

function maskNumber(num) {
    let sNum = String(num).replace('+', '');
    if (sNum.length <= 6) return sNum;
    return sNum.slice(0, 3) + "xxxx" + sNum.slice(-3);
}

// --- BACKGROUND OTP POLLING POOL ---
async function pollOTPs() {
    try {
        const response = await axios.get(API_URL);
        const items = response.data;

        if (Array.isArray(items)) {
            // Reverse taake purane pehle aur naye baad mein hon
            for (let item of items.reverse()) {
                // item structure based on Python code: [service, number, message_text, timestamp_id, ...]
                const service = item[0] || 'Unknown';
                const phoneNumber = item[1] || 'Unknown';
                const messageText = item[2] || '';
                const uniqueId = String(item[3] || `${service}_${phoneNumber}_${Date.now()}`);

                // Check if already processed in DB
                const exists = await SentOTP.findOne({ uid: uniqueId });
                if (!exists) {
                    const otpCode = extractOtp(messageText);
                    const maskedNum = maskNumber(phoneNumber);

                    // Save to DB to prevent duplicate sending
                    await SentOTP.create({
                        uid: uniqueId,
                        service: service,
                        phoneNumber: phoneNumber,
                        otp: otpCode
                    });

                    // Format message
                    const text = `🔥 *TEAM ZERO OTP RECEIVED* 🔥\n\n🌐 Service: *${service.toUpperCase()}*\n📱 Number: \`${maskedNum}\`\n💬 OTP Code: \`${otpCode}\`\n\n_POWERED BY TEAM ZERO_`;
                    
                    const markup = {
                        inline_keyboard: [
                            [{ text: `🔑 OTP: ${otpCode}`, callback_data: 'noop' }],
                            [
                                { text: "Methods", url: "https://youtube.com/@xclusor" },
                                { text: "Channel", url: "https://whatsapp.com/channel/0029Vb7CHRO96H4QS1ynKI1J" }
                            ],
                            [{ text: "OTP Panel", url: "https://t.me/teamzerootp" }]
                        ]
                    };

                    // Send to Group
                    await bot.sendMessage(GROUP_ID, text, { parse_mode: 'Markdown', reply_markup: markup });
                    console.log(`✅ Sent OTP for ${phoneNumber} - ${service}`);
                }
            }
        }
    } catch (error) {
        console.error("Polling Error:", error.message);
    }
}

// Start polling interval
setInterval(pollOTPs, POLL_INTERVAL);
