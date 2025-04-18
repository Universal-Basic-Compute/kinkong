import sys
from pathlib import Path
import os
import asyncio
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from airtable import Airtable
import requests
import json
import numpy as np
import aiohttp
import asyncio
from typing import List, Optional, Dict, Any

# Get the project root (parent of scripts directory)
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

# Force load environment variables from project root .env
load_dotenv(dotenv_path=project_root / '.env', override=True)

def calculate_volatility(price_data: List[float]) -> float:
    """Calculate price volatility with Parkinson's High-Low estimator"""
    try:
        # Check if input is a list of prices
        if isinstance(price_data, list):
            if not price_data:
                return 0
                
            # Convert list of prices to high/low format
            highs = price_data
            lows = price_data
        else:
            # Handle dict format from API
            items = price_data.get('data', {}).get('items', [])
            if not items:
                return 0
                
            highs = [float(item['h']) for item in items]
            lows = [float(item['l']) for item in items]
        
        # Parkinson's volatility estimator
        hl_ratios = [np.log(h/l)**2 for h, l in zip(highs, lows)]
        volatility = np.sqrt(1/(4*np.log(2)) * np.mean(hl_ratios)) * np.sqrt(252)
        return volatility * 100  # Convert to percentage
    except Exception as e:
        print(f"Error calculating volatility: {e}")
        return 0

def calculate_momentum(price_data: Dict) -> float:
    """Calculate momentum score using RSI and price trends"""
    try:
        items = price_data.get('data', {}).get('items', [])
        if not items:
            return 0
            
        closes = [float(item['c']) for item in items]
        
        # Calculate RSI
        deltas = np.diff(closes)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        avg_gain = np.mean(gains[-14:])  # 14-period RSI
        avg_loss = np.mean(losses[-14:])
        
        rs = avg_gain / avg_loss if avg_loss != 0 else 0
        rsi = 100 - (100 / (1 + rs))
        
        # Calculate price trend
        sma20 = np.mean(closes[-20:])
        sma50 = np.mean(closes[-50:])
        trend = (sma20/sma50 - 1) * 100
        
        # Combine RSI and trend into momentum score
        momentum = (rsi * 0.4) + (trend * 0.6)  # Weighted combination
        return min(max(momentum, 0), 100)  # Bound between 0-100
    except Exception as e:
        print(f"Error calculating momentum: {e}")
        return 0

def get_moving_averages(price_data: Dict) -> Dict:
    """Calculate multiple moving averages and their trends"""
    try:
        items = price_data.get('data', {}).get('items', [])
        if not items:
            return {}
            
        closes = [float(item['c']) for item in items]
        
        # Calculate multiple MAs
        ma1h = np.mean(closes[-1:]) if len(closes) >= 1 else 0
        ma4h = np.mean(closes[-4:]) if len(closes) >= 4 else 0
        ma24h = np.mean(closes[-24:]) if len(closes) >= 24 else 0
        
        # Calculate MA trends
        trends = {
            '1h': 'up' if closes[-1] > ma1h else 'down',
            '4h': 'up' if ma1h > ma4h else 'down',
            '24h': 'up' if ma4h > ma24h else 'down'
        }
        
        return {
            'values': {
                '1h': ma1h,
                '4h': ma4h,
                '24h': ma24h
            },
            'trends': trends
        }
    except Exception as e:
        print(f"Error calculating MAs: {e}")
        return {}

def calculate_depth(orderbook: Dict, price_range: float, side: str) -> float:
    """Calculate order book depth within price range"""
    try:
        orders = orderbook.get(side, [])
        if not orders:
            return 0
            
        current_price = float(orders[0][0])  # Price of best bid/ask
        range_limit = current_price * (1 + price_range) if side == 'asks' else current_price * (1 - price_range)
        
        depth = sum(
            float(order[1]) for order in orders 
            if (side == 'asks' and float(order[0]) <= range_limit) or
               (side == 'bids' and float(order[0]) >= range_limit)
        )
        
        return depth
    except Exception as e:
        print(f"Error calculating depth: {e}")
        return 0

