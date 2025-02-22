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

class TokenMetricsCollector:
    def __init__(self, api_key: str):
        self.headers = {
            "X-API-KEY": api_key,
            "x-chain": "solana",
            "accept": "application/json"
        }
        self.logger = logging.getLogger(__name__)

    async def _make_request(self, url: str) -> Optional[Dict]:
        """Make API request with error handling"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=self.headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get('success'):
                            return data.get('data', {})
                        self.logger.warning(f"API error: {data.get('message')}")
                    else:
                        self.logger.error(f"Request failed: {response.status}")
                        self.logger.debug(await response.text())
            return None
        except Exception as e:
            self.logger.error(f"Request error: {str(e)}")
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
            # Make parallel requests
            responses = await asyncio.gather(
                self._make_request(BirdeyeEndpoints.price_volume(token_mint)),
                self._make_request(BirdeyeEndpoints.trade_data(token_mint)),
                self._make_request(BirdeyeEndpoints.top_traders(token_mint))
            )

            if not all(responses):
                return MetricsResponse(
                    price_metrics={},
                    trade_metrics={},
                    trader_metrics={},
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    success=False,
                    error="One or more API requests failed"
                )

            price_data, trade_data, trader_data = responses

            # Process metrics
            price_metrics = {
                'current': price_data.get('price', 0),
                'changePercent': price_data.get('priceChangePercent', 0),
                'volumeUSD': price_data.get('volumeUSD', 0),
                'updateTime': price_data.get('updateHumanTime', '')
            }

            trade_metrics = self._extract_trade_metrics(trade_data)

            trader_metrics = {
                'totalVolume': sum(t.get('volume', 0) for t in trader_data.get('items', [])),
                'buyVolume': sum(t.get('volumeBuy', 0) for t in trader_data.get('items', [])),
                'sellVolume': sum(t.get('volumeSell', 0) for t in trader_data.get('items', [])),
                'uniqueTraders': trade_data.get('uniqueTraders', 0),
                'newTraders': trade_data.get('newTraders', 0)
            }

            return MetricsResponse(
                price_metrics=price_metrics,
                trade_metrics=trade_metrics,
                trader_metrics=trader_metrics,
                timestamp=datetime.now(timezone.utc).isoformat(),
                success=True
            )

        except Exception as e:
            self.logger.error(f"Error collecting metrics: {str(e)}", exc_info=True)
            return MetricsResponse(
                price_metrics={},
                trade_metrics={},
                trader_metrics={},
                timestamp=datetime.now(timezone.utc).isoformat(),
                success=False,
                error=str(e)
            )
