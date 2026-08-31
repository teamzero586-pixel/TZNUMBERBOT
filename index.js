require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const mongoose = require('mongoose');

// --- CONFIGURATION ---
const BOT_TOKEN = "8641069487:AAEpCameV9iRrj2BHjHT9gBvN8jAG_-IJsU";
const GROUP_ID = -1003752493443;
const OWNER_ID = 7077890783;
const API_URL = "https://numberpanel.tech/api/otp?count=100";
const POLL_INTERVAL = 5000;

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

// Admin uploaded custom numbers schema: Service -> Country -> Numbers Array
const customNumberSchema = new mongoose.Schema({
    service: { type: String, required: true },
    country: { type: String, required: true },
    numbers: { type: [String], default: [] }
});
const CustomNumber = mongoose.model('CustomNumber', customNumberSchema);

// Memory state to track last sent OTP IDs so old OTPs never resend
let lastSeenOtpIds = new Set();
let adminState = {};
let userSession = {}; // Stores user current service and country viewing state

// --- BOT SETUP ---
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("🚀 TEAM ZERO OTP Bot is running stably...");

// --- FORCE JOIN VERIFICATION ---
async function checkForceJoin(userId) {
    if (userId === OWNER_ID) return true;
    try {
        const channelCheck = await bot.getChatMember('@teamzerochanel', userId);
        const groupCheck = await bot.getChatMember('@teamzerootp', userId);
        const validStatuses = ['member', 'administrator', 'creator'];
        return validStatuses.includes(channelCheck.status) && validStatuses.includes(groupCheck.status);
    } catch (error) {
        return false; 
    }
}