def calculate_liquidity_score(orderbook: Dict) -> float:
    """Calculate overall liquidity score based on depth and spread"""
    try:
        spread = float(orderbook.get('spread', 0))
        depth_2pct = (
            calculate_depth(orderbook, 0.02, 'bids') +
            calculate_depth(orderbook, 0.02, 'asks')
        ) / 2
        
        # Normalize and combine metrics
        spread_score = max(0, min(100, (1 - spread) * 100))
        depth_score = min(100, (depth_2pct / 10000) * 100)  # Normalize to 100
        
        return (spread_score * 0.4) + (depth_score * 0.6)  # Weighted average
    except Exception as e:
        print(f"Error calculating liquidity score: {e}")
        return 0

def calculate_holder_concentration(holder_data: Dict) -> float:
    """Calculate holder concentration score"""
    try:
        holders = holder_data.get('holders', [])
        if not holders:
            return 0
            
        total_supply = sum(float(h['balance']) for h in holders)
        if total_supply == 0:
            return 0
            
        # Calculate Herfindahl-Hirschman Index
        hhi = sum((float(h['balance'])/total_supply)**2 for h in holders)
        
        # Convert HHI to 0-100 score where lower is better
        return (1 - hhi) * 100
    except Exception as e:
        print(f"Error calculating holder concentration: {e}")
        return 0

def calculate_buy_sell_ratio(trades: Dict) -> float:
    """Calculate buy/sell volume ratio"""
    try:
        recent_trades = trades.get('data', [])
        if not recent_trades:
            return 1.0
            
        buy_vol = sum(float(t['amount']) for t in recent_trades if t.get('side') == 'buy')
        sell_vol = sum(float(t['amount']) for t in recent_trades if t.get('side') == 'sell')
        
        return buy_vol / sell_vol if sell_vol > 0 else 1.0
    except Exception as e:
        print(f"Error calculating buy/sell ratio: {e}")
        return 1.0

def calculate_avg_trade_size(trades: Dict) -> float:
    """Calculate average trade size"""
    try:
        recent_trades = trades.get('data', [])
        if not recent_trades:
            return 0
            
        total_volume = sum(float(t['amount']) for t in recent_trades)
        return total_volume / len(recent_trades)
    except Exception as e:
        print(f"Error calculating average trade size: {e}")
        return 0

def count_large_transactions(trades: Dict, threshold: float = 1000) -> int:
    """Count number of large transactions"""
    try:
        recent_trades = trades.get('data', [])
        if not recent_trades:
            return 0
            
        return sum(1 for t in recent_trades if float(t['amount']) >= threshold)
    except Exception as e:
        print(f"Error counting large transactions: {e}")
        return 0

def calculate_vwap(trades: Dict) -> float:
    """Calculate volume weighted average price"""
    try:
        recent_trades = trades.get('data', [])
        if not recent_trades:
            return 0
            
        volume_price = sum(float(t['amount']) * float(t['price']) for t in recent_trades)
        total_volume = sum(float(t['amount']) for t in recent_trades)
        
        return volume_price / total_volume if total_volume > 0 else 0
    except Exception as e:
        print(f"Error calculating VWAP: {e}")
        return 0

def calculate_utilization(pool_data: Dict) -> float:
    """Calculate pool utilization rate"""
    try:
        tvl = float(pool_data.get('tvl', 0))
        volume_24h = float(pool_data.get('volume24h', 0))
        
        return (volume_24h / tvl * 100) if tvl > 0 else 0
    except Exception as e:
        print(f"Error calculating utilization: {e}")
        return 0

def calculate_il_risk(pool_data: Dict) -> float:
    """Calculate impermanent loss risk score"""
    try:
        price_change = abs(float(pool_data.get('priceChange24h', 0)))
        volatility = float(pool_data.get('volatility24h', 0))
        
        # Higher score = higher risk
        risk_score = (price_change * 0.4) + (volatility * 0.6)
        return min(risk_score, 100)  # Cap at 100
    except Exception as e:
        print(f"Error calculating IL risk: {e}")
        return 0

