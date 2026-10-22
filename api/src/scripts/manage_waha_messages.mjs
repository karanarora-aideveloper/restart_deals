const baseUrl = 'http://localhost:3000';
const apiKey = 'shoppersdeals_waha_key_2026';
const session = 'default';

const chats = [
  { name: 'Shoppers Deals (WhatsApp Channel)', chatId: '120363422620024343@newsletter' },
  { name: 'WhatsApp Group: Shoppers Deals', chatId: '120363430489716016@g.us' },
  { name: 'WhatsApp Group: Shoppers Deals (Community)', chatId: '120363130683911457@g.us' }
];

async function deleteLastTwo() {
  for (const c of chats) {
    console.log(`\n========================================`);
    console.log(`Checking ${c.name} (${c.chatId})`);
    console.log(`========================================`);

    const url = `${baseUrl}/api/${session}/chats/${encodeURIComponent(c.chatId)}/messages?limit=10`;
    const res = await fetch(url, { headers: { 'X-Api-Key': apiKey } });
    if (!res.ok) {
      console.log(`Failed to fetch messages (${res.status}): ${await res.text()}`);
      continue;
    }

    const messages = await res.json();
    // Filter to messages sent by our bot/admin account
    const myMessages = messages.filter(m => m.fromMe === true || m.id?.fromMe === true);
    console.log(`Found ${myMessages.length} messages sent by us.`);

    const targets = myMessages.slice(0, 2);
    for (let i = 0; i < targets.length; i++) {
      const m = targets[i];
      const msgId = typeof m.id === 'object' ? m.id._serialized || m.id.id : m.id;
      const snippet = (m.body || m.caption || '').slice(0, 80).replace(/\n/g, ' ');
      console.log(`[Target #${i + 1}] Deleting Msg ID: ${msgId}`);
      console.log(`   Text: "${snippet}..."`);

      // Try DELETE /api/{session}/chats/{chatId}/messages/{messageId}
      const delUrl = `${baseUrl}/api/${session}/chats/${encodeURIComponent(c.chatId)}/messages/${encodeURIComponent(msgId)}`;
      try {
        const delRes = await fetch(delUrl, {
          method: 'DELETE',
          headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' }
        });
        const delText = await delRes.text();
        console.log(`   Result (${delRes.status}): ${delText || 'OK'}`);
      } catch (err) {
        console.error(`   Error deleting ${msgId}:`, err.message);
      }
    }
  }
}

deleteLastTwo().catch(console.error);