// --- MENUS ---
function sendForceJoinMenu(chatId) {
    const message = `
✨ *Assalamualaikum!* ✨

Mubarak ho! Aap is NUMBER BOT ko bilkul FREE use kar sakte hain. ❤️

⚠️ *Note:* Bot use karne ke liye niche diye gaye Telegram aur WhatsApp channels/groups ko join karna lazmi hai! Join karne ke baad **Verify** button par click karein.

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
                [{ text: '✅ Main Ne Join Kar Liya (Verify)', callback_data: 'verify_join' }]
            ]
        }
    };
    bot.sendMessage(chatId, message, options);
}

function sendMainMenu(chatId) {
    const welcomeMessage = `
Welcome to *TEAM ZERO OTP BOT* 🚀

Neeche di gayi services mein se apni pasand ki service select karein:

*Support & Contact:* @teamzerocontectbot
_POWERED BY TEAM ZERO_
    `;
    const options = {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🟢 WhatsApp', callback_data: 'srv_whatsapp' },
                    { text: '📸 Instagram', callback_data: 'srv_instagram' }
                ],
                [
                    { text: '🔵 Facebook', callback_data: 'srv_facebook' },
                    { text: '🎵 TikTok', callback_data: 'srv_tiktok' }
                ],
                [
                    { text: '✈️ Telegram', callback_data: 'srv_telegram' },
                    { text: '💬 Imo', callback_data: 'srv_imo' }
                ],
                ...(chatId === OWNER_ID ? [[{ text: '👤 Admin Panel', callback_data: 'admin_panel' }]] : [])
            ]
        }
    };
    bot.sendMessage(chatId, welcomeMessage, options);
}

function sendAdminPanel(chatId) {
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '➕ Add Numbers via File', callback_data: 'admin_add_nums' }],
                [{ text: '📊 Stats', callback_data: 'admin_stats' }],
                [{ text: '📢 Broadcast', callback_data: 'admin_broadcast' }],
                [{ text: '🔙 Main Menu', callback_data: 'main_menu' }]
            ]
        }
    };
    bot.sendMessage(chatId, "🛠 *TEAM ZERO Admin Panel*\n\nNumbers add karne ke liye 'Add Numbers via File' select karein.", { parse_mode: 'Markdown', ...options });
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
            bot.answerCallbackQuery(query.id, { text: "❌ Aapne abhi tak channels join nahi kiye!", show_alert: true });
        }
        return;
    }

    if (data === 'main_menu') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        return sendMainMenu(chatId);
    }

    const isJoined = await checkForceJoin(chatId);
    if (!isJoined) {
        bot.answerCallbackQuery(query.id, { text: "⚠️ Pehle channels join karein!", show_alert: true });
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        return sendForceJoinMenu(chatId);
    }

    if (data === 'admin_panel') {
        if (chatId !== OWNER_ID) return bot.answerCallbackQuery(query.id, { text: "❌ Not Authorized!", show_alert: true });
        sendAdminPanel(chatId);
    } 
    else if (data === 'admin_stats') {
        if (chatId !== OWNER_ID) return;
        const totalUsers = await User.countDocuments();
        const totalCustom = await CustomNumber.find();
        let totalNumsCount = totalCustom.reduce((acc, curr) => acc + curr.numbers.length, 0);
        bot.sendMessage(chatId, `📊 *TEAM ZERO STATS*\n\n👥 Total Users: ${totalUsers}\n📱 Stored Custom Numbers: ${totalNumsCount}`, { parse_mode: 'Markdown' });
    } 
    else if (data === 'admin_broadcast') {
        if (chatId !== OWNER_ID) return;
        adminState[chatId] = { step: 'broadcast' };
        bot.sendMessage(chatId, "📢 *Broadcast Mode*\n\nApna message bhejein jo sab users ko jayega. (Cancel ke liye /cancel likhein)");
    }
    else if (data === 'admin_add_nums') {
        if (chatId !== OWNER_ID) return;
        adminState[chatId] = { step: 'select_service' };
        const kb = {
            inline_keyboard: [
                [{ text: 'WhatsApp', callback_data: 'adm_srv_whatsapp' }, { text: 'Instagram', callback_data: 'adm_srv_instagram' }],
                [{ text: 'Facebook', callback_data: 'adm_srv_facebook' }, { text: 'TikTok', callback_data: 'adm_srv_tiktok' }],
                [{ text: 'Telegram', callback_data: 'adm_srv_telegram' }, { text: 'Imo', callback_data: 'adm_srv_imo' }],
                [{ text: '🔙 Back', callback_data: 'admin_panel' }]
            ]
        };
        bot.sendMessage(chatId, "📌 *Step 1:* Service select karein jisme numbers add karne hain:", { parse_mode: 'Markdown', reply_markup: kb });
    }
    else if (data.startsWith('adm_srv_')) {
        if (chatId !== OWNER_ID) return;
        const sName = data.replace('adm_srv_', '');
        adminState[chatId] = { step: 'enter_country', service: sName };
        bot.sendMessage(chatId, `🌍 *Step 2:* Ab is service (*${sName.toUpperCase()}*) ke liye **Country Name** likh kar bhejein (Misal taur par: Pakistan, USA, India):`, { parse_mode: 'Markdown' });
    }
    else if (data.startsWith('srv_')) {
        const sName = data.replace('srv_', '');
        // Show available countries for this service
        const entries = await CustomNumber.find({ service: sName });
        if (entries.length === 0) {
            return bot.answerCallbackQuery(query.id, { text: `⚠️ Filhal ${sName.toUpperCase()} ke liye koi numbers available nahi hain.`, show_alert: true });
        }
        
        let kbButtons = entries.map(e => [{ text: `🌍 ${e.country} (${e.numbers.length} numbers)`, callback_data: `country_${sName}_${e.country}` }]);
        kbButtons.push([{ text: '🔙 Back', callback_data: 'main_menu' }]);

        bot.editMessageText(`📂 *${sName.toUpperCase()}* - Country select karein:`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: kbButtons }
        });
    }
    else if (data.startsWith('country_')) {
        const parts = data.split('_');
        const sName = parts[1];
        const cName = parts.slice(2).join('_');

        userSession[chatId] = { service: sName, country: cName };
        await sendBatchNumbers(chatId, sName, cName, query.message.message_id);
    }
    else if (data === 'next_batch') {
        const session = userSession[chatId];
        if (!session) return bot.answerCallbackQuery(query.id, { text: "Session expired. Start again.", show_alert: true });
        await sendBatchNumbers(chatId, session.service, session.country, query.message.message_id, true);
    }
    else if (data === 'change_country') {
        const session = userSession[chatId];
        if (!session) return sendMainMenu(chatId);
        // Trigger back to service countries view
        const entries = await CustomNumber.find({ service: session.service });
        let kbButtons = entries.map(e => [{ text: `🌍 ${e.country} (${e.numbers.length} numbers)`, callback_data: `country_${session.service}_${e.country}` }]);
        kbButtons.push([{ text: '🔙 Back', callback_data: 'main_menu' }]);

        bot.editMessageText(`📂 *${session.service.toUpperCase()}* - Doosri Country select karein:`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: kbButtons }
        });
    }

    try { bot.answerCallbackQuery(query.id); } catch(e) {}
});

// Function to send 5 numbers and delete them from DB (as requested: "1 dafaa ma 5 numbers aa jab Banda change number pa click Kara tu vo numbers delete ho jaa")
async function sendBatchNumbers(chatId, service, country, messageId, isEdit = false) {
    const record = await CustomNumber.findOne({ service, country });
    if (!record || record.numbers.length === 0) {
        const text = `⚠️ Is country (*${country}*) mein mazeed numbers available nahi hain.`;
        const kb = { inline_keyboard: [[{ text: '🔄 Change Country', callback_data: 'change_country' }, { text: '🏠 Main Menu', callback_data: 'main_menu' }]] };
        if (isEdit) {
            return bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: kb });
        } else {
            return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: kb });
        }
    }

    // Take first 5 numbers
    const batch = record.numbers.slice(0, 5);
    // Remove these 5 numbers from database permanently so they consume/delete upon request
    record.numbers = record.numbers.slice(5);
    await record.save();

    let text = `📱 *Service:* ${service.toUpperCase()}\n🌍 *Country:* ${country}\n\n*Aap ke 5 numbers ye hain:* (Inhe copy kar lein, yeh list se khatam ho chuke hain)\n\n`;
    batch.forEach((num, idx) => {
        text += `${idx + 1}️⃣ \`${num}\`\n`;
    });
    text += `\n_POWERED BY TEAM ZERO_`;

    const kb = {
        inline_keyboard: [
            [{ text: '🔄 Change Numbers (Next 5)', callback_data: 'next_batch' }],
            [{ text: '🌍 Change Country', callback_data: 'change_country' }, { text: '🏠 Main Menu', callback_data: 'main_menu' }]
        ]
    };

    if (isEdit) {
        bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: kb }).catch(() => {
            bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: kb });
        });
    } else {
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: kb });
    }
}

