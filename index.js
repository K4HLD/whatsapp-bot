import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const DOMAIN = "k4hld.com";

const emailStore = new Map();

async function sendWhatsApp(to, text) {
  try {
    await axios.post(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`, {
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: { body: text }
    }, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.log("Error:", error.response?.data || error.message);
  }
}

async function handleCommand(sender, text) {
  const chatId = sender;

  if (text === '/start' || text.toLowerCase() === 'start') {
    await sendWhatsApp(chatId, 
      `👋 أهلاً بك في بوت الإيميلات المؤقتة\n` +
      `📧 الدومين: ${DOMAIN}\n\n` +
      `⚙️ الأوامر:\n` +
      `create اسم - حجز إيميل\n` +
      `myemails - عرض إيميلاتك\n` +
      `delete اسم - حذف إيميل\n` +
      `transfer اسم رقم - تحويل إيميل`
    );
  }

  else if (text.toLowerCase().startsWith('create ')) {
    let input = text.substring(7).trim().toLowerCase();
    if (input.includes('@')) input = input.split('@')[0];
    
    if (emailStore.get(`owner:${input}`)) {
      await sendWhatsApp(chatId, "❌ هذا الاسم محجوز بالفعل");
      return;
    }
    
    emailStore.set(`owner:${input}`, chatId);
    let userEmails = emailStore.get(`list:${chatId}`) || [];
    if (!userEmails.includes(input)) {
      userEmails.push(input);
      emailStore.set(`list:${chatId}`, userEmails);
    }
    
    await sendWhatsApp(chatId, `✅ تم حجز ${input}@${DOMAIN}`);
  }

  else if (text.toLowerCase() === 'myemails') {
    const userEmails = emailStore.get(`list:${chatId}`) || [];
    if (userEmails.length === 0) {
      await sendWhatsApp(chatId, "📭 لا تملك أي إيميلات");
    } else {
      let msg = `📂 إيميلاتك:\n`;
      userEmails.forEach(em => msg += `📧 ${em}@${DOMAIN}\n`);
      await sendWhatsApp(chatId, msg);
    }
  }

  else if (text.toLowerCase().startsWith('delete ')) {
    let input = text.substring(7).trim().toLowerCase();
    if (input.includes('@')) input = input.split('@')[0];
    
    if (emailStore.get(`owner:${input}`) !== chatId) {
      await sendWhatsApp(chatId, "❌ لا تملك هذا الإيميل");
      return;
    }
    
    emailStore.delete(`owner:${input}`);
    let userEmails = emailStore.get(`list:${chatId}`) || [];
    userEmails = userEmails.filter(em => em !== input);
    emailStore.set(`list:${chatId}`, userEmails);
    
    await sendWhatsApp(chatId, `🗑️ تم حذف ${input}@${DOMAIN}`);
  }

  else if (text.toLowerCase().startsWith('transfer ')) {
    const parts = text.split(' ');
    if (parts.length < 3) {
      await sendWhatsApp(chatId, "⚠️ استخدم: transfer الاسم الرقم");
      return;
    }
    
    let inputEmail = parts[1].toLowerCase();
    const targetUser = parts[2];
    
    if (emailStore.get(`owner:${inputEmail}`) !== chatId) {
      await sendWhatsApp(chatId, "❌ لا تملك هذا الإيميل");
      return;
    }
    
    emailStore.set(`owner:${inputEmail}`, targetUser);
    
    let ownerEmails = emailStore.get(`list:${chatId}`) || [];
    ownerEmails = ownerEmails.filter(em => em !== inputEmail);
    emailStore.set(`list:${chatId}`, ownerEmails);
    
    let targetEmails = emailStore.get(`list:${targetUser}`) || [];
    if (!targetEmails.includes(inputEmail)) {
      targetEmails.push(inputEmail);
      emailStore.set(`list:${targetUser}`, targetEmails);
    }
    
    await sendWhatsApp(chatId, `🎁 تم تحويل ${inputEmail}@${DOMAIN} إلى ${targetUser}`);
    await sendWhatsApp(targetUser, `🎉 تم تحويل ${inputEmail}@${DOMAIN} إليك`);
  }
}

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message || message.type !== 'text') return;
    
    await handleCommand(message.from, message.text.body);
  } catch (error) {
    console.log("Error:", error);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));