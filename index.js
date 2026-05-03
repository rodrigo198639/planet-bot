const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const app = express();
app.use(express.json());

const VERIFY_TOKEN = 'planetbot2026';
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const META_TOKEN = process.env.META_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;

const SYSTEM_PROMPT = `Eres el asistente virtual del Gimnasio Planet, ubicado en Punta Arenas, Chile. Eres amigable, directo y motivador. Respondes en español. Si no sabes algo, deriva al 612 238781. HORARIOS: L-V 6am-10pm, Sáb 9am-7pm, Dom 10am-3pm. PLANES: AM $45.000/mes, Full $50.000/mes, Estudiante AM $36.000/mes, Estudiante Full $42.000/mes. Activación $6.000. CLASES: Lunes-HIIT 19h Rodolfo, TRX 20h Martín, Box Funcional 20:30h Rodolfo, Spinning 21h Patricia. Martes-Body Pump 20h Claudio, Box Funcional 20:30h Rodolfo, RPM 21h Roger. Miércoles-Yoga 18h Rocío, HIIT 19h Rodolfo, Box Funcional 20:30h Rodolfo, Spinning 21h Patricia. Jueves-Body Pump 19:30h Claudio, Box Funcional 20:30h Rodolfo, RPM 21h Roger. Viernes-Yoga 19h Rocío, HIIT Box 19:30h Rodolfo, TRX 20h Martín, Spinning 21h Patricia. Sábado-E.Funcional 8:15h Rodolfo, RPM 13h Roger. CROSSFIT: Open Box $35.500/mes, packs desde $8.000 la clase. PERSONAL TRAINER: servicio adicional al plan.`;

// Verificación webhook Meta
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verificado');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Recibir mensajes
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    if (!message || message.type !== 'text') return;
    const from = message.from;
    const text = message.text.body;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }]
      })
    });

    const claudeData = await claudeRes.json();
    const reply = claudeData.content?.[0]?.text || 'Lo siento, intenta de nuevo.';

    await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${META_TOKEN}`
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: from,
        type: 'text',
        text: { body: reply }
      })
    });
  } catch (err) {
    console.error(err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Planet Bot corriendo en puerto ${PORT}`));