// --- FILE & TEXT MESSAGE LISTENER FOR ADMIN & BROADCAST ---
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const document = msg.document;

    if (!adminState[chatId]) return;
    const state = adminState[chatId];

    if (text === '/cancel') {
        delete adminState[chatId];
        return bot.sendMessage(chatId, "❌ Action cancelled.");
    }

    if (state.step === 'broadcast') {
        delete adminState[chatId];
        bot.sendMessage(chatId, "⏳ Broadcast shuru ho gaya hai...");
        const users = await User.find();
        let count = 0;
        for (let u of users) {
            try {
                await bot.sendMessage(u.chatId, `📢 *TEAM ZERO UPDATE*\n\n${text}`, { parse_mode: 'Markdown' });
                count++;
            } catch (e) {}
        }
        return bot.sendMessage(chatId, `✅ Broadcast complete! Sent to ${count} users.`);
    }

    if (state.step === 'enter_country') {
        if (!text) return bot.sendMessage(chatId, "❌ Baraye meharbani country name text mein bhejein.");
        state.country = text.trim();
        state.step = 'upload_file';
        return bot.sendMessage(chatId, `📁 *Step 3:* Ab ek text (.txt) file bhejein jisme har line par ek number ho (Country: *${state.country}*, Service: *${state.service.toUpperCase()}*).`, { parse_mode: 'Markdown' });
    }

    if (state.step === 'upload_file') {
        if (!document) {
            return bot.sendMessage(chatId, "❌ Baraye meharbani `.txt` file upload karein!");
        }

        try {
            const fileLink = await bot.getFileLink(document.file_id);
            const response = await axios.get(fileLink);
            const fileContent = response.data;

            // Parse numbers line by line
            const lines = fileContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 5);

            if (lines.length === 0) {
                return bot.sendMessage(chatId, "❌ File khali hai ya numbers sahi format mein nahi hain.");
            }

            // Save to database under CustomNumber
            let record = await CustomNumber.findOne({ service: state.service, country: state.country });
            if (record) {
                record.numbers.push(...lines);
                await record.save();
            } else {
                await CustomNumber.create({
                    service: state.service,
                    country: state.country,
                    numbers: lines
                });
            }

            delete adminState[chatId];
            bot.sendMessage(chatId, `✅ Kamyaabi se *${lines.length}* numbers service: *${state.service.toUpperCase()}* aur Country: *${state.country}* ke liye save ho gaye hain!`, { parse_mode: 'Markdown' });
            sendAdminPanel(chatId);
        } catch (e) {
            console.error("File upload error:", e.message);
            bot.sendMessage(chatId, "❌ File read karne mein error aa gaya. Dobara koshish karein.");
        }
    }
});

