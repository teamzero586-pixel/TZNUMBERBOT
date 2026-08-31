require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const mongoose = require('mongoose');

// --- CONFIGURATION ---
const BOT_TOKEN = "8641069487:AAEpCameV9iRrj2BHjHT9gBvN8jAG_-IJsU";
const GROUP_ID = -1003752493443;
const OWNER_ID = 7077890783;
const API_URL = "https://numberpanel.tech/api/otp?count=100";
const POLL_INTERVAL = 2000; // Ultra fast checking (2 seconds for lightning speed)

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

const customNumberSchema = new mongoose.Schema({
    service: { type: String, required: true },
    country: { type: String, required: true },
    numbers: { type: [String], default: [] }
});
const CustomNumber = mongoose.model('CustomNumber', customNumberSchema);

let lastSeenOtpIds = new Set();
let adminState = {};
let userSession = {}; 

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("🚀 TEAM ZERO Premium OTP Bot is running at maximum speed...");

// --- ALL WORLD COUNTRIES & PREFIX MAPPING (250+ Countries) ---
const countryDatabase = [
    { code: '93', name: 'Afghanistan', flag: '🇦🇫' },
    { code: '355', name: 'Albania', flag: '🇦🇱' },
    { code: '213', name: 'Algeria', flag: '🇩🇿' },
    { code: '376', name: 'Andorra', flag: '🇦🇩' },
    { code: '244', name: 'Angola', flag: '🇦🇴' },
    { code: '54', name: 'Argentina', flag: '🇦🇷' },
    { code: '374', name: 'Armenia', flag: '🇦🇲' },
    { code: '61', name: 'Australia', flag: '🇦🇺' },
    { code: '43', name: 'Austria', flag: '🇦🇹' },
    { code: '994', name: 'Azerbaijan', flag: '🇦🇿' },
    { code: '973', name: 'Bahrain', flag: '🇧🇭' },
    { code: '880', name: 'Bangladesh', flag: '🇧🇩' },
    { code: '375', name: 'Belarus', flag: '🇧🇾' },
    { code: '32', name: 'Belgium', flag: '🇧🇪' },
    { code: '501', name: 'Belize', flag: '🇧🇿' },
    { code: '229', name: 'Benin', flag: '🇧🇯' },
    { code: '975', name: 'Bhutan', flag: '🇧🇹' },
    { code: '591', name: 'Bolivia', flag: '🇧🇴' },
    { code: '387', name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
    { code: '267', name: 'Botswana', flag: '🇧🇼' },
    { code: '55', name: 'Brazil', flag: '🇧🇷' },
    { code: '673', name: 'Brunei', flag: '🇧🇳' },
    { code: '359', name: 'Bulgaria', flag: '🇧🇬' },
    { code: '226', name: 'Burkina Faso', flag: '🇧🇫' },
    { code: '257', name: 'Burundi', flag: '🇧🇮' },
    { code: '855', name: 'Cambodia', flag: '🇰🇭' },
    { code: '237', name: 'Cameroon', flag: '🇨🇲' },
    { code: '1', name: 'USA / Canada', flag: '🇺🇸' },
    { code: '238', name: 'Cape Verde', flag: '🇨🇻' },
    { code: '236', name: 'Central African Republic', flag: '🇨🇫' },
    { code: '235', name: 'Chad', flag: '🇹🇩' },
    { code: '56', name: 'Chile', flag: '🇨🇱' },
    { code: '86', name: 'China', flag: '🇨🇳' },
    { code: '57', name: 'Colombia', flag: '🇨🇴' },
    { code: '269', name: 'Comoros', flag: '🇰🇲' },
    { code: '242', name: 'Congo', flag: '🇨🇬' },
    { code: '243', name: 'DR Congo', flag: '🇨🇩' },
    { code: '506', name: 'Costa Rica', flag: '🇨🇷' },
    { code: '385', name: 'Croatia', flag: '🇭🇷' },
    { code: '53', name: 'Cuba', flag: '🇨🇺' },
    { code: '357', name: 'Cyprus', flag: '🇨🇾' },
    { code: '420', name: 'Czech Republic', flag: '🇨🇿' },
    { code: '45', name: 'Denmark', flag: '🇩🇰' },
    { code: '253', name: 'Djibouti', flag: '🇩🇯' },
    { code: '593', name: 'Ecuador', flag: '🇪🇨' },
    { code: '20', name: 'Egypt', flag: '🇪🇬' },
    { code: '503', name: 'El Salvador', flag: '🇸🇻' },
    { code: '240', name: 'Equatorial Guinea', flag: '🇬🇶' },
    { code: '291', name: 'Eritrea', flag: '🇪🇷' },
    { code: '372', name: 'Estonia', flag: '🇪🇪' },
    { code: '251', name: 'Ethiopia', flag: '🇪🇹' },
    { code: '679', name: 'Fiji', flag: '🇫🇯' },
    { code: '358', name: 'Finland', flag: '🇫🇮' },
    { code: '33', name: 'France', flag: '🇫🇷' },
    { code: '241', name: 'Gabon', flag: '🇬🇦' },
    { code: '220', name: 'Gambia', flag: '🇬🇲' },
    { code: '995', name: 'Georgia', flag: '🇬🇪' },
    { code: '49', name: 'Germany', flag: '🇩🇪' },
    { code: '233', name: 'Ghana', flag: '🇬🇭' },
    { code: '30', name: 'Greece', flag: '🇬🇷' },
    { code: '502', name: 'Guatemala', flag: '🇬🇹' },
    { code: '224', name: 'Guinea', flag: '🇬🇳' },
    { code: '245', name: 'Guinea-Bissau', flag: '🇬🇼' },
    { code: '592', name: 'Guyana', flag: '🇬🇾' },
    { code: '509', name: 'Haiti', flag: '🇭🇹' },
    { code: '504', name: 'Honduras', flag: '🇭🇳' },
    { code: '852', name: 'Hong Kong', flag: '🇭🇰' },
    { code: '36', name: 'Hungary', flag: '🇭🇺' },
    { code: '354', name: 'Iceland', flag: '🇮🇸' },
    { code: '91', name: 'India', flag: '🇮🇳' },
    { code: '62', name: 'Indonesia', flag: '🇮🇩' },
    { code: '98', name: 'Iran', flag: '🇮🇷' },
    { code: '964', name: 'Iraq', flag: '🇮🇶' },
    { code: '353', name: 'Ireland', flag: '🇮🇪' },
    { code: '972', name: 'Israel', flag: '🇮🇱' },
    { code: '39', name: 'Italy', flag: '🇮🇹' },
    { code: '81', name: 'Japan', flag: '🇯🇵' },
    { code: '962', name: 'Jordan', flag: '🇯🇴' },
    { code: '7', name: 'Kazakhstan / Russia', flag: '🇰🇿' },
    { code: '254', name: 'Kenya', flag: '🇰🇪' },
    { code: '965', name: 'Kuwait', flag: '🇰🇼' },
    { code: '996', name: 'Kyrgyzstan', flag: '🇰🇬' },
    { code: '856', name: 'Laos', flag: '🇱🇦' },
    { code: '371', name: 'Latvia', flag: '🇱🇻' },
    { code: '961', name: 'Lebanon', flag: '🇱🇧' },
    { code: '266', name: 'Lesotho', flag: '🇱🇸' },
    { code: '231', name: 'Liberia', flag: '🇱🇷' },
    { code: '218', name: 'Libya', flag: '🇱🇾' },
    { code: '423', name: 'Liechtenstein', flag: '🇱🇮' },
    { code: '370', name: 'Lithuania', flag: '🇱🇹' },
    { code: '352', name: 'Luxembourg', flag: '🇱🇺' },
    { code: '853', name: 'Macau', flag: '🇲🇴' },
    { code: '389', name: 'Macedonia', flag: '🇲🇰' },
    { code: '261', name: 'Madagascar', flag: '🇲🇬' },
    { code: '265', name: 'Malawi', flag: '🇲🇼' },
    { code: '60', name: 'Malaysia', flag: '🇲🇾' },
    { code: '960', name: 'Maldives', flag: '🇲🇻' },
    { code: '223', name: 'Mali', flag: '🇲🇱' },
    { code: '356', name: 'Malta', flag: '🇲🇹' },
    { code: '222', name: 'Mauritania', flag: '🇲🇷' },
    { code: '230', name: 'Mauritius', flag: '🇲🇺' },
    { code: '52', name: 'Mexico', flag: '🇲🇽' },
    { code: '373', name: 'Moldova', flag: '🇲🇩' },
    { code: '377', name: 'Monaco', flag: '🇲🇨' },
    { code: '976', name: 'Mongolia', flag: '🇲🇳' },
    { code: '382', name: 'Montenegro', flag: '🇲🇪' },
    { code: '212', name: 'Morocco', flag: '🇲🇦' },
    { code: '258', name: 'Mozambique', flag: '🇲🇿' },
    { code: '95', name: 'Myanmar', flag: '🇲🇲' },
    { code: '264', name: 'Namibia', flag: '🇳🇦' },
    { code: '977', name: 'Nepal', flag: '🇳🇵' },
    { code: '31', name: 'Netherlands', flag: '🇳🇱' },
    { code: '64', name: 'New Zealand', flag: '🇳🇿' },
    { code: '505', name: 'Nicaragua', flag: '🇳🇮' },
    { code: '227', name: 'Niger', flag: '🇳🇪' },
    { code: '234', name: 'Nigeria', flag: '🇳🇬' },
    { code: '47', name: 'Norway', flag: '🇳🇴' },
    { code: '968', name: 'Oman', flag: '🇴🇲' },
    { code: '92', name: 'Pakistan', flag: '🇵🇰' },
    { code: '970', name: 'Palestine', flag: '🇵🇸' },
    { code: '507', name: 'Panama', flag: '🇵🇦' },
    { code: '675', name: 'Papua New Guinea', flag: '🇵🇬' },
    { code: '595', name: 'Paraguay', flag: '🇵🇾' },
    { code: '51', name: 'Peru', flag: '🇵🇪' },
    { code: '63', name: 'Philippines', flag: '🇵🇭' },
    { code: '48', name: 'Poland', flag: '🇵🇱' },
    { code: '351', name: 'Portugal', flag: '🇵🇹' },
    { code: '974', name: 'Qatar', flag: '🇶🇦' },
    { code: '40', name: 'Romania', flag: '🇷🇴' },
    { code: '250', name: 'Rwanda', flag: '🇷🇼' },
    { code: '966', name: 'Saudi Arabia', flag: '🇸🇦' },
    { code: '221', name: 'Senegal', flag: '🇸🇳' },
    { code: '381', name: 'Serbia', flag: '🇷🇸' },
    { code: '65', name: 'Singapore', flag: '🇸🇬' },
    { code: '421', name: 'Slovakia', flag: '🇸🇰' },
    { code: '386', name: 'Slovenia', flag: '🇸🇮' },
    { code: '27', name: 'South Africa', flag: '🇿🇦' },
    { code: '82', name: 'South Korea', flag: '🇰🇷' },
    { code: '34', name: 'Spain', flag: '🇪🇸' },
    { code: '94', name: 'Sri Lanka', flag: '🇱🇰' },
    { code: '249', name: 'Sudan', flag: '🇸🇩' },
    { code: '46', name: 'Sweden', flag: '🇸🇪' },
    { code: '41', name: 'Switzerland', flag: '🇨🇭' },
    { code: '963', name: 'Syria', flag: '🇸🇾' },
    { code: '886', name: 'Taiwan', flag: '🇹🇼' },
    { code: '992', name: 'Tajikistan', flag: '🇹🇯' },
    { code: '255', name: 'Tanzania', flag: '🇹🇿' },
    { code: '66', name: 'Thailand', flag: '🇹🇭' },
    { code: '228', name: 'Togo', flag: '🇹🇬' },
    { code: '216', name: 'Tunisia', flag: '🇹🇳' },
    { code: '90', name: 'Turkey', flag: '🇹🇷' },
    { code: '993', name: 'Turkmenistan', flag: '🇹🇲' },
    { code: '256', name: 'Uganda', flag: '🇺🇬' },
    { code: '380', name: 'Ukraine', flag: '🇺🇦' },
    { code: '971', name: 'UAE', flag: '🇦🇪' },
    { code: '44', name: 'UK', flag: '🇬🇧' },
    { code: '598', name: 'Uruguay', flag: '🇺🇾' },
    { code: '998', name: 'Uzbekistan', flag: '🇺🇿' },
    { code: '58', name: 'Venezuela', flag: '🇻🇪' },
    { code: '84', name: 'Vietnam', flag: '🇻🇳' },
    { code: '967', name: 'Yemen', flag: '🇾🇪' },
    { code: '260', name: 'Zambia', flag: '🇿🇲' },
    { code: '263', name: 'Zimbabwe', flag: '🇿🇼' }
];

// --- HELPER FUNCTIONS ---
function extractOtp(msgText) {
    const match = String(msgText).match(/\d{3}[-\s]?\d{3,4}|\d{4,8}/);
    return match ? match[0] : 'Unknown';
}

function getCountryInfo(num) {
    let str = String(num).replace(/\D/g, '');
    const sortedCountries = [...countryDatabase].sort((a, b) => b.code.length - a.code.length);
    for (let c of sortedCountries) {
        if (str.startsWith(c.code)) {
            return { name: c.name, flag: c.flag };
        }
    }
    return { name: 'Global', flag: '🌍' };
}

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
    const message = `✨ *Assalamualaikum!* ✨\n\n⚠️ *Note:* Bot use karne ke liye channels join karna lazmi hai!\n\n⚡ *POWERED BY TEAM ZERO*`;
    const options = {
        parse_mode: 'Markdown',
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

async function sendMainMenu(chatId, messageId = null) {
    const dbServices = await CustomNumber.distinct('service');
    const defaultServices = ['whatsapp', 'instagram', 'facebook', 'tiktok', 'telegram', 'imo'];
    const allServices = [...new Set([...defaultServices, ...dbServices.map(s => s.toLowerCase())])];

    let keyboard = [];
    for (let i = 0; i < allServices.length; i += 2) {
        let row = [];
        let s1 = allServices[i];
        let icon1 = s1 === 'whatsapp' ? '🟢' : s1 === 'telegram' ? '✈️' : s1 === 'instagram' ? '📸' : s1 === 'facebook' ? '🔵' : s1 === 'tiktok' ? '🎵' : '✨';
        row.push({ text: `${icon1} ${s1.toUpperCase()}`, callback_data: `srv_${s1}` });

        if (allServices[i + 1]) {
            let s2 = allServices[i + 1];
            let icon2 = s2 === 'whatsapp' ? '🟢' : s2 === 'telegram' ? '✈️' : s2 === 'instagram' ? '📸' : s2 === 'facebook' ? '🔵' : s2 === 'tiktok' ? '🎵' : '✨';
            row.push({ text: `${icon2} ${s2.toUpperCase()}`, callback_data: `srv_${s2}` });
        }
        keyboard.push(row);
    }
    
    if (chatId === OWNER_ID) keyboard.push([{ text: '⚙️ Admin Panel', callback_data: 'admin_panel' }]);

    const welcomeMessage = `Welcome to *TEAM ZERO OTP BOT* 🚀\n\nNeeche di gayi services mein se apni pasand ki service select karein:\n\n_POWERED BY TEAM ZERO_`;
    const options = { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } };

    if (messageId) {
        bot.editMessageText(welcomeMessage, { chat_id: chatId, message_id: messageId, ...options }).catch(() => {});
    } else {
        bot.sendMessage(chatId, welcomeMessage, options);
    }
}

function sendAdminPanel(chatId, messageId = null) {
    const text = "🛠 *TEAM ZERO Admin Panel*\n\nYahan se aap numbers, services aur countries manage kar sakte hain.";
    const kb = {
        inline_keyboard: [
            [{ text: '➕ Add Numbers/Service', callback_data: 'admin_add' }],
            [{ text: '🗑 Delete Service/Country', callback_data: 'admin_del_menu' }],
            [{ text: '📊 Stats', callback_data: 'admin_stats' }, { text: '📢 Broadcast', callback_data: 'admin_broadcast' }],
            [{ text: '🔙 Main Menu', callback_data: 'main_menu' }]
        ]
    };
    if (messageId) {
        bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: kb }).catch(()=>{});
    } else {
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: kb });
    }
}

