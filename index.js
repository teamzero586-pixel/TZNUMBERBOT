require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const mongoose = require('mongoose');

// --- TEAM ZERO VARIABLES ---
const token = '8641069487:AAEpCameV9iRrj2BHjHT9gBvN8jAG_-IJsU';
const groupId = -1003752493443;
const ownerId = 7077890783;
const numberPanelApiKey = 'np_live_yltQxyzf5AruC7F-jTYZS82NTse7hq2VwXMVVrM-4vs'; 

// MongoDB URI
const mongoUri = 'mongodb+srv://kojiv58207_db_user:9QRspjWGLwqIdVVt@tznumberbot.jsrs9mx.mongodb.net/tznumberbot?retryWrites=true&w=majority&appName=TZNUMBERBOT';

// --- DATABASE SETUP (MongoDB) ---
mongoose.connect(mongoUri)
    .then(() => console.log('✅ TEAM ZERO Database Connected Successfully!'))
    .catch(err => console.error('❌ Database connection error:', err));

// Schemas
const orderSchema = new mongoose.Schema({
    orderId: String,
    phoneNumber: String,
    userId: Number,
    service: String,
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

const userSchema = new mongoose.Schema({
    chatId: { type: Number, unique: true },
    joinedAt: { type: Date, default: Date.now },
    isVerified: { type: Boolean, default: false }
});
const User = mongoose.model('User', userSchema);

// --- BOT SETUP ---
const bot = new TelegramBot(token, { polling: true });
console.log("🚀 TEAM ZERO OTP Bot is running perfectly...");

// Admin State for Broadcast
let adminState = {};

// --- FORCE JOIN VERIFICATION FUNCTION ---
async function checkForceJoin(userId) {
    if (userId === ownerId) return true;
    
    try {
        const channelCheck = await bot.getChatMember('@teamzerochanel', userId);
        const groupCheck = await bot.getChatMember('@teamzerootp', userId);
        
        const validStatuses = ['member', 'administrator', 'creator'];
        const inChannel = validStatuses.includes(channelCheck.status);
        const inGroup = validStatuses.includes(groupCheck.status);
        
        return (inChannel && inGroup);
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

⚠️ *Note:* Bot use karne ke liye Telegram Channel, OTP Group aur WHATSAPP CHANEL join karna lazmi hai.

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
                [{ text: '🔎 Sim Database Bot', url: 'https://t.me/teamzerotracesimdataroobot' }],
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

Neeche diye gaye buttons se apni service select karein:

*Support & Contact:* @teamzerocontectbot

_POWERED BY TEAM ZERO_
    `;
    const options = {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [{ text: '🟢 WhatsApp', callback_data: 'buy_whatsapp' }, { text: '🔵 Facebook', callback_data: 'buy_facebook' }],
                [{ text: '✈️ Telegram', callback_data: 'buy_telegram' }, { text: '📸 Instagram', callback_data: 'buy_instagram' }],
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
    } catch (e) { console.log("User save error"); }

    const isJoined = await checkForceJoin(chatId);
    if (!isJoined) {
        return sendForceJoinMenu(chatId);
    }
    
    sendMainMenu(chatId);
});

// --- ADMIN PANEL COMMAND ---
bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;
    if (chatId !== ownerId) return bot.sendMessage(chatId, "❌ You are not authorized.");
    sendAdminPanel(chatId);
});

// --- CALLBACK QUERIES ---
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
            bot.answerCallbackQuery(query.id, { text: "❌ Aapne abhi tak Telegram Channel aur Group join nahi kiya hai!", show_alert: true });
        }
        return;
    }

    if (data.startsWith('admin_') || data === 'admin_panel') {
        if (chatId !== ownerId) return bot.answerCallbackQuery(query.id, { text: "❌ Not Authorized!", show_alert: true });
    }

    if (data === 'admin_panel') {
        sendAdminPanel(chatId);
    } 
    else if (data === 'admin_stats') {
        const totalUsers = await User.countDocuments();
        const totalOrders = await Order.countDocuments();
        const completedOrders = await Order.countDocuments({ status: 'completed' });
        
        const statsMsg = `📊 *TEAM ZERO BOT STATS*\n\n👥 Total Users: ${totalUsers}\n🛒 Total Orders: ${totalOrders}\n✅ Completed (OTP Received): ${completedOrders}`;
        bot.sendMessage(chatId, statsMsg, { parse_mode: 'Markdown' });
    } 
    else if (data === 'admin_broadcast') {
        adminState[chatId] = 'waiting_for_broadcast';
        bot.sendMessage(chatId, "📢 *Broadcast Mode*\n\nApna message type karein jo sab users ko bhejna hai. (Cancel karne ke liye /cancel type karein)", { parse_mode: 'Markdown' });
    }
    // Buy Services API handling fixed
    else if (data.startsWith('buy_')) {
        const isJoined = await checkForceJoin(chatId);
        if (!isJoined) {
            bot.answerCallbackQuery(query.id, { text: "⚠️ Pehle channel aur group join karein." });
            return sendForceJoinMenu(chatId);
        }

        const serviceName = data.split('_')[1]; // whatsapp, facebook, etc.
        bot.answerCallbackQuery(query.id, { text: "⏳ Fetching number..." });
        bot.sendMessage(chatId, "⏳ TEAM ZERO system number fetch kar raha hai...");

        try {
            // Numberpanel API correct endpoint format
            const apiUrl = `https://numberpanel.tech/api/v1/order?api_key=${numberPanelApiKey}&service=${serviceName}`;
            const response = await axios.get(apiUrl);

            if (response.data && (response.data.status === 'success' || response.data.id || response.data.number)) {
                const orderId = response.data.id || response.data.orderId || response.data.request_id;
                const number = response.data.number || response.data.phone;

                if (!number) {
                    bot.sendMessage(chatId, "❌ Number nahi mila. Stock khatam ho sakta hai ya service unavailable hai.");
                    return;
                }

                const newOrder = new Order({ orderId, phoneNumber: number, userId: chatId, service: serviceName });
                await newOrder.save();

                bot.sendMessage(chatId, `✅ *New Number Issued!*\n\n📱 Number: \`${number}\`\n🔢 Order ID: ${orderId || 'N/A'}\n🌐 Service: ${serviceName.toUpperCase()}\n\n⏳ OTP ka wait karein, milte hi aapko aur group mein bhej diya jayega.`, { parse_mode: 'Markdown' });
            } else {
                bot.sendMessage(chatId, "❌ Number fetch nahi ho saka. Balance ya service check karein.");
            }
        } catch (error) {
            console.error("API Error:", error.response?.data || error.message);
            bot.sendMessage(chatId, "⚠️ TEAM ZERO Server Error: API response fail ho gayi.");
        }
    }
    
    try {
        bot.answerCallbackQuery(query.id);
    } catch(e) {}
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

        bot.sendMessage(chatId, "⏳ Broadcast start ho raha hai...");
        adminState[chatId] = null; 

        const users = await User.find();
        let successCount = 0;

        for (let user of users) {
            try {
                await bot.sendMessage(user.chatId, `📢 *TEAM ZERO UPDATE*\n\n${text}`, { parse_mode: 'Markdown' });
                successCount++;
            } catch (err) {}
        }
        bot.sendMessage(chatId, `✅ Broadcast Complete!\n👥 Sent to: ${successCount}/${users.length} users.`);
    }
});

