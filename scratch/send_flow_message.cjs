const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve(__dirname, '../backend/.env');
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = match[2] || '';
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[match[1]] = val;
    }
  });
}
loadEnv();

const token = process.env.WHATSAPP_TOKEN;
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1217145241471306';
const flowId = process.env.WHATSAPP_FLOW_ID || '1702051681489130';

const recipient = process.argv[2];

if (!recipient) {
  console.log('Usage: node send_flow_message.cjs <recipient_phone_number_with_country_code>');
  console.log('Example: node send_flow_message.cjs 919876543210');
  process.exit(1);
}

async function sendFlow() {
  console.log(`Sending ISYDCI Flow [${flowId}] to: ${recipient}...`);
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient.replace(/[^0-9]/g, ''),
    type: 'interactive',
    interactive: {
      type: 'flow',
      header: {
        type: 'text',
        text: '🏆 ISYDCI National Portal'
      },
      body: {
        text: 'Welcome to Indian Sports Youth Development Council of India (Reg: 49/1997).\n\nTap below to launch the official athlete registration and membership flow.'
      },
      footer: {
        text: 'ISYDCI Council Secretariat'
      },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: 'isydci_' + Date.now(),
          flow_id: flowId,
          flow_cta: 'Register Athlete',
          flow_action: 'navigate',
          flow_action_payload: {
            screen: 'ATHLETE_REGISTRATION',
            data: {
              contact_number: `+${recipient.replace(/[^0-9]/g, '')}`
            }
          }
        }
      }
    }
  };

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}

sendFlow();