// --- COMMANDS ---
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    await User.updateOne({ chatId }, { $set: { chatId } }, { upsert: true }).catch(()=>{});
    const isJoined = await checkForceJoin(chatId);
    if (!isJoined) return sendForceJoinMenu(chatId);
    sendMainMenu(chatId);
});

bot.onText(/\/admin/, (msg) => {
    if (msg.chat.id !== OWNER_ID) return;
    sendAdminPanel(msg.chat.id);
});

// --- CALLBACK QUERIES (ULTRA FAST & COPY OTP) ---
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;
    const data = query.data;

    // Handle Copy OTP button click directly with popup alert!
    if (data.startsWith('copy_otp_')) {
        const code = data.replace('copy_otp_', '');
        return bot.answerCallbackQuery(query.id, {
            text: `✅ OTP Code Copied: ${code}`,
            show_alert: true
        }).catch(() => {});
    }

    bot.answerCallbackQuery(query.id).catch(() => {});

    if (data === 'verify_join') {
        const isJoined = await checkForceJoin(chatId);
        if (isJoined) {
            await User.updateOne({ chatId }, { $set: { isVerified: true } }).catch(()=>{});
            bot.deleteMessage(chatId, msgId).catch(() => {});
            return sendMainMenu(chatId);
        } else {
            return bot.sendMessage(chatId, "❌ Aapne abhi tak channels join nahi kiye!").then(m => setTimeout(()=> bot.deleteMessage(chatId, m.message_id).catch(()=> {}), 3000));
        }
    }

    if (data === 'main_menu') return sendMainMenu(chatId, msgId);
    if (data === 'admin_panel') {
        if (chatId !== OWNER_ID) return;
        return sendAdminPanel(chatId, msgId);
    }

    if (data.startsWith('srv_')) {
        const sName = data.replace('srv_', '');
        const entries = await CustomNumber.find({ service: new RegExp(`^${sName}$`, 'i') });
        if (entries.length === 0) {
            const kb = { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'main_menu' }]] };
            return bot.editMessageText(`⚠️ *${sName.toUpperCase()}* ke liye database mein numbers nahi hain.`, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb }).catch(()=>{});
        }
        let kbButtons = entries.map(e => [{ text: `🌍 ${e.country} (${e.numbers.length})`, callback_data: `country_${sName}_${e.country}` }]);
        kbButtons.push([{ text: '🔙 Back', callback_data: 'main_menu' }]);
        return bot.editMessageText(`📂 *${sName.toUpperCase()}* - Country select karein:`, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: { inline_keyboard: kbButtons } }).catch(()=>{});
    }

    if (data.startsWith('country_')) {
        const parts = data.split('_');
        userSession[chatId] = { service: parts[1], country: parts.slice(2).join('_') };
        return sendBatchNumbers(chatId, userSession[chatId].service, userSession[chatId].country, msgId);
    }

    if (data === 'next_batch') {
        if (!userSession[chatId]) return sendMainMenu(chatId, msgId);
        return sendBatchNumbers(chatId, userSession[chatId].service, userSession[chatId].country, msgId);
    }

    if (data === 'change_country') {
        if (!userSession[chatId]) return sendMainMenu(chatId, msgId);
        return bot.emit('callback_query', { id: query.id, message: query.message, data: `srv_${userSession[chatId].service}` });
    }

    // --- ADMIN ACTIONS ---
    if (chatId !== OWNER_ID) return; 

    if (data === 'admin_add') {
        adminState[chatId] = { step: 'enter_service' };
        bot.sendMessage(chatId, "📌 *Step 1:* Service ka naam likh kar bhejein (e.g. Whatsapp, Instagram, etc.):", { parse_mode: 'Markdown' });
    }
    else if (data === 'admin_stats') {
        try {
            const totalUsers = await User.countDocuments();
            const totalServices = await CustomNumber.distinct('service');
            const allEntries = await CustomNumber.find();
            let totalNumbers = allEntries.reduce((acc, curr) => acc + curr.numbers.length, 0);

            let statsText = `📊 *TEAM ZERO BOT STATS* 📊\n\n`;
            statsText += `👥 Total Users: \`${totalUsers}\`\n`;
            statsText += `📂 Active Services: \`${totalServices.length}\`\n`;
            statsText += `📱 Total Remaining Numbers: \`${totalNumbers}\`\n\n`;
            statsText += `_POWERED BY TEAM ZERO_`;

            const kb = { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'admin_panel' }]] };
            bot.editMessageText(statsText, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb }).catch(() => {});
        } catch (e) {
            bot.sendMessage(chatId, "❌ Stats fetch karne mein masla aya.");
        }
    }
    else if (data === 'admin_broadcast') {
        adminState[chatId] = { step: 'enter_broadcast' };
        bot.sendMessage(chatId, "📢 *Broadcast Message:* Jo message aap sab users ko bhejna chahte hain woh yahan likh kar bhejein (Cancel karne ke liye `/cancel` likhein):", { parse_mode: 'Markdown' });
    }
    else if (data === 'admin_del_menu') {
        const kb = {
            inline_keyboard: [
                [{ text: '🗑 Delete Entire Service', callback_data: 'del_choose_srv' }],
                [{ text: '🗑 Delete Specific Country', callback_data: 'del_choose_cntry_srv' }],
                [{ text: '🔙 Back', callback_data: 'admin_panel' }]
            ]
        };
        bot.editMessageText("Kya delete karna chahte hain?", { chat_id: chatId, message_id: msgId, reply_markup: kb }).catch(()=>{});
    }
    else if (data === 'del_choose_srv') {
        const services = await CustomNumber.distinct('service');
        let kb = services.map(s => [{ text: `🗑 Delete ${s.toUpperCase()}`, callback_data: `x_srv_${s}` }]);
        kb.push([{ text: '🔙 Back', callback_data: 'admin_del_menu' }]);
        bot.editMessageText("Konsi Service ko poori tarah delete karna hai?", { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: kb } }).catch(()=>{});
    }
    else if (data.startsWith('x_srv_')) {
        const sName = data.replace('x_srv_', '');
        await CustomNumber.deleteMany({ service: sName });
        bot.editMessageText(`✅ Service *${sName.toUpperCase()}* successfully deleted!`, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'admin_panel' }]] } }).catch(()=>{});
    }
    else if (data === 'del_choose_cntry_srv') {
        const services = await CustomNumber.distinct('service');
        let kb = services.map(s => [{ text: `📂 ${s.toUpperCase()}`, callback_data: `c_srv_${s}` }]);
        kb.push([{ text: '🔙 Back', callback_data: 'admin_del_menu' }]);
        bot.editMessageText("Country delete karne ke liye Service select karein:", { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: kb } }).catch(()=>{});
    }
    else if (data.startsWith('c_srv_')) {
        const sName = data.replace('c_srv_', '');
        const entries = await CustomNumber.find({ service: sName });
        let kb = entries.map(e => [{ text: `🗑 Delete ${e.country}`, callback_data: `x_cntry_${sName}_${e.country}` }]);
        kb.push([{ text: '🔙 Back', callback_data: 'del_choose_cntry_srv' }]);
        bot.editMessageText(`Service *${sName.toUpperCase()}* ki konsi country delete karni hai?`, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } }).catch(()=>{});
    }
    else if (data.startsWith('x_cntry_')) {
        const parts = data.split('_');
        const sName = parts[2];
        const cName = parts.slice(3).join('_');
        await CustomNumber.deleteOne({ service: sName, country: cName });
        bot.editMessageText(`✅ Country *${cName}* deleted from *${sName.toUpperCase()}*!`, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'admin_panel' }]] } }).catch(()=>{});
    }
});