def calculate_volume_growth(volumes: List[float]) -> float:
    """Calculate volume growth comparing recent vs old averages"""
    if len(volumes) < 2:
        return 0
    # Compare average of last 3 days vs first 3 days
    recent_avg = sum(volumes[:3]) / min(3, len(volumes))
    old_avg = sum(volumes[-3:]) / min(3, len(volumes))
    return (recent_avg - old_avg) / old_avg if old_avg > 0 else 0

def calculate_price_trend(prices: List[float]) -> float:
    """Calculate price trend using exponential moving average"""
    if len(prices) < 2:
        return 0
    # Use exponential moving average
    alpha = 0.2  # Smoothing factor
    ema = prices[0]
    for price in prices[1:]:
        ema = alpha * price + (1 - alpha) * ema
    return (ema - prices[-1]) / prices[-1] if prices[-1] > 0 else 0

def calculate_additional_metrics(snapshots_table: Airtable, token_name: str, days: int = 7) -> Optional[Dict]:
    """Calculate additional metrics from historical snapshots"""
    try:
        # Construct base URL and query parameters manually
        base_url = f"https://api.airtable.com/v0/{os.getenv('KINKONG_AIRTABLE_BASE_ID')}/TOKEN_SNAPSHOTS"
        
        # Create the filter formula
        filter_formula = f"AND({{token}}='{token_name}', IS_AFTER({{createdAt}}, DATEADD(NOW(), -{days}, 'days')))"
        
        # Create complete URL with parameters - with correct array index notation
        url = f"{base_url}?filterByFormula={filter_formula}&sort%5B0%5D%5Bfield%5D=createdAt&sort%5B0%5D%5Bdirection%5D=desc"
        
        # Make request with headers
        headers = {
            'Authorization': f"Bearer {os.getenv('KINKONG_AIRTABLE_API_KEY')}",
            'Content-Type': 'application/json'
        }
        
        response = requests.get(url, headers=headers)
        if not response.ok:
            print(f"Error fetching snapshots: {response.status_code} - {response.text}")
            return None
            
        recent_snapshots = response.json().get('records', [])

        print(f"\nProcessing {token_name}:")
        print(f"URL: {url}")
        print("Response status:", response.status_code)

        if not recent_snapshots:
            print(f"No snapshots found for {token_name}")
            return None

        # Extract and validate data
        volumes = [float(snap['fields'].get('volume24h', 0)) for snap in recent_snapshots]
        prices = [float(snap['fields'].get('price', 0)) for snap in recent_snapshots]

        # Calculate metrics
        volume7d = sum(volumes)
        volume_growth = calculate_volume_growth(volumes)
        price7dAvg = sum(prices) / len(prices) if prices else 0
        price_trend = calculate_price_trend(prices)
        volatility = calculate_volatility(prices)

        # Get SOL comparison with correct sort parameters
        sol_url = f"{base_url}?filterByFormula={{token}}='SOL'&sort%5B0%5D%5Bfield%5D=createdAt&sort%5B0%5D%5Bdirection%5D=desc"
        
        sol_response = requests.get(sol_url, headers=headers)
        if not sol_response.ok:
            print(f"Error fetching SOL data: {sol_response.status_code} - {sol_response.text}")
            return None
            
        sol_snapshots = sol_response.json().get('records', [])
        sol_prices = [float(snap['fields'].get('price', 0)) for snap in sol_snapshots]
        sol_trend = calculate_price_trend(sol_prices) if sol_prices else 0
        vs_sol_performance = price_trend - sol_trend if price_trend is not None else 0

        return {
            'volume7d': volume7d,
            'volumeGrowth': volume_growth * 100,
            'price7dAvg': price7dAvg,
            'priceTrend': price_trend * 100,
            'vsSolPerformance': vs_sol_performance * 100,
            'priceVolatility': volatility
        }
    except Exception as e:
        print(f"Error calculating additional metrics for {token_name}: {e}")
        return None

