import os
import json
import aiohttp
import asyncio
import base58
import base64
from datetime import datetime
import logging
from typing import Dict, Optional
import urllib.parse
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

class JupiterTradeExecutor:
    def __init__(self):
        load_dotenv()
        
    async def get_jupiter_quote(
        self, 
        input_token: str, 
        output_token: str, 
        amount: float
    ) -> Optional[Dict]:
        """Get quote from Jupiter"""
        try:
            # Convert amount to proper decimals (USDC has 6 decimals)
            amount_raw = int(amount * 1e6)
            
            params = {
                "inputMint": str(input_token),
                "outputMint": str(output_token),
                "amount": str(amount_raw),
                "slippageBps": "100",
                "onlyDirectRoutes": "false",
                "asLegacyTransaction": "true"
            }
            
            url = "https://quote-api.jup.ag/v6/quote"
            
            logger.info("\nJupiter Quote Request:")
            logger.info(f"Input Token: {input_token}")
            logger.info(f"Output Token: {output_token}")
            logger.info(f"Amount USD: ${amount:.2f}")
            logger.info(f"Amount Raw: {amount_raw}")
            logger.info(f"Full URL: {url}?{urllib.parse.urlencode(params)}")
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params) as response:
                    response_text = await response.text()
                    logger.info(f"Response Status: {response.status}")
                    logger.info(f"Raw Response: {response_text}")
                    
                    if not response.ok:
                        logger.error(f"Jupiter API error: {response.status}")
                        logger.error(f"Response headers: {dict(response.headers)}")
                        logger.error(f"Response body: {response_text}")
                        return None
                        
                    try:
                        data = json.loads(response_text)
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse JSON response: {e}")
                        logger.error(f"Invalid JSON: {response_text}")
                        return None
                    
                    if not data.get('success'):
                        error_msg = data.get('error', 'No error message provided')
                        logger.error(f"Jupiter API returned error: {error_msg}")
                        return None
                        
                    quote_data = data.get('data', {})
                    
                    if not quote_data.get('outAmount'):
                        logger.error("Quote missing output amount")
                        logger.error(f"Quote data: {json.dumps(quote_data, indent=2)}")
                        return None
                    
                    logger.info("Quote received successfully:")
                    logger.info(f"Input amount: {quote_data.get('inAmount')}")
                    logger.info(f"Output amount: {quote_data.get('outAmount')}")
                    logger.info(f"Price impact: {quote_data.get('priceImpactPct')}%")
                    
                    return quote_data
                    
        except Exception as e:
            logger.error(f"Error getting Jupiter quote: {str(e)}")
            if hasattr(e, '__traceback__'):
                import traceback
                logger.error("Traceback:")
                traceback.print_tb(e.__traceback__)
            return None

    async def get_jupiter_transaction(
        self, 
        quote_data: dict,
        wallet_address: str
    ) -> Optional[bytes]:
        """Get swap transaction from Jupiter"""
        try:
            url = "https://quote-api.jup.ag/v6/swap"
            
            swap_data = {
                "quoteResponse": quote_data,
                "userPublicKey": wallet_address,
                "wrapAndUnwrapSol": False,
                "asLegacyTransaction": True,
                "dynamicComputeUnitLimit": True,
                "prioritizationFeeLamports": {
                    "priorityLevelWithMaxLamports": {
                        "maxLamports": 10000000,
                        "priorityLevel": "high"
                    }
                }
            }
            
            logger.info(f"Requesting swap transaction with data: {json.dumps(swap_data, indent=2)}")
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=swap_data) as response:
                    if not response.ok:
                        logger.error(f"Jupiter API error: {response.status}")
                        logger.error(f"Response: {await response.text()}")
                        return None
                        
                    transaction_data = await response.json()
                    
                    transaction_base64 = transaction_data.get('swapTransaction')
                    if not transaction_base64:
                        logger.error("No transaction data in response")
                        return None

                    try:
                        transaction_bytes = base64.b64decode(transaction_base64)
                        logger.info(f"Transaction bytes length: {len(transaction_bytes)}")
                        return transaction_bytes
                        
                    except Exception as e:
                        logger.error(f"Invalid transaction format: {e}")
                        return None

        except Exception as e:
            logger.error(f"Error getting swap transaction: {e}")
            return None

async def execute_test_trade():
    """Test function to execute a small USDC -> SOL trade"""
    try:
        # Initialize executor
        executor = JupiterTradeExecutor()
        
        # USDC and SOL mint addresses
        USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        SOL_MINT = "So11111111111111111111111111111111111111112"
        
        # Test wallet address (replace with your wallet)
        wallet_address = os.getenv('STRATEGY_WALLET_ADDRESS')
        
        if not wallet_address:
            raise ValueError("STRATEGY_WALLET_ADDRESS not found in environment")
        
        # Get quote for 1 USDC -> SOL
        quote = await executor.get_jupiter_quote(
            input_token=USDC_MINT,
            output_token=SOL_MINT,
            amount=1.0  # 1 USDC
        )
        
        if not quote:
            raise Exception("Failed to get quote")
            
        # Get transaction
        transaction_bytes = await executor.get_jupiter_transaction(
            quote_data=quote,
            wallet_address=wallet_address
        )
        
        if not transaction_bytes:
            raise Exception("Failed to get transaction")
            
        logger.info("✅ Successfully generated swap transaction")
        logger.info(f"Transaction size: {len(transaction_bytes)} bytes")
        
        # Note: Actual transaction signing and sending would go here
        # But we're just testing the Jupiter API integration for now
        
    except Exception as e:
        logger.error(f"Test trade failed: {e}")
        raise

if __name__ == "__main__":
    try:
        asyncio.run(execute_test_trade())
    except KeyboardInterrupt:
        print("\nScript interrupted by user")
    except Exception as e:
        print(f"Script failed: {e}")