// --- HELPER FOR OTP EXTRACTION ---
function extractOtp(msgText) {
    const match = String(msgText).match(/\d{3}[-\s]?\d{3,4}|\d{4,8}/);
    return match ? match[0] : 'Unknown';
}

// --- REAL-TIME API POLLING (No Database Storage for OTPs, Only Live Real-Time Push) ---
async function pollOTPs() {
    try {
        const response = await axios.get(API_URL);
        const items = response.data;

        if (Array.isArray(items)) {
            // Initialization run: agar pehli dafa chal raha hai toh saare mojooda IDs ko seen mark kar do taake purane OTPs send na hon
            if (lastSeenOtpIds.size === 0) {
                items.forEach(item => {
                    const uid = String(item[3] || `${item[0]}_${item[1]}_${Date.now()}`);
                    lastSeenOtpIds.add(uid);
                });
                console.log(`📦 Initialized real-time memory pool with ${lastSeenOtpIds.size} items. No old OTPs will be sent.`);
                return;
            }

            // Process only real-time new items coming from API
            for (let item of items.reverse()) {
                const service = item[0] || 'Unknown';
                const phoneNumber = item[1] || 'Unknown';
                const messageText = item[2] || '';
                const uniqueId = String(item[3] || `${service}_${phoneNumber}_${Date.now()}`);

                if (!lastSeenOtpIds.has(uniqueId)) {
                    lastSeenOtpIds.add(uniqueId);

                    // Prevent memory leak by keeping size restricted
                    if (lastSeenOtpIds.size > 2000) {
                        const arr = Array.from(lastSeenOtpIds);
                        lastSeenOtpIds = new Set(arr.slice(-1000));
                    }

                    const otpCode = extractOtp(messageText);

                    // Requirement: "Jin numbers ka otp aa wo delete hota jaa Number bot sa" aur "Jin numbers ka number aa wo show nahi hona chahiya" (Masked completely or hidden/not shown as full raw number)
                    // Yahan full raw number group mein show nahi hoga, balki masked ya secure format mein jayega aur OTP forward hoga.
                    const text = `🔥 *TEAM ZERO OTP RECEIVED* 🔥\n\n🌐 Service: *${service.toUpperCase()}*\n💬 OTP Code: \`${otpCode}\`\n\n_POWERED BY TEAM ZERO_`;
                    
                    const markup = {
                        inline_keyboard: [
                            [{ text: `🔑 OTP: ${otpCode}`, callback_data: 'noop' }],
                            [
                                { text: "Methods", url: "https://whatsapp.com/channel/0029Vb7CHRO96H4QS1ynKI1J" },
                                { text: "Channel", url: "https://t.me/teamzerochanel" }
                            ],
                            [{ text: "OTP Panel", url: "https://t.me/teamzerootpforwardbot" }]
                        ]
                    };

                    await bot.sendMessage(GROUP_ID, text, { parse_mode: 'Markdown', reply_markup: markup });
                    console.log(`✅ Forwarded real-time OTP for ${service}`);
                }
            }
        }
    } catch (error) {
        console.error("Polling Error:", error.message);
    }
}

// Background poll interval to keep checking real-time API
setInterval(pollOTPs, POLL_INTERVAL);
