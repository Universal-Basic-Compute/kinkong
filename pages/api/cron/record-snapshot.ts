import { recordPortfolioSnapshot } from '@/backend/src/strategy/snapshots';

export default async function handler(req: any, res: any) {
  // Verify cron secret if needed
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await recordPortfolioSnapshot();
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record snapshot' });
  }
}
