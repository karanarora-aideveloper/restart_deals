import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../db/models/product.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.resolve(__dirname, 'backfill_history_pipeline.js');

const WORKER_COUNT = 3;
const workers = [];
let isTerminating = false;

async function printInitialStats() {
  await mongoose.connect(process.env.MONGODB_URI);
  const totalIN = await Product.countDocuments({ country: { $in: ['IN', 'in'] } });
  const lacking90 = await Product.countDocuments({
    country: { $in: ['IN', 'in'] },
    'priceHistory.89': { $exists: false },
  });
  const unattempted = await Product.countDocuments({
    country: { $in: ['IN', 'in'] },
    'priceHistory.89': { $exists: false },
    $or: [{ lastBuyhatkeSyncAt: null }, { lastBuyhatkeSyncAt: { $exists: false } }],
  });
  console.log('================================================================');
  console.log('       SHOPPERSDEALS 3-WORKER BUYHATKE PARALLEL BACKFILL        ');
  console.log('================================================================');
  console.log(`Active Parallel Workers:   ${WORKER_COUNT} Independent Processes`);
  console.log(`Target Market:             India (country: 'IN')`);
  console.log(`Condition:                 priceHistory < 90 daily checkpoints`);
  console.log(`Total Indian Products:     ${totalIN}`);
  console.log(`Products Needing 90+ Pts:  ${lacking90}`);
  console.log(`Unattempted in Queue:      ${unattempted}`);
  console.log(`Coordination Engine:       Atomic MongoDB findOneAndUpdate Locking`);
  console.log('================================================================\n');
  await mongoose.disconnect();
}

function spawnWorker(id) {
  const workerTag = `Worker-${id}`;
  const env = { ...process.env };
  const child = spawn(process.execPath, [SCRIPT_PATH, `--workerId=${workerTag}`], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        console.log(`[W${id}] ${line}`);
      }
    }
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        console.error(`[W${id}:ERR] ${line}`);
      }
    }
  });

  child.on('exit', (code, signal) => {
    if (!isTerminating) {
      console.log(`[W${id}] Process exited (code: ${code}, signal: ${signal}).`);
    }
  });

  return child;
}

function shutdown() {
  if (isTerminating) return;
  isTerminating = true;
  console.log('\n[Cluster] Shutting down all 3 workers gracefully...');
  for (const w of workers) {
    try {
      w.kill('SIGINT');
    } catch {
      // ignore
    }
  }
  setTimeout(() => {
    for (const w of workers) {
      try {
        w.kill('SIGKILL');
      } catch {
        // ignore
      }
    }
    process.exit(0);
  }, 3000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function start() {
  await printInitialStats();

  for (let i = 1; i <= WORKER_COUNT; i++) {
    const child = spawnWorker(i);
    workers.push(child);
    // Stagger starts by 500ms
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n[Cluster] All ${WORKER_COUNT} workers active and processing simultaneously.`);
}

start().catch((err) => {
  console.error('[Cluster] Failed to start workers:', err);
  process.exit(1);
});
