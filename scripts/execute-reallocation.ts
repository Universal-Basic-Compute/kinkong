import { executeReallocation } from '../backend/src/strategy/reallocation.js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
console.log('🔧 Initializing environment...');
const envPath = path.resolve(process.cwd(), '.env');
const result = dotenv.config({ path: envPath });
console.log('📁 Environment path:', envPath);

async function main() {
  try {
    console.log('🚀 Starting reallocation process...');
    
    const result = await executeReallocation();
    
    console.log('✅ Reallocation completed:', {
      sentiment: result.sentiment,
      structure: result.structure,
      orders: result.orders.length
    });

    // Log detailed order results
    result.orders.forEach(order => {
      console.log(`${order.action} ${order.amount}% ${order.token} - ${order.reason}`);
    });

  } catch (error) {
    console.error('❌ Reallocation failed:', error);
    process.exit(1);
  }
}

main();
