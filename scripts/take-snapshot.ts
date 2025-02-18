import { recordPortfolioSnapshot } from '../backend/src/strategy/snapshots';

async function main() {
  try {
    console.log('📸 Starting manual snapshot...');
    const result = await recordPortfolioSnapshot();
    console.log('✅ Snapshot completed:', {
      totalValue: result.totalValue,
      snapshotsCount: result.snapshots.length
    });
  } catch (error) {
    console.error('❌ Snapshot failed:', error);
    process.exit(1);
  }
}

main();
