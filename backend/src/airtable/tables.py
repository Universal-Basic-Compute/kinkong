from airtable import Airtable
import os

def getTable(table_name: str) -> Airtable:
    """Get an Airtable table instance"""
    base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
    api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
    
    if not base_id or not api_key:
        raise ValueError("Airtable configuration missing")
        
    return Airtable(base_id, table_name, api_key)

# Export table names as constants
TABLES = {
    'TOKENS': 'TOKENS',
    'SIGNALS': 'SIGNALS',
    'TRADES': 'TRADES',
    'PORTFOLIO': 'PORTFOLIO',
    'MARKET_SENTIMENT': 'MARKET_SENTIMENT'
}