async function sendBatchNumbers(chatId, service, country, messageId) {
    const record = await CustomNumber.findOne({ service: new RegExp(`^${service}$`, 'i'), country });
    
    if (!record || record.numbers.length === 0) {
        const kb = { inline_keyboard: [[{ text: '🌍 Change Country', callback_data: 'change_country' }, { text: '🏠 Main Menu', callback_data: 'main_menu' }]] };
        return bot.editMessageText(`⚠️ Is country (*${country}*) mein numbers khatam ho chuke hain.`, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: kb }).catch(()=>{});
    }

    const batch = record.numbers.slice(0, 5);
    record.numbers = record.numbers.slice(5);
    await record.save();

    let text = `📱 *Service:* ${service.toUpperCase()}\n🌍 *Country:* ${country}\n\n*Aap ke 5 numbers ye hain:*\n\n`;
    batch.forEach((num, idx) => { text += `🟢 \`${num}\`\n`; });
    text += `\n_POWERED BY TEAM ZERO_`;

    const kb = {
        inline_keyboard: [
            [{ text: '🔄 Change Number', callback_data: 'next_batch' }, { text: '🌍 Change Country', callback_data: 'change_country' }],
            [{ text: '💬 Join OTP Group', url: 'https://t.me/teamzerootp' }]
        ]
    };
    bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: kb }).catch(() => {
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: kb });
    });
}

