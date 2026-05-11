async function recognizeReceipt(imageFile, progressCallback) {
  const apiKey = CONFIG.getApiKey();

  if (!CONFIG.hasApiKey()) {
    throw new Error('API_KEY_MISSING');
  }

  if (progressCallback) progressCallback('画像を変換中...');
  const base64 = await fileToBase64(imageFile);
  const mediaType = imageFile.type || 'image/jpeg';

  if (progressCallback) progressCallback('Claude APIで解析中...');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64
            }
          },
          {
            type: 'text',
            text: `このレシート画像を解析して、以下の情報をJSON形式で返してください。
必ず以下のJSON形式のみで返答し、それ以外のテキストは含めないでください。

{
  "storeName": "店名・会社名",
  "amount": 合計金額（数値のみ、カンマなし）,
  "date": "YYYY-MM-DD形式の日付",
  "details": "購入品目・明細の要約（50文字以内）"
}

注意:
- 合計金額（税込）を優先してください。合計が見つからない場合は最も大きい金額を使用してください。
- 日付がレシートに記載されていない場合は空文字にしてください。
- 店名は正式名称をそのまま記載してください。`
          }
        ]
      }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('API_KEY_INVALID');
    throw new Error(err.error?.message || 'API呼び出しに失敗しました');
  }

  const data = await response.json();
  const text = data.content[0]?.text || '';

  return parseClaudeResponse(text);
}

function parseClaudeResponse(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { storeName: '', amount: 0, date: '', details: text.substring(0, 200) };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      storeName: parsed.storeName || '',
      amount: parseInt(parsed.amount, 10) || 0,
      date: parsed.date || '',
      details: parsed.details || ''
    };
  } catch {
    return { storeName: '', amount: 0, date: '', details: text.substring(0, 200) };
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
