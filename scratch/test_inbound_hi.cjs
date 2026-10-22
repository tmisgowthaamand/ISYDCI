async function simulateUserHi() {
  console.log('Simulating incoming "Hi" from 918903162114...');
  const res = await fetch('http://localhost:5000/api/whatsapp/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        id: '3106462432894218',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '15559218432', phone_number_id: '1217145241471306' },
            contacts: [{ profile: { name: 'Gowthaaman Eswar' }, wa_id: '918903162114' }],
            messages: [{
              from: '918903162114',
              id: 'test_msg_' + Date.now(),
              timestamp: String(Math.floor(Date.now() / 1000)),
              text: { body: 'Hi' },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    })
  });
  console.log('Webhook status:', res.status, await res.text());
}
simulateUserHi();
