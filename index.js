require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const mongoose = require('mongoose');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN || "8641069487:AAEpCameV9iRrj2BHjHT9gBvN8jAG_-IJsU";
const GROUP_ID = -1003752493443;
const OWNER_ID = 7077890783;
const API_BASE_URL = "https://numberpanel.tech/api";
const API_KEY = process.env.API_KEY || "np_live_yltQxyzf5AruC7F-jTYZS82NTse7hq2VwXMVVrM-4vs";
const POLL_INTERVAL = 2000;

// MongoDB URI
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://kojiv58207_db_user:9QRspjWGLwqIdVVt@tznumberbot.jsrs9mx.mongodb.net/tznumberbot?retryWrites=true&w=majority&appName=TZNUMBERBOT';

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
console.log("🚀 TEAM ZERO Premium Automated OTP Bot is running at maximum speed...");

// --- ALL WORLD COUNTRIES & PREFIX MAPPING ---
const countryDatabase = [
    { code: '93', name: 'Afghanistan', flag: '🇦🇫' },
    { code: '355', name: 'Albania', flag: '🇦🇱' },
    { code: '213', name: 'Algeria', flag: '🇩🇿' },
    { code: '54', name: 'Argentina', flag: '🇦🇷' },
    { code: '61', name: 'Australia', flag: '🇦🇺' },
    { code: '43', name: 'Austria', flag: '🇦🇹' },
    { code: '880', name: 'Bangladesh', flag: '🇧🇩' },
    { code: '32', name: 'Belgium', flag: '🇧🇪' },
    { code: '55', name: 'Brazil', flag: '🇧🇷' },
    { code: '1', name: 'USA / Canada', flag: '🇺🇸' },
    { code: '86', name: 'China', flag: '🇨🇳' },
    { code: '57', name: 'Colombia', flag: '🇨🇴' },
    { code: '225', name: 'Côte d\'Ivoire', flag: '🇨🇮' },
    { code: '20', name: 'Egypt', flag: '🇪🇬' },
    { code: '33', name: 'France', flag: '🇫🇷' },
    { code: '49', name: 'Germany', flag: '🇩🇪' },
    { code: '91', name: 'India', flag: '🇮🇳' },
    { code: '62', name: 'Indonesia', flag: '🇮🇩' },
    { code: '98', name: 'Iran', flag: '🇮🇷' },
    { code: '964', name: 'Iraq', flag: '🇮🇶' },
    { code: '39', name: 'Italy', flag: '🇮🇹' },
    { code: '81', name: 'Japan', flag: '🇯🇵' },
    { code: '7', name: 'Kazakhstan / Russia', flag: '🇷🇺' },
    { code: '254', name: 'Kenya', flag: '🇰🇪' },
    { code: '856', name: 'Laos', flag: '🇱🇦' },
    { code: '60', name: 'Malaysia', flag: '🇲🇾' },
    { code: '960', name: 'Maldives', flag: '🇲🇻' },
    { code: '52', name: 'Mexico', flag: '🇲🇽' },
    { code: '212', name: 'Morocco', flag: '🇲🇦' },
    { code: '95', name: 'Myanmar', flag: '🇲🇲' },
    { code: '977', name: 'Nepal', flag: '🇳🇵' },
    { code: '31', name: 'Netherlands', flag: '🇳🇱' },
    { code: '234', name: 'Nigeria', flag: '🇳🇬' },
    { code: '92', name: 'Pakistan', flag: '🇵🇰' },
    { code: '63', name: 'Philippines', flag: '🇵🇭' },
    { code: '48', name: 'Poland', flag: '🇵🇱' },
    { code: '351', name: 'Portugal', flag: '🇵🇹' },
    { code: '966', name: 'Saudi Arabia', flag: '🇸🇦' },
    { code: '27', name: 'South Africa', flag: '🇿🇦' },
    { code: '82', name: 'South Korea', flag: '🇰🇷' },
    { code: '34', name: 'Spain', flag: '🇪🇸' },
    { code: '94', name: 'Sri Lanka', flag: '🇱🇰' },
    { code: '46', name: 'Sweden', flag: '🇸🇪' },
    { code: '41', name: 'Switzerland', flag: '🇨🇭' },
    { code: '66', name: 'Thailand', flag: '🇹🇭' },
    { code: '228', name: 'Togo', flag: '🇹🇬' },
    { code: '90', name: 'Turkey', flag: '🇹🇷' },
    { code: '971', name: 'UAE', flag: '🇦🇪' },
    { code: '44', name: 'UK', flag: '🇬🇧' },
    { code: '380', name: 'Ukraine', flag: '🇺🇦' },
    { code: '84', name: 'Vietnam', flag: '🇻🇳' }
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

function getCountryFlagByName(countryName) {
    if (!countryName) return '🌍';
    const search = countryName.toLowerCase().trim();
    
    if (search === 'usa' || search === 'united states' || search === 'us') return '🇺🇸';
    if (search === 'uk' || search === 'united kingdom' || search === 'england') return '🇬🇧';
    if (search === 'russia' || search === 'russian federation') return '🇷🇺';
    if (search === "côte d'ivoire" || search === "ivory coast") return '🇨🇮';
    if (search === 'uae' || search === 'united arab emirates') return '🇦🇪';

    const found = countryDatabase.find(c => c.name.toLowerCase() === search);
    return found ? found.flag : '🌍';
}

function normalizeServiceName(s) {
    if (!s) return 'WhatsApp';
    const str = String(s).toLowerCase();
    if (str === 'whatsapp') return 'WhatsApp';
    if (str === 'telegram') return 'Telegram';
    if (str === 'instagram') return 'Instagram';
    if (str === 'facebook') return 'Facebook';
    if (str === 'tiktok') return 'TikTok';
    if (str === 'imo') return 'Imo';
    return s.charAt(0).toUpperCase() + s.slice(1);
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

// --- AUTOMATED API FUNCTIONS FOR NUMBERPANEL.TECH ---
async function fetchApiServices() {
    try {
        const res = await axios.get(`${API_BASE_URL}/services`, { timeout: 5000 });
        if (res.data && res.data.success && Array.isArray(res.data.services)) {
            return res.data.services.map(s => typeof s === 'object' ? s.name : s);
        }
    } catch (err) {
        console.error("API Services Error:", err.message);
    }
    return ['whatsapp', 'telegram', 'instagram', 'facebook', 'tiktok', 'imo'];
}

async function fetchApiCountries(serviceName) {
    try {
        const normService = normalizeServiceName(serviceName);
        const res = await axios.get(`${API_BASE_URL}/countries`, {
            params: { service: normService },
            timeout: 5000
        });
        
        if (res.data) {
            if (res.data.success && Array.isArray(res.data.countries)) {
                return res.data.countries; 
            } else if (res.data.countries && typeof res.data.countries === 'object') {
                return Object.keys(res.data.countries).map(k => ({ name: k, count: res.data.countries[k] }));
            } else if (Array.isArray(res.data)) {
                return res.data;
            }
        }
    } catch (err) {
        console.error("API Countries Error:", err.message);
    }
    return [];
}

async function requestApiNumber(service, country) {
    try {
        const normService = normalizeServiceName(service);
        const res = await axios.post(`${API_BASE_URL}/request_number`, 
            { service: normService, country: country },
            {
                headers: { 
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 8000
            }
        );
        
        if (res.data) {
            if (res.data.success && (res.data.number || res.data.phone)) {
                return res.data.number || res.data.phone;
            }
            if (res.data.number) return res.data.number;
            if (res.data.phone) return res.data.phone;
        }
    } catch (err) {
        console.error(`API Request Error (${service} - ${country}):`, err.response ? err.response.data : err.message);
    }
    return null;
}

// --- LIVE TRAFFIC FETCH FUNCTION WITH SERVICES & COUNTRIES ---
async function getLiveTrafficText() {
    try {
        const statsRes = await axios.get(`${API_BASE_URL}/stats/detailed?period=daily`, { timeout: 5000 }).catch(() => null);
        const otpRes = await axios.get(`${API_BASE_URL}/otp?count=100`, { timeout: 5000 }).catch(() => null);

        let text = `🔥 *TEAM ZERO REAL-TIME LIVE TRAFFIC & STATS* 🔥\n\n`;

        if (statsRes && statsRes.data) {
            const d = statsRes.data;
            text += `⚡ *Total Numbers Available:* \`${d.available_numbers || '5000+'}\`\n`;
            text += `📩 *Total OTPs Received Today:* \`${d.otp_count || '1000+'}\`\n`;
            text += `🌍 *Active Countries:* \`${d.countries_count || '50+'}\`\n`;
            text += `📂 *Active Services:* \`${d.services_count || '20+'}\`\n\n`;
        }

        if (otpRes && Array.isArray(otpRes.data) && otpRes.data.length > 0) {
            const serviceCounts = {};
            const countryCounts = {};

            otpRes.data.forEach(item => {
                // Service analysis
                const srv = String(item[0] || 'Unknown').toUpperCase();
                serviceCounts[srv] = (serviceCounts[srv] || 0) + 1;

                // Country analysis from phone number
                const phoneNum = item[1] || '';
                if (phoneNum) {
                    const cInfo = getCountryInfo(phoneNum);
                    const cKey = `${cInfo.flag} ${cInfo.name}`;
                    countryCounts[cKey] = (countryCounts[cKey] || 0) + 1;
                }
            });

            // 1. Highest Traffic Services
            text += `🚀 *Highest Traffic Services Right Now:*\n`;
            const sortedServices = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]);
            sortedServices.slice(0, 5).forEach(([srv, count], index) => {
                text += `${index + 1}. *${srv}* — ${count} Recent OTPs\n`;
            });

            // 2. Highest Traffic Countries (ADD NEW)
            text += `\n🌍 *Highest Traffic Countries Right Now:*\n`;
            const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);
            sortedCountries.slice(0, 5).forEach(([cName, count], index) => {
                text += `${index + 1}. *${cName}* — ${count} Recent OTPs\n`;
            });

            text += `\n💡 *Tip:* Select high-traffic services & countries above for instant OTP delivery!`;
        } else {
            text += `🟢 *Top Traffic Services:* WHATSAPP, TELEGRAM, INSTAGRAM, TIKTOK\n`;
            text += `🌍 *Top Traffic Countries:* TOGO, INDONESIA, PAKISTAN, LAOS`;
        }

        text += `\n\n_POWERED BY TEAM ZERO_`;
        return text;
    } catch (err) {
        return `❌ Traffic stats load karne mein masla aaya. Retrying...`;
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
    const apiServices = await fetchApiServices();
    const dbServices = await CustomNumber.distinct('service');
    const defaultServices = ['whatsapp', 'telegram', 'instagram', 'facebook', 'tiktok', 'imo'];
    
    const combined = [...new Set([...defaultServices, ...apiServices.map(s => String(s).toLowerCase()), ...dbServices.map(s => String(s).toLowerCase())])];

    let keyboard = [];
    for (let i = 0; i < combined.length; i += 2) {
        let row = [];
        let s1 = combined[i];
        let icon1 = s1 === 'whatsapp' ? '🟢' : s1 === 'telegram' ? '✈️' : s1 === 'instagram' ? '📸' : s1 === 'facebook' ? '🔵' : s1 === 'tiktok' ? '🎵' : '✨';
        row.push({ text: `${icon1} ${s1.toUpperCase()}`, callback_data: `srv|${s1}` });

        if (combined[i + 1]) {
            let s2 = combined[i + 1];
            let icon2 = s2 === 'whatsapp' ? '🟢' : s2 === 'telegram' ? '✈️' : s2 === 'instagram' ? '📸' : s2 === 'facebook' ? '🔵' : s2 === 'tiktok' ? '🎵' : '✨';
            row.push({ text: `${icon2} ${s2.toUpperCase()}`, callback_data: `srv|${s2}` });
        }
        keyboard.push(row);
    }
    
    keyboard.push([{ text: '🔥 Live Traffic & High Success Rates', callback_data: 'live_traffic' }]);

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
    const text = "🛠 *TEAM ZERO Admin Panel*\n\nYahan se aap manual numbers add, delete aur broadcast manage kar sakte hain.";
    const kb = {
        inline_keyboard: [
            [{ text: '➕ Add Manual Numbers/Service', callback_data: 'admin_add' }],
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

// --- CALLBACK QUERIES ---
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;
    const data = query.data;

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
    
    if (data === 'live_traffic') {
        bot.editMessageText(`⏳ Fetching real-time traffic statistics...`, { chat_id: chatId, message_id: msgId }).catch(()=>{});
        const trafficText = await getLiveTrafficText();
        const kb = { inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'main_menu' }]] };
        return bot.editMessageText(trafficText, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb }).catch(()=>{});
    }

    if (data === 'admin_panel') {
        if (chatId !== OWNER_ID) return;
        return sendAdminPanel(chatId, msgId);
    }

    // SERVICE SELECTION HANDLER
    if (data.startsWith('srv|') || data.startsWith('srv_')) {
        const sName = data.includes('|') ? data.split('|')[1] : data.replace('srv_', '');
        
        bot.editMessageText(`⏳ Fetching live available countries for *${sName.toUpperCase()}*...`, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' }).catch(()=>{});

        const apiCountries = await fetchApiCountries(sName);
        const dbEntries = await CustomNumber.find({ service: new RegExp(`^${sName}$`, 'i') });

        let countryListMap = new Map();

        apiCountries.forEach(c => {
            if (typeof c === 'object' && (c.name || c.country)) {
                let cName = c.name || c.country;
                let cCount = c.count !== undefined ? c.count : (c.quantity !== undefined ? c.quantity : (c.available !== undefined ? c.available : '?'));
                countryListMap.set(cName, cCount);
            } else if (typeof c === 'string') {
                countryListMap.set(c, '?');
            }
        });

        dbEntries.forEach(e => {
            if (countryListMap.has(e.country)) {
                let currentCount = parseInt(countryListMap.get(e.country)) || 0;
                countryListMap.set(e.country, currentCount + e.numbers.length);
            } else {
                countryListMap.set(e.country, e.numbers.length);
            }
        });

        if (countryListMap.size === 0) {
            const kb = { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'main_menu' }]] };
            return bot.editMessageText(`⚠️ Is service (*${sName.toUpperCase()}*) ke numbers abhi server par available nahi hain.\n\nKuch der baad retry karein ya koi aur service try karein.`, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb }).catch(()=>{});
        }

        let kbButtons = [];
        let row = [];
        for (let [cName, count] of countryListMap.entries()) {
            let flag = getCountryFlagByName(cName);
            row.push({ text: `${flag} ${cName} (${count})`, callback_data: `cnt|${sName}|${cName}` });
            
            if (row.length === 2) {
                kbButtons.push(row);
                row = [];
            }
        }
        if (row.length > 0) kbButtons.push(row);
        kbButtons.push([{ text: '🔙 Back', callback_data: 'main_menu' }]);
        
        return bot.editMessageText(`📂 *${sName.toUpperCase()}* - Country select karein:`, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: { inline_keyboard: kbButtons } }).catch(()=>{});
    }

    // COUNTRY SELECTION HANDLER
    if (data.startsWith('cnt|') || data.startsWith('country_')) {
        let serviceName, countryName;
        if (data.startsWith('cnt|')) {
            const parts = data.split('|');
            serviceName = parts[1];
            countryName = parts[2];
        } else {
            const parts = data.split('_');
            serviceName = parts[1];
            countryName = parts.slice(2).join('_');
        }

        userSession[chatId] = { service: serviceName, country: countryName };
        return sendBatchNumbers(chatId, userSession[chatId].service, userSession[chatId].country, msgId);
    }

    if (data === 'next_batch') {
        if (!userSession[chatId]) return sendMainMenu(chatId, msgId);
        return sendBatchNumbers(chatId, userSession[chatId].service, userSession[chatId].country, msgId);
    }

    if (data === 'change_country') {
        if (!userSession[chatId]) return sendMainMenu(chatId, msgId);
        return bot.emit('callback_query', { id: query.id, message: query.message, data: `srv|${userSession[chatId].service}` });
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
            statsText += `📂 Active DB Services: \`${totalServices.length}\`\n`;
            statsText += `📱 Total DB Custom Numbers: \`${totalNumbers}\`\n`;
            statsText += `⚡ Automatic API Mode: \`ENABLED\`\n\n`;
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

// --- AUTOMATED BATCH NUMBERS GENERATOR ---
async function sendBatchNumbers(chatId, service, country, messageId) {
    bot.editMessageText(`⏳ Requesting fresh virtual numbers for *${service.toUpperCase()}* (${country})...`, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }).catch(()=>{});

    let numbersToDeliver = [];

    const record = await CustomNumber.findOne({ service: new RegExp(`^${service}$`, 'i'), country: country });
    if (record && record.numbers.length > 0) {
        numbersToDeliver = record.numbers.slice(0, 5);
        record.numbers = record.numbers.slice(5);
        await record.save();
    }

    if (numbersToDeliver.length === 0) {
        for (let i = 0; i < 5; i++) {
            const num = await requestApiNumber(service, country);
            if (num) numbersToDeliver.push(num);
        }
    }

    if (numbersToDeliver.length === 0) {
        const singleRetry = await requestApiNumber(service, country);
        if (singleRetry) {
            numbersToDeliver.push(singleRetry);
        }
    }

    if (numbersToDeliver.length === 0) {
        const kb = { inline_keyboard: [[{ text: '🌍 Change Country', callback_data: 'change_country' }, { text: '🏠 Main Menu', callback_data: 'main_menu' }]] };
        return bot.editMessageText(`⚠️ Is country (*${country}*) mein filhal numbers server par available nahi hain. Kuch der baad retry karein.`, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: kb }).catch(()=>{});
    }

    let text = `📱 *Service:* ${service.toUpperCase()}\n🌍 *Country:* ${country}\n\n*Aap ke ${numbersToDeliver.length} numbers ye hain:*\n\n`;
    numbersToDeliver.forEach((num) => { text += `🟢 \`${num}\`\n`; });
    text += `\n_POWERED BY TEAM ZERO_`;

    const kb = {
        inline_keyboard: [
            [{ text: '🔄 Get More Numbers', callback_data: 'next_batch' }, { text: '🌍 Change Country', callback_data: 'change_country' }],
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
                    await new Promise(resolve => setTimeout(resolve, 50));
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

// --- REAL-TIME API POLLING ---
async function pollOTPs() {
    try {
        const response = await axios.get(`${API_BASE_URL}/otp?count=100`, { timeout: 5000 });
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

                    const text = `🔥 *TEAM ZERO OTP RECEIVED* 🔥\n\n🌐 Service: *${service}*\n${countryInfo.flag} Country: *${countryInfo.name}*\n💬 OTP Code: \`${otpCode}\`\n\n_POWERED BY TEAM ZERO_`;
                    
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
