from typing import Dict, Optional, List, Any
from dataclasses import dataclass
from datetime import datetime, timezone
import logging
import aiohttp
import json
import os
import asyncio
from enum import Enum

class MetricType(Enum):
    PRICE = 'price'
    TRADE = 'trade'
    TRADER = 'trader'

METRIC_DEFAULTS = {
    MetricType.PRICE: {
        'current': 0,
        'priceChangePercent': 0,
        'volumeChangePercent': 0,
        'volumeUSD': 0,
        'updateUnixTime': 0,
        'updateHumanTime': ''
    },
    MetricType.TRADE: {
        'volume': {'amount24h': 0, 'change': 0},
        'trades': {'count24h': 0, 'avgSize': 0},
        'price': {'high24h': 0, 'low24h': 0},
        'market': {'depthBid': 0, 'depthAsk': 0},
        'analysis': {'volatility24h': 0, 'momentum24h': 0}
    },
    MetricType.TRADER: {
        'totalVolume': 0,
        'buyVolume': 0,
        'sellVolume': 0,
        'uniqueTraders': 0,
        'newTraders': 0
    }
}

@dataclass
class ApiConfig:
    """API configuration settings"""
    base_url: str = "https://public-api.birdeye.so/defi"
    timeout: int = 30
    max_retries: int = 3
    retry_delay: int = 1

class MetricsError(Exception):
    """Base exception for metrics collection"""
    pass

class ApiError(MetricsError):
    """API related errors"""
    pass

class ValidationError(MetricsError):
    """Data validation errors"""
    pass

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
    """Structured response with validation"""
    price_metrics: Dict
    trade_metrics: Dict
    trader_metrics: Dict
    timestamp: str
    success: bool
    error: Optional[str] = None

    def __post_init__(self):
        """Validate response data"""
        self.validate_metrics()
        self.normalize_values()

    def validate_metrics(self):
        """Ensure all required fields are present"""
        for metric_type in MetricType:
            actual = getattr(self, f"{metric_type.value}_metrics")
            default = METRIC_DEFAULTS[metric_type]
            self._ensure_fields(actual, default)

    def _ensure_fields(self, actual: Dict, default: Dict):
        """Recursively ensure all default fields exist"""
        for key, value in default.items():
            if key not in actual:
                actual[key] = value
            elif isinstance(value, dict):
                self._ensure_fields(actual[key], value)

    def normalize_values(self):
        """Convert and normalize numeric values"""
        for metric_type in MetricType:
            metrics = getattr(self, f"{metric_type.value}_metrics")
            self._normalize_dict_values(metrics)

    def _normalize_dict_values(self, data: Dict):
        """Recursively normalize numeric values"""
        for key, value in data.items():
            if isinstance(value, dict):
                self._normalize_dict_values(value)
            elif isinstance(value, (str, float, int)):
                try:
                    data[key] = float(value)
                except (ValueError, TypeError):
                    pass

def setup_logging():
    """Configure logging"""
    logger = logging.getLogger(__name__)
    
    # Only add handler if none exist to avoid duplicates
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        
    # Force logging level to INFO
    logger.setLevel(logging.INFO)
    
    # Ensure parent loggers don't filter our messages
    logger.propagate = False
    
    return logger

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

    def _extract_price_metrics(self, data: Dict) -> Dict:
        """Extract and organize price metrics"""
        self.logger.info(f"Raw price data received: {json.dumps(data, indent=2)}")
        
        if not isinstance(data, dict):
            self.logger.warning(f"Received non-dict price data: {type(data)}")
            return METRIC_DEFAULTS[MetricType.PRICE]
        
        try:
            metrics = {
                'current': float(data.get('current', 0)),
                'priceChangePercent': float(data.get('priceChangePercent', 0)),
                'volumeChangePercent': float(data.get('volumeChangePercent', 0)),
                'volumeUSD': float(data.get('volumeUSD', 0)),
                'updateUnixTime': int(data.get('updateUnixTime', 0)),
                'updateHumanTime': str(data.get('updateHumanTime', ''))
            }
            self.logger.info(f"Extracted price metrics: {json.dumps(metrics, indent=2)}")
            return metrics
        except Exception as e:
            self.logger.error(f"Error extracting price metrics: {str(e)}")
            self.logger.error(f"Data that caused error: {json.dumps(data, indent=2)}")
            return METRIC_DEFAULTS[MetricType.PRICE]

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
            self.logger.info(f"Starting metrics collection for token: {token_mint}")
            
            # Make API requests
            self.logger.info("Making API requests...")
            
            price_data = await self._make_request(BirdeyeEndpoints.price_volume(token_mint))
            self.logger.info(f"Raw price data: {json.dumps(price_data, indent=2)}")
            
            trade_data = await self._make_request(BirdeyeEndpoints.trade_data(token_mint))
            self.logger.info(f"Raw trade data: {json.dumps(trade_data, indent=2)}")
            
            trader_data = await self._make_request(BirdeyeEndpoints.top_traders(token_mint))
            self.logger.info(f"Raw trader data: {json.dumps(trader_data, indent=2)}")

            # Extract metrics
            self.logger.info("Extracting metrics from raw data...")
            price_metrics = self._extract_price_metrics(price_data)
            trade_metrics = self._extract_trade_metrics(trade_data or {})
            
            self.logger.info(f"Extracted price metrics: {json.dumps(price_metrics, indent=2)}")
            self.logger.info(f"Extracted trade metrics: {json.dumps(trade_metrics, indent=2)}")

            # Create response
            response = MetricsResponse(
                price=price_metrics,
                trade=trade_metrics,
                traders=trader_data or METRIC_DEFAULTS[MetricType.TRADER],
                timestamp=datetime.now(timezone.utc).isoformat(),
                success=True
            )
            
            self.logger.info("Successfully created metrics response")
            return response

        except Exception as e:
            self.logger.error(f"Error collecting metrics: {str(e)}", exc_info=True)
            self.logger.error(f"Stack trace:", exc_info=True)
            return MetricsResponse(
                price=METRIC_DEFAULTS[MetricType.PRICE],
                trade=METRIC_DEFAULTS[MetricType.TRADE],
                traders=METRIC_DEFAULTS[MetricType.TRADER],
                timestamp=datetime.now(timezone.utc).isoformat(),
                success=False,
                error=str(e)
            )