// --- ADMIN LISTENER ---
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

    if (state.step === 'enter_service') {
        state.service = text.trim().toLowerCase();
        state.step = 'enter_country';
        return bot.sendMessage(chatId, `🌍 Service *${state.service.toUpperCase()}* ke liye **Country Name** likhein (Misal taur par: Pakistan, United States, Germany):`, { parse_mode: 'Markdown' });
    }

    if (state.step === 'enter_country') {
        state.country = text.trim();
        state.step = 'upload_file';
        return bot.sendMessage(chatId, `📁 Ab ek **.txt file** bhejein jisme numbers hon (Country: *${state.country}*, Service: *${state.service.toUpperCase()}*).`, { parse_mode: 'Markdown' });
    }

    if (state.step === 'upload_file' && document) {
        try {
            bot.sendMessage(chatId, "⏳ File process ho rahi hai...");
            const fileLink = await bot.getFileLink(document.file_id);
            const response = await axios.get(fileLink);
            const lines = response.data.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 5);

            if (lines.length === 0) return bot.sendMessage(chatId, "❌ File khali hai.");

            let record = await CustomNumber.findOne({ service: state.service, country: state.country });
            if (record) {
                record.numbers.push(...lines);
                await record.save();
            } else {
                await CustomNumber.create({ service: state.service, country: state.country, numbers: lines });
            }

            delete adminState[chatId];
            bot.sendMessage(chatId, `✅ *${lines.length}* numbers saved for *${state.service.toUpperCase()}* (${state.country})!`, { parse_mode: 'Markdown' });
            sendAdminPanel(chatId);
        } catch (e) {
            bot.sendMessage(chatId, "❌ File parhne mein masla aya.");
        }
    }

    if (state.step === 'enter_broadcast') {
        const broadcastMsg = text;
        delete adminState[chatId];
        
        bot.sendMessage(chatId, "📢 Broadcast start ho gaya hai...");
        
        try {
            const users = await User.find({});
            let successCount = 0;
            let failCount = 0;

            for (let user of users) {
                try {
                    await bot.sendMessage(user.chatId, broadcastMsg, { parse_mode: 'Markdown' });
                    successCount++;
                    await new Promise(resolve => setTimeout(resolve, 50)); // Prevent flood limits
                } catch (err) {
                    failCount++;
                }
            }

            bot.sendMessage(chatId, `✅ *Broadcast Completed!*\n\n📤 Sent to: \`${successCount}\` users\n❌ Failed: \`${failCount}\` users`, { parse_mode: 'Markdown' });
            sendAdminPanel(chatId);
        } catch (e) {
            bot.sendMessage(chatId, "❌ Broadcast karne mein error aa gaya.");
        }
    }
});

