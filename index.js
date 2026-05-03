
const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: F}) => F(...args));
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

const SYSTEM_PROMPT = `Eres el asistente virtual del Gimnasio Planet, ubicado en Punta Arenas, Chile. Eres amigable, directo y motivador. Responde en español.`;

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  console.log('Verificación webhook:', mode, token);
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verificado');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  console.log('Mensaje recibido:', JSON.stringify(req.body));
  res.sendStatus(200);
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    if (!message || message.type !== 'text') return;
    const from = message.from;
    const text = message.text.body;
    console.log('Texto:', text, 'De:', from);
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }]
      })
    });
    const claudeData = await claudeRes.json();
    console.log('Claude respuesta:', JSON.stringify(claudeData));
    const reply = claudeData.content?.[0]?.text || 'No pude responder.';
    await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: from,
        type: 'text',
        text: { body: reply }
      })
    });
    console.log('Respuesta enviada a', from);
  } catch (err) {
    console.error('Error:', err);
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Planet Bot corriendo en puerto ${PORT}`));