// --- OTP POLLING SYSTEM ---
setInterval(async () => {
    try {
        const pendingOrders = await Order.find({ status: 'pending' });

        for (let order of pendingOrders) {
            const orderAgeMinutes = (Date.now() - order.createdAt.getTime()) / 60000;
            if (orderAgeMinutes > 15) {
                order.status = 'expired';
                await order.save();
                continue;
            }

            const checkUrl = `https://numberpanel.tech/api/v1/check?api_key=${numberPanelApiKey}&id=${order.orderId}`;
            const response = await axios.get(checkUrl);

            if (response.data && (response.data.status === 'success' || response.data.otp)) {
                const otpCode = response.data.otp || response.data.code;

                if (!otpCode) continue;

                // 1. Group mein OTP forward karna
                const groupMessage = `🔥 *TEAM ZERO OTP RECEIVED* 🔥\n\n📱 Number: \`${order.phoneNumber}\`\n💬 OTP Code: \`${otpCode}\`\n🌐 Service: ${order.service.toUpperCase()}\n\n_POWERED BY TEAM ZERO_`;
                bot.sendMessage(groupId, groupMessage, { parse_mode: 'Markdown' });

                // 2. User ko direct bot mein notify karna
                const userMessage = `✅ *Aapke number ka OTP aa gaya hai!*\n\n📱 Number: \`${order.phoneNumber}\`\n💬 OTP: \`${otpCode}\`\n🌐 Service: ${order.service.toUpperCase()}\n\n_POWERED BY TEAM ZERO_`;
                bot.sendMessage(order.userId, userMessage, { parse_mode: 'Markdown' });

                // 3. Database update karna
                order.status = 'completed';
                await order.save();
            }
        }
    } catch (error) {
        console.error("OTP Polling Error:", error.message);
    }
}, 10000);
