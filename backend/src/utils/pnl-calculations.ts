interface PnLParams {
  token: string;
  allocation: number;
  usdValue: number;
  price: number;
}

export function calculateDailyPnl(portfolio: PnLParams[]): number {
  try {
    // Pour l'instant, retourne une valeur simple
    // TODO: Implémenter la vraie logique avec les prix historiques
    return portfolio.reduce((sum, holding) => sum + (holding.usdValue * 0.01), 0);
  } catch (error) {
    console.error('Error calculating daily PnL:', error);
    return 0;
  }
}

export function calculateWeeklyPnl(portfolio: PnLParams[]): number {
  try {
    // TODO: Implémenter avec les données historiques
    return portfolio.reduce((sum, holding) => sum + (holding.usdValue * 0.05), 0);
  } catch (error) {
    console.error('Error calculating weekly PnL:', error);
    return 0;
  }
}

export function calculateMonthlyPnl(portfolio: PnLParams[]): number {
  try {
    // TODO: Implémenter avec les données historiques
    return portfolio.reduce((sum, holding) => sum + (holding.usdValue * 0.15), 0);
  } catch (error) {
    console.error('Error calculating monthly PnL:', error);
    return 0;
  }
}