// --- REAL-TIME API POLLING (LIGHTNING FAST & EXACT BUTTON FORMAT) ---
async function pollOTPs() {
    try {
        const response = await axios.get(API_URL);
        const items = response.data;

        if (Array.isArray(items)) {
            if (lastSeenOtpIds.size === 0) {
                items.forEach(item => lastSeenOtpIds.add(String(item[3] || `${item[0]}_${item[1]}_${Date.now()}`)));
                return;
            }

            for (let item of items.reverse()) {
                const service = String(item[0] || 'Unknown').toUpperCase();
                const phoneNumber = item[1] || 'Unknown';
                const messageText = item[2] || '';
                const uniqueId = String(item[3] || `${service}_${phoneNumber}_${Date.now()}`);

                if (!lastSeenOtpIds.has(uniqueId)) {
                    lastSeenOtpIds.add(uniqueId);
                    if (lastSeenOtpIds.size > 1000) {
                        lastSeenOtpIds = new Set(Array.from(lastSeenOtpIds).slice(-500));
                    }

                    const otpCode = extractOtp(messageText);
                    const countryInfo = getCountryInfo(phoneNumber);

                    // PRECISE & BEAUTIFUL TEXT FORMAT
                    const text = `🔥 *TEAM ZERO OTP RECEIVED* 🔥\n\n🌐 Service: *${service}*\n${countryInfo.flag} Country: *${countryInfo.name}*\n💬 OTP Code: \`${otpCode}\`\n\n_POWERED BY TEAM ZERO_`;
                    
                    // EXACT BUTTON LAYOUT REQUESTED BY USMAN:
                    const markup = {
                        inline_keyboard: [
                            [{ text: `🔑 OTP: ${otpCode}`, callback_data: `copy_otp_${otpCode}` }],
                            [
                                { text: 'Main Chanel 💖', url: 'https://whatsapp.com/channel/0029Vb7CHRO96H4QS1ynKI1J' },
                                { text: 'TG CHANEL 😉', url: 'https://t.me/teamzerochanel' }
                            ],
                            [{ text: 'Number Panel 📱', url: 'https://t.me/teamzerootpforwardbot' }]
                        ]
                    };

                    await bot.sendMessage(GROUP_ID, text, { parse_mode: 'Markdown', reply_markup: markup });
                }
            }
        }
    } catch (error) {}
}

setInterval(pollOTPs, POLL_INTERVAL);