async def validate_token_address(token_mint: str) -> bool:
    """Validate if token address exists on Solana"""
    try:
        # First try DexScreener API as a fallback
        url = f"https://api.dexscreener.com/latest/dex/tokens/{token_mint}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    return bool(data.get('pairs'))
        return False
    except Exception as e:
        print(f"Error validating token address: {e}")
        return False

async def get_enhanced_token_metrics(token_mint: str) -> Dict:
    """Get comprehensive token metrics from Birdeye"""
    try:
        headers = {
            "X-API-KEY": os.getenv('BIRDEYE_API_KEY'),
            "x-chain": "solana",
            "accept": "application/json"
        }

        # Define endpoints
        base_url = "https://public-api.birdeye.so"
        endpoints = {
            'price': f"{base_url}/defi/price_volume/single?address={token_mint}&type=24h",
            'trade_data': f"{base_url}/defi/v3/token/trade-data/single?address={token_mint}",
            'top_traders': f"{base_url}/defi/v2/tokens/top_traders?address={token_mint}&time_frame=24h&sort_type=desc&sort_by=volume&limit=10"
        }

        async with aiohttp.ClientSession() as session:
            responses = {}
            
            # Make parallel requests
            for name, url in endpoints.items():
                try:
                    print(f"Requesting {name} data from: {url}")
                    async with session.get(url, headers=headers) as response:
                        if response.status == 200:
                            data = await response.json()
                            if data.get('success'):
                                responses[name] = data.get('data', {})
                                print(f"✅ {name} data received")
                            else:
                                print(f"❌ {name} API error: {data.get('message')}")
                                responses[name] = {}
                        else:
                            print(f"❌ {name} request failed: {response.status}")
                            print(f"Response: {await response.text()}")
                            responses[name] = {}
                except Exception as e:
                    print(f"❌ Error fetching {name} data: {e}")
                    responses[name] = {}

        # Process price data
        price_data = responses.get('price', {})
        price_metrics = {
            'current': price_data.get('price', 0),
            'priceChangePercent': price_data.get('priceChangePercent', 0),
            'volumeChangePercent': price_data.get('volumeChangePercent', 0),
            'volumeUSD': price_data.get('volumeUSD', 0),
            'updateUnixTime': price_data.get('updateUnixTime', 0),
            'updateHumanTime': price_data.get('updateHumanTime', '')
        }

        # Process trade data with additional v3 metrics
        trade_data = responses.get('trade_data', {})
        trade_metrics = {
            # Volume metrics
            'volume24h': trade_data.get('volume24h', 0),
            'volumeChange': trade_data.get('volumeChange', 0),
            'volumeChangePercent': trade_data.get('volumeChangePercent', 0),
            
            # Trade count metrics
            'trades24h': trade_data.get('trades24h', 0),
            'tradesChange': trade_data.get('tradesChange', 0),
            'tradesChangePercent': trade_data.get('tradesChangePercent', 0),
            
            # Price metrics
            'priceHigh24h': trade_data.get('priceHigh24h', 0),
            'priceLow24h': trade_data.get('priceLow24h', 0),
            'priceChange24h': trade_data.get('priceChange24h', 0),
            'priceChangePercent24h': trade_data.get('priceChangePercent24h', 0),
            
            # Trading activity
            'avgTradeSize': trade_data.get('avgTradeSize', 0),
            'avgTradeSizeChange': trade_data.get('avgTradeSizeChange', 0),
            'avgTradeSizeChangePercent': trade_data.get('avgTradeSizeChangePercent', 0),
            'buySellRatio': trade_data.get('buySellRatio', 1.0),
            'buySellRatioChange': trade_data.get('buySellRatioChange', 0),
            
            # Transaction analysis
            'largeTransactions': trade_data.get('largeTransactions', 0),
            'largeTransactionsChange': trade_data.get('largeTransactionsChange', 0),
            'largeTransactionVolume': trade_data.get('largeTransactionVolume', 0),
            'largeTransactionVolumeChange': trade_data.get('largeTransactionVolumeChange', 0),
            
            # Trader metrics
            'uniqueTraders': trade_data.get('uniqueTraders', 0),
            'uniqueTradersChange': trade_data.get('uniqueTradersChange', 0),
            'uniqueTradersChangePercent': trade_data.get('uniqueTradersChangePercent', 0),
            'newTraders': trade_data.get('newTraders', 0),
            'newTradersChange': trade_data.get('newTradersChange', 0),
            
            # Market depth
            'marketDepthBid': trade_data.get('marketDepthBid', 0),
            'marketDepthAsk': trade_data.get('marketDepthAsk', 0),
            'marketDepthRatio': trade_data.get('marketDepthRatio', 0),
            
            # Liquidity metrics
            'liquidityUSD': trade_data.get('liquidityUSD', 0),
            'liquidityChange': trade_data.get('liquidityChange', 0),
            'liquidityChangePercent': trade_data.get('liquidityChangePercent', 0),
            
            # Time-based metrics
            'timeFirstTrade': trade_data.get('timeFirstTrade', ''),
            'timeLastTrade': trade_data.get('timeLastTrade', ''),
            'tradingHours': trade_data.get('tradingHours', 0),
            'activeTradingHours': trade_data.get('activeTradingHours', 0),
            
            # Additional analysis
            'volatility24h': trade_data.get('volatility24h', 0),
            'momentum24h': trade_data.get('momentum24h', 0),
            'trendStrength': trade_data.get('trendStrength', 0),
            'averageSlippage': trade_data.get('averageSlippage', 0)
        }

        # Process top traders data
        traders = responses.get('top_traders', {}).get('items', [])
        trader_metrics = {
            'totalVolume': sum(t.get('volume', 0) for t in traders),
            'buyVolume': sum(t.get('volumeBuy', 0) for t in traders),
            'sellVolume': sum(t.get('volumeSell', 0) for t in traders),
            'buyTrades': sum(t.get('tradeBuy', 0) for t in traders),
            'sellTrades': sum(t.get('tradeSell', 0) for t in traders),
            'topTraderCount': len(traders)
        }

        # Combine all metrics
        metrics = {
            'price': price_metrics,
            'trade': trade_metrics,
            'traders': trader_metrics,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }

        print(f"\nMetrics for {token_mint}:")
        print(json.dumps(metrics, indent=2))
        return metrics

    except Exception as e:
        print(f"Error fetching metrics for {token_mint}: {e}")
        if hasattr(e, '__traceback__'):
            import traceback
            print("Traceback:")
            traceback.print_tb(e.__traceback__)
        return {
            'price': {
                'current': 0,
                'priceChangePercent': 0,
                'volumeChangePercent': 0,
                'volumeUSD': 0,
                'updateUnixTime': 0,
                'updateHumanTime': ''
            },
            'trade': {
                'volume24h': 0,
                'trades24h': 0,
                'avgTradeSize': 0,
                'buySellRatio': 1.0,
                'largeTransactions': 0,
                'uniqueTraders': 0,
                'volumeChange': 0,
                'tradesChange': 0
            },
            'traders': {
                'totalVolume': 0,
                'buyVolume': 0,
                'sellVolume': 0,
                'buyTrades': 0,
                'sellTrades': 0,
                'topTraderCount': 0
            }
        }

def get_token_price(token_mint: str) -> dict:
    """Get current token metrics from Birdeye"""
    try:
        url = f"https://api.dexscreener.com/latest/dex/tokens/{token_mint}"
        headers = {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json'
        }
        
        print(f"\nFetching DexScreener data for {token_mint}")
        response = requests.get(url, headers=headers)
        
        if response.ok:
            data = response.json()
            
            if not data.get('pairs'):
                print(f"No pairs found for token {token_mint}")
                return {
                    'price': 0,
                    'volume24h': 0,
                    'liquidity': 0,
                    'priceChange24h': 0
                }
                
            # Get all Solana pairs
            sol_pairs = [p for p in data['pairs'] if p.get('chainId') == 'solana']
            if not sol_pairs:
                print(f"No Solana pairs found for token {token_mint}")
                return {
                    'price': 0,
                    'volume24h': 0,
                    'liquidity': 0,
                    'priceChange24h': 0
                }
            
            # Get the most liquid pair
            main_pair = max(sol_pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0) or 0))
            
            # Calculate totals across all pairs
            total_volume = sum(float(p.get('volume', {}).get('h24', 0) or 0) for p in sol_pairs)
            total_liquidity = sum(float(p.get('liquidity', {}).get('usd', 0) or 0) for p in sol_pairs)
            
            # Get price and change from main pair
            price = float(main_pair.get('priceUsd', 0) or 0)
            price_change = float(main_pair.get('priceChange', {}).get('h24', 0) or 0)
            
            print(f"Found {len(sol_pairs)} Solana pairs")
            print(f"Price: ${price:.4f}")
            print(f"24h Volume: ${total_volume:,.2f}")
            print(f"Liquidity: ${total_liquidity:,.2f}")
            print(f"24h Change: {price_change:.2f}%")
            
            return {
                'price': price,
                'volume24h': total_volume,
                'liquidity': total_liquidity,
                'priceChange24h': price_change
            }
            
        else:
            print(f"DexScreener API error: {response.status_code}")
            print(f"Response: {response.text}")
            return {
                'price': 0,
                'volume24h': 0,
                'liquidity': 0,
                'priceChange24h': 0
            }
            
    except Exception as e:
        print(f"Error getting metrics for {token_mint}: {e}")
        if 'response' in locals():
            print(f"Response: {response.text}")
        return {
            'price': 0,
            'volume24h': 0,
            'liquidity': 0,
            'priceChange24h': 0
        }

async def record_portfolio_snapshot():
    """Record current portfolio state to Airtable"""
    try:
        # Set Windows event loop policy at the start
        if os.name == 'nt':  # Windows
            import asyncio
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

        print("\n📸 Taking portfolio snapshot...")
        
        # Initialize Airtable
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        if not base_id or not api_key:
            raise ValueError("Missing Airtable configuration")
            
        # Get active tokens from TOKENS table first
        tokens_table = Airtable(base_id, 'TOKENS', api_key)
        active_tokens = tokens_table.get_all(
            formula="{isActive}=1"
        )
        
        print(f"\nFound {len(active_tokens)} active tokens")
        
        # Current timestamp
        created_at = datetime.now(timezone.utc).isoformat()
        
        # Create snapshots table connection
        snapshots_table = Airtable(base_id, 'TOKEN_SNAPSHOTS', api_key)
        
        # Create new snapshots
        new_snapshots = []
        total_value = 0
        
        for token in active_tokens:
            try:
                token_name = token['fields'].get('token')
                mint = token['fields'].get('mint')
                
                if not token_name or not mint:
                    continue
                
                # Get current metrics
                metrics = get_token_price(mint)
                
                # Calculate additional metrics
                additional_metrics = calculate_additional_metrics(snapshots_table, token_name)
                
                # Get enhanced metrics
                enhanced_metrics = await get_enhanced_token_metrics(mint)

                # Create snapshot with core metrics
                snapshot = {
                    'token': token_name,  # Use token name consistently
                    'price': metrics['price'],
                    'volume24h': metrics['volume24h'],
                    'liquidity': metrics['liquidity'],
                    'priceChange24h': metrics['priceChange24h'],
                    'createdAt': created_at,
                    'isActive': True
                }

                # Add additional core metrics if available
                if additional_metrics:
                    snapshot.update({
                        'volume7d': additional_metrics['volume7d'],
                        'price7dAvg': additional_metrics['price7dAvg']
                    })

                # Add detailed metrics as JSON
                if enhanced_metrics:
                    snapshot['metrics'] = json.dumps({
                        'price': {
                            'volatility24h': enhanced_metrics['price_metrics']['volatility_24h'],
                            'momentumScore': enhanced_metrics['price_metrics']['momentum_score'],
                            'movingAverages': enhanced_metrics['price_metrics']['ma_trends']
                        },
                        'liquidity': {
                            'bidAskSpread': enhanced_metrics['liquidity_metrics']['bid_ask_spread'],
                            'depth': {
                                'buy2pct': enhanced_metrics['liquidity_metrics']['depth_buy_2pct'],
                                'sell2pct': enhanced_metrics['liquidity_metrics']['depth_sell_2pct']
                            },
                            'score': enhanced_metrics['liquidity_metrics']['liquidity_score']
                        },
                        'holders': {
                            'total': enhanced_metrics['holder_metrics']['total_holders'],
                            'concentration': enhanced_metrics['holder_metrics']['holder_concentration'],
                            'dailyTransfers': enhanced_metrics['holder_metrics']['daily_transfers']
                        },
                        'trading': {
                            'buySellRatio': enhanced_metrics['trading_metrics']['buy_sell_ratio'],
                            'avgTradeSize': enhanced_metrics['trading_metrics']['avg_trade_size'],
                            'largeTxCount': enhanced_metrics['trading_metrics']['large_tx_count'],
                            'vwap24h': enhanced_metrics['trading_metrics']['vwap_24h']
                        },
                        'pool': {
                            'tvlChange24h': enhanced_metrics['pool_metrics']['tvl_change_24h'],
                            'feeApr': enhanced_metrics['pool_metrics']['fee_apr'],
                            'utilizationRate': enhanced_metrics['pool_metrics']['utilization_rate'],
                            'ilRiskScore': enhanced_metrics['pool_metrics']['il_risk_score']
                        },
                        'additional': {
                            'volumeGrowth': additional_metrics.get('volumeGrowth'),
                            'priceTrend': additional_metrics.get('priceTrend'),
                            'vsSolPerformance': additional_metrics.get('vsSolPerformance'),
                            'priceVolatility': additional_metrics.get('priceVolatility')
                        } if additional_metrics else {}
                    })
                
                new_snapshots.append(snapshot)
                print(f"\nProcessed {token_name}:")
                print(f"Price: ${metrics['price']:.4f}")
                print(f"24h Volume: ${metrics['volume24h']:,.2f}")
                print(f"Liquidity: ${metrics['liquidity']:,.2f}")
                print(f"24h Change: {metrics['priceChange24h']:.2f}%")
                
                if additional_metrics:
                    print(f"7d Volume: ${additional_metrics['volume7d']:,.2f}")
                    print(f"Volume Growth: {additional_metrics['volumeGrowth']:.1f}%")
                    print(f"vs SOL: {additional_metrics['vsSolPerformance']:.1f}%")
                    print(f"Volatility: {additional_metrics['priceVolatility']:.1f}%")
                
                # Add to total value if we have allocation data
                if 'allocation' in token['fields']:
                    total_value += metrics['price'] * float(token['fields']['allocation'])
                
            except Exception as e:
                print(f"Error processing {token_name}: {e}")
                continue
        
        # Save new snapshots to Airtable
        for snapshot in new_snapshots:
            try:
                snapshots_table.insert(snapshot)
                print(f"✅ Saved snapshot for {snapshot['token']}")
            except Exception as e:
                print(f"Failed to save snapshot for {snapshot['token']}: {e}")
        
        # Create portfolio snapshot
        portfolio_snapshots_table = Airtable(base_id, 'PORTFOLIO_SNAPSHOTS', api_key)
        
        portfolio_snapshot = {
            'createdAt': created_at,
            'totalValue': total_value,
            'holdings': json.dumps(new_snapshots)
        }
        
        portfolio_snapshots_table.insert(portfolio_snapshot)
        print(f"\n✅ Portfolio snapshot recorded at {created_at}")
        print(f"Total Value: ${total_value:,.2f}")
        print(f"Tokens: {len(new_snapshots)}")
        
        return {
            'totalValue': total_value,
            'snapshots': new_snapshots
        }
        
    except Exception as e:
        print(f"\n❌ Error taking snapshot: {e}")
        raise

if __name__ == "__main__":
    try:
        # Set Windows event loop policy before running
        if os.name == 'nt':
            import asyncio
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        
        asyncio.run(record_portfolio_snapshot())
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)
