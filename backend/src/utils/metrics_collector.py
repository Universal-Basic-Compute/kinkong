from typing import Dict, Optional
from dataclasses import dataclass
from datetime import datetime, timezone
import logging
import aiohttp
import json
import os
import asyncio

@dataclass
class BirdeyeEndpoints:
    """Centralize API endpoint configuration"""
    BASE_URL = "https://public-api.birdeye.so/defi"
    
    @classmethod
    def price_volume(cls, address: str) -> str:
        return f"{cls.BASE_URL}/price_volume/single?address={address}&type=24h"
    
    @classmethod
    def trade_data(cls, address: str) -> str:
        return f"{cls.BASE_URL}/v3/token/trade-data/single?address={address}"
    
    @classmethod
    def top_traders(cls, address: str) -> str:
        return f"{cls.BASE_URL}/v2/tokens/top_traders?address={address}&time_frame=24h&sort_type=desc&sort_by=volume&limit=10"

@dataclass
class MetricsResponse:
    """Structured response object"""
    price_metrics: Dict
    trade_metrics: Dict
    trader_metrics: Dict
    timestamp: str
    success: bool
    error: Optional[str] = None

def setup_logging():
    """Configure logging"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)

class TokenMetricsCollector:
    def __init__(self, api_key: str, config: Optional[ApiConfig] = None):
        self.config = config or ApiConfig()
        self.headers = {
            "X-API-KEY": api_key,
            "x-chain": "solana",
            "accept": "application/json"
        }
        self.logger = setup_logging()
        self.session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        """Context manager entry"""
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        if self.session:
            await self.session.close()

    async def _make_request(self, url: str) -> Optional[Dict]:
        """Make API request with retries"""
        for attempt in range(self.config.max_retries):
            try:
                if not self.session:
                    self.session = aiohttp.ClientSession()

                async with self.session.get(
                    url, 
                    headers=self.headers,
                    timeout=self.config.timeout
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get('success'):
                            return data.get('data', {})
                        raise ApiError(f"API error: {data.get('message')}")
                    raise ApiError(f"Request failed: {response.status}")

            except Exception as e:
                self.logger.warning(
                    f"Request attempt {attempt + 1} failed: {str(e)}"
                )
                if attempt == self.config.max_retries - 1:
                    raise
                await asyncio.sleep(self.config.retry_delay * (attempt + 1))

        return None

    def _extract_trade_metrics(self, data: Dict) -> Dict:
        """Extract and organize trade metrics"""
        metrics = {
            'volume': {
                'amount24h': data.get('volume24h', 0),
                'change': data.get('volumeChange', 0),
                'changePercent': data.get('volumeChangePercent', 0),
                'largeTransactions': data.get('largeTransactions', 0),
                'largeTransactionsVolume': data.get('largeTransactionVolume', 0)
            },
            'trades': {
                'count24h': data.get('trades24h', 0),
                'change': data.get('tradesChange', 0),
                'changePercent': data.get('tradesChangePercent', 0),
                'avgSize': data.get('avgTradeSize', 0),
                'avgSizeChange': data.get('avgTradeSizeChange', 0)
            },
            'price': {
                'high24h': data.get('priceHigh24h', 0),
                'low24h': data.get('priceLow24h', 0),
                'change24h': data.get('priceChange24h', 0),
                'changePercent24h': data.get('priceChangePercent24h', 0)
            },
            'market': {
                'depthBid': data.get('marketDepthBid', 0),
                'depthAsk': data.get('marketDepthAsk', 0),
                'depthRatio': data.get('marketDepthRatio', 0),
                'buySellRatio': data.get('buySellRatio', 1.0),
                'liquidity': data.get('liquidityUSD', 0)
            },
            'analysis': {
                'volatility24h': data.get('volatility24h', 0),
                'momentum24h': data.get('momentum24h', 0),
                'trendStrength': data.get('trendStrength', 0),
                'averageSlippage': data.get('averageSlippage', 0)
            }
        }
        return metrics

    async def get_token_metrics(self, token_mint: str) -> MetricsResponse:
        """Get comprehensive token metrics"""
        try:
            responses = await asyncio.gather(
                self._make_request(f"{self.config.base_url}/price_volume/single?address={token_mint}&type=24h"),
                self._make_request(f"{self.config.base_url}/v3/token/trade-data/single?address={token_mint}"),
                self._make_request(f"{self.config.base_url}/v2/tokens/top_traders?address={token_mint}&time_frame=24h&sort_type=desc&sort_by=volume&limit=10")
            )

            if not all(responses):
                raise ApiError("One or more API requests failed")

            price_data, trade_data, trader_data = responses

            return MetricsResponse(
                price_metrics=self._extract_price_metrics(price_data),
                trade_metrics=self._extract_trade_metrics(trade_data),
                trader_metrics=self._extract_trader_metrics(trader_data),
                timestamp=datetime.now(timezone.utc).isoformat(),
                success=True
            )

        except Exception as e:
            self.logger.error(f"Error collecting metrics: {str(e)}", exc_info=True)
            return MetricsResponse(
                price_metrics=METRIC_DEFAULTS[MetricType.PRICE],
                trade_metrics=METRIC_DEFAULTS[MetricType.TRADE],
                trader_metrics=METRIC_DEFAULTS[MetricType.TRADER],
                timestamp=datetime.now(timezone.utc).isoformat(),
                success=False,
                error=str(e)
            )
