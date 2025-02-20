const base = require('./client').default;

// Export using module.exports
module.exports = {
  TABLES: {
    PORTFOLIO: 'PORTFOLIO',
    TRADES: 'TRADES', 
    TOKENS: 'TOKENS',
    SIGNALS: 'SIGNALS',
    REPORTS: 'REPORTS',
    PORTFOLIO_SNAPSHOTS: 'PORTFOLIO_SNAPSHOTS',
    INVESTMENTS: 'INVESTMENTS',
    MARKET_SENTIMENT: 'MARKET_SENTIMENT',
    MESSAGES: 'MESSAGES',
    THOUGHTS: 'THOUGHTS'
  },

  getTable: (tableName) => {
    if (!tableName) {
      throw new Error('Table name is required');
    }
    console.log('Getting table:', tableName);
    return base.table(tableName);
  }
};
