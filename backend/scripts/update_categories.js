import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import Deal from '../src/db/models/deal.js';
import Master from '../src/db/models/master.js';

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const categories = await Master.find({ type: 'category', isActive: true });
  const categoryValues = categories.map(c => c.value);
  const categoryString = categoryValues.map(v => `"${v}"`).join(', ');

  console.log('Active Categories:', categoryString);

  // Update existing deals
  const deals = await Deal.find({});
  console.log(`Found ${deals.length} deals to process...`);

  const systemMessage = `You are a product categorization AI. 
Analyze the given product deal title and description.
Categorize the product strictly into exactly ONE of the following categories: [${categoryString}].
If it does not fit perfectly into any, choose the closest match or default to "general".
Respond ONLY with a valid JSON object matching this schema: {"category": "chosen_category"}. Do not output any markdown or explanation.`;

  let updatedCount = 0;
  for (const deal of deals) {
    const userMessage = `Title: ${deal.title}\nDescription: ${deal.description || ''}`;
    
    try {
      const completion = await openai.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        response_format: { type: 'json_object' }
      });

      const parsedData = JSON.parse(completion.choices[0].message.content);
      const newCategory = parsedData.category;
      
      if (deal.category !== newCategory) {
        console.log(`[Update] "${deal.title.substring(0, 40)}..." -> [${deal.category}] to [${newCategory}]`);
        deal.category = newCategory;
        await deal.save();
        updatedCount++;
      } else {
        console.log(`[Skip] "${deal.title.substring(0, 40)}..." -> remains [${deal.category}]`);
      }
      
      // Prevent rate limiting
      await new Promise(res => setTimeout(res, 500));
    } catch (err) {
      console.error(`Error processing deal ${deal._id}:`, err.message);
    }
  }

  console.log(`\nFinished! Updated ${updatedCount} deals.`);
  process.exit(0);
}

run();
