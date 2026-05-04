const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: F}) => F(...args));
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const SYSTEM_PROMPT = `Eres el asistente virtual del Gimnasio Planet, ubicado en Punta Arenas, Chile. Eres amigable, directo y motivador. Responde siempre en español y de forma concisa.

HORARIOS:
- Lunes a Viernes: 06:00 a 22:00 hrs
- Recepción L-V: 07:00 a 21:40 hrs
- Sábado: 09:00 a 19:00 hrs
- Domingo: 10:00 a 15:00 hrs

PLANES Y PRECIOS 2025 (+ activación $6.000 por única vez):
- AM hasta las 16:00 hrs: Mensual $45.000 | Trimestral $106.500 | Semestral $177.000 | Anual $314.000
- Full máquinas + Clases todo horario: Mensual $50.000 | Trimestral $124.500 | Semestral $214.200 | Anual $357.000
- AM Estudiante hasta las 18:30 hrs: Mensual $36.000 | Trimestral $81.000 | Semestral $150.000 | Anual $276.000
- Estudiante Full todo horario: Mensual $42.000 | Trimestral $96.000 | Semestral $165.000 | Anual $300.000

CONGELAMIENTO DE PLANES (con previo aviso en recepción):
- Plan Mensual: 7 días | Trimestral: 21 días | Semestral: 35 días | Anual: 45 días | Planes convenios: No congela

CROSSFIT:
- Open Box: $35.500
- 8 clases: $40.000 | 12 clases: $50.000 | 16 clases: $56.000 | 20 clases: $62.000 | 1 clase: $8.000
- Las clases tienen vigencia de 30 días
- Horario Lunes a Viernes: 18:00-19:00 y 19:15-20:15 hrs
- Lunes, Miércoles y Viernes también: 06:00-07:00 y 20:30-21:30 hrs

CLASES DIRIGIDAS 2026:
- Sábado 10:30-11:30: Entrenamiento Funcional (Rodolfo)
- Sábado 12:30-13:30: RPM (Roger)
- Lunes 19:00-20:00: HIIT (Rodolfo)
- Lunes 20:00-21:00: TRX (Martín)
- Lunes 20:30-21:30: Box Funcional (Rodolfo)
- Lunes 21:00-22:00: Spinning (Patricia)
- Martes 20:00-21:00: Body Pump (Claudio)
- Martes 20:30-21:30: Box Funcional (Rodolfo)
- Martes 21:00-22:00: RPM (Roger)
- Miércoles 18:00-19:00: Yoga (Rocío)
- Miércoles 19:00-20:00: HIIT (Rodolfo)
- Miércoles 20:30-21:30: Box Funcional (Rodolfo)
- Miércoles 21:00-22:00: Spinning (Patricia)
- Jueves 20:00-21:00: Body Pump (Claudio)
- Jueves 20:30-21:30: Box Funcional (Rodolfo)
- Jueves 21:00-22:00: RPM (Roger)
- Viernes 19:00-20:00: Yoga (Rocío)
- Viernes 19:30-20:30: HIIT Box (Rodolfo)
- Viernes 20:00-21:00: TRX (Martín)
- Viernes 21:00-22:00: Spinning (Patricia)

CLASES DISPONIBLES:
- Spinning / RPM
- HIIT (High Intensity Interval Training)
- Box Funcional / BOXCF
- Body Pump
- TRX
- Yoga
- Entrenamiento Funcional
- BodyCombat (LesMills)
- Personal Trainer (servicio adicional al plan)

CONTACTO Y ATENCIÓN HUMANA:
- Teléfono recepción: 612238781
- Si el cliente necesita hablar con una persona, indícale que llame al 612238781 o visite la recepción.

INSTRUCCIONES:
- Responde de forma breve y clara.
- Si no sabes algo, deriva al número 612238781.
- No inventes información que no esté aquí.
- Siempre termina con una frase motivadora corta si es apropiado.`;

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
    const from = message.from;
    const text = message.text.body;
    
    console.log('Mensaje recibido de:', from, '- Texto:', text);

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text }
        ]
      })
    });

    const groqData = await groqRes.json();
    console.log('Groq status:', groqRes.status, JSON.stringify(groqData).substring(0, 300));

    const reply = groqData.choices?.[0]?.message?.content || 'No pude responder.';

    const waRes = await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
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

    const waData = await waRes.json();
    console.log('WhatsApp API status:', waRes.status, JSON.stringify(waData).substring(0, 300));

  } catch (err) {
    console.error('Error completo:', err.message);
    console.error('Stack:', err.stack);
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Planet Bot corriendo en puerto ${PORT}`));
