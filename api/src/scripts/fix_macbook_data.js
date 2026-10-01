import mongoose from 'mongoose';
import config from '../config.js';

async function run() {
  await mongoose.connect(config.mongodbUri);
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
  const Deal = mongoose.model('Deal', new mongoose.Schema({}, { strict: false }));

  await Product.updateOne(
    { productId: 'B0GR6HXPB9' },
    {
      $set: {
        title: 'Apple 2026 MacBook Neo 13" Laptop with A18 Pro chip: Built for AI and Apple Intelligence, Liquid Retina Display, 8GB Unified Memory, 256GB SSD Storage, 1080p FaceTime HD Camera, Touch ID; Blush',
        imageUrl: 'https://m.media-amazon.com/images/I/61dLund7bhL._AC_UY218_.jpg',
        images: ['https://m.media-amazon.com/images/I/61dLund7bhL._AC_UY218_.jpg'],
        variant: { storageGb: 256, ramGb: 8, color: 'Blush' }
      }
    }
  );

  await Deal.updateOne(
    { productId: 'B0GR6HXPB9' },
    {
      $set: {
        title: 'Apple 2026 MacBook Neo 13" Laptop with A18 Pro chip: Built for AI and Apple Intelligence, Liquid Retina Display, 8GB Unified Memory, 256GB SSD Storage, 1080p FaceTime HD Camera, Touch ID; Blush',
        imageUrl: 'https://m.media-amazon.com/images/I/61dLund7bhL._AC_UY218_.jpg',
        images: ['https://m.media-amazon.com/images/I/61dLund7bhL._AC_UY218_.jpg']
      }
    }
  );

  await Product.updateOne(
    { productId: 'B0GR68779Y' },
    {
      $set: {
        title: 'Apple 2026 MacBook Neo 13" Laptop with A18 Pro chip: Built for AI and Apple Intelligence, Liquid Retina Display, 8GB Unified Memory, 256GB SSD Storage, 1080p FaceTime HD Camera, Touch ID; Silver',
        imageUrl: 'https://m.media-amazon.com/images/I/61amETli1DL._AC_UY218_.jpg',
        images: ['https://m.media-amazon.com/images/I/61amETli1DL._AC_UY218_.jpg'],
        variant: { storageGb: 256, ramGb: 8, color: 'Silver' }
      }
    }
  );

  await Deal.updateOne(
    { productId: 'B0GR68779Y' },
    {
      $set: {
        title: 'Apple 2026 MacBook Neo 13" Laptop with A18 Pro chip: Built for AI and Apple Intelligence, Liquid Retina Display, 8GB Unified Memory, 256GB SSD Storage, 1080p FaceTime HD Camera, Touch ID; Silver',
        imageUrl: 'https://m.media-amazon.com/images/I/61amETli1DL._AC_UY218_.jpg',
        images: ['https://m.media-amazon.com/images/I/61amETli1DL._AC_UY218_.jpg']
      }
    }
  );

  console.log('✓ Successfully repaired MacBook Neo records in MongoDB Atlas.');
  await mongoose.disconnect();
}

run().catch(console.error);
