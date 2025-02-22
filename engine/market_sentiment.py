import os
from datetime import datetime, timezone, timedelta
from airtable import Airtable
from dotenv import load_dotenv
import logging
from typing import Dict, List, Tuple

import logging.handlers
from pathlib import Path

def setup_logging():
    """Configure logging with file and console handlers"""
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    
    # Create logs directory if it doesn't exist
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    # File handler with rotation
    file_handler = logging.handlers.RotatingFileHandler(
        log_dir / "market_sentiment.log",
        maxBytes=1024*1024,  # 1MB
        backupCount=5
    )
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    ))
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    ))
    
    # Add handlers if they don't exist
    if not logger.handlers:
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
    
    return logger

logger = setup_logging()

class MarketSentimentAnalyzer:
    def __init__(self):
        load_dotenv()
        self.base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        self.api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        self.snapshots_table = Airtable(self.base_id, 'TOKEN_SNAPSHOTS', self.api_key)
        self.tokens_table = Airtable(self.base_id, 'TOKENS', self.api_key)

    def get_weekly_snapshots(self, token: str) -> List[Dict]:
        """Get snapshots from the last 7 days for a token"""
        seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        return self.snapshots_table.get_all(
            formula=f"AND({{token}}='{token}', IS_AFTER({{createdAt}}, '{seven_days_ago}'))"
        )

    def analyze_price_action(self, active_tokens: List[Dict]) -> Tuple[bool, str, int, int]:
        """Check if >60% of AI tokens are above their 7-day average"""
        logger = logging.getLogger(__name__)
        logger.info("Analyzing price action...")
        
        tokens_above_avg = 0
        total_tokens = len([t for t in active_tokens if t['fields'].get('token') != 'SOL'])
        
        for token in active_tokens:
            token_name = token['fields'].get('token')
            if token_name == 'SOL':
                continue
                
            snapshots = self.get_weekly_snapshots(token_name)
            if snapshots:
                prices = [float(snap['fields'].get('price', 0)) for snap in snapshots]
                if prices:
                    avg_price = sum(prices) / len(prices)
                    current_price = prices[-1]
                    if current_price > avg_price:
                        tokens_above_avg += 1
        
        percent_above = (tokens_above_avg / total_tokens * 100) if total_tokens > 0 else 0
        is_bullish = percent_above > 60
        notes = f"{percent_above:.1f}% of tokens above 7d average"
        
        return is_bullish, notes, total_tokens, tokens_above_avg

    def analyze_volume(self, active_tokens: List[Dict]) -> Tuple[bool, str, float, float]:
        """Check if weekly volume is higher than previous week"""
        total_volume_current = 0
        total_volume_previous = 0
        
        for token in active_tokens:
            token_name = token['fields'].get('token')
            if token_name == 'SOL':
                continue
                
            snapshots = self.get_weekly_snapshots(token_name)
            if len(snapshots) >= 2:
                # Split snapshots into current and previous week
                mid_point = len(snapshots) // 2
                current_week = snapshots[:mid_point]
                previous_week = snapshots[mid_point:]
                
                current_vol = sum(float(snap['fields'].get('volume24h', 0)) for snap in current_week)
                previous_vol = sum(float(snap['fields'].get('volume24h', 0)) for snap in previous_week)
                
                total_volume_current += current_vol
                total_volume_previous += previous_vol
        
        volume_growth = ((total_volume_current - total_volume_previous) / total_volume_previous * 100) if total_volume_previous > 0 else 0
        is_bullish = volume_growth > 0
        notes = f"Volume growth: {volume_growth:.1f}%"
        
        return is_bullish, notes, total_volume_current, total_volume_previous

    def analyze_volume_distribution(self, active_tokens: List[Dict]) -> Tuple[bool, str, float]:
        """Check if >60% of volume is on up days"""
        total_up_volume = 0
        total_volume = 0
        
        for token in active_tokens:
            token_name = token['fields'].get('token')
            if token_name == 'SOL':
                continue
                
            snapshots = self.get_weekly_snapshots(token_name)
            for i in range(1, len(snapshots)):
                current_price = float(snapshots[i]['fields'].get('price', 0))
                previous_price = float(snapshots[i-1]['fields'].get('price', 0))
                volume = float(snapshots[i]['fields'].get('volume24h', 0))
                
                if current_price > previous_price:
                    total_up_volume += volume
                total_volume += volume
        
        up_volume_percent = (total_up_volume / total_volume * 100) if total_volume > 0 else 0
        is_bullish = up_volume_percent > 60
        notes = f"{up_volume_percent:.1f}% of volume on up days"
        
        return is_bullish, notes, total_up_volume

    def analyze_relative_strength(self, active_tokens: List[Dict]) -> Tuple[bool, str, float, float]:
        """Check if AI tokens are outperforming SOL"""
        # Get SOL performance
        sol_snapshots = self.get_weekly_snapshots('SOL')
        if not sol_snapshots:
            return False, "No SOL data available"
            
        sol_prices = [float(snap['fields'].get('price', 0)) for snap in sol_snapshots]
        if len(sol_prices) < 2:
            return False, "Insufficient SOL price data"
            
        sol_return = ((sol_prices[-1] - sol_prices[0]) / sol_prices[0] * 100)
        
        # Calculate average AI token performance
        ai_returns = []
        for token in active_tokens:
            token_name = token['fields'].get('token')
            if token_name == 'SOL':
                continue
                
            snapshots = self.get_weekly_snapshots(token_name)
            if len(snapshots) >= 2:
                prices = [float(snap['fields'].get('price', 0)) for snap in snapshots]
                token_return = ((prices[-1] - prices[0]) / prices[0] * 100)
                ai_returns.append(token_return)
        
        if not ai_returns:
            return False, "No AI token data available"
            
        avg_ai_return = sum(ai_returns) / len(ai_returns)
        outperformance = avg_ai_return - sol_return
        is_bullish = outperformance > 0
        notes = f"AI tokens vs SOL: {outperformance:+.1f}%"
        
        return is_bullish, notes, sol_return, avg_ai_return

    async def calculate_sentiment(self) -> Dict:
        """Calculate overall market sentiment"""
        try:
            # Get active tokens
            active_tokens = self.tokens_table.get_all(formula="{isActive}=1")
            
            # Run all analyses with additional return values
            price_bullish, price_notes, total_tokens, tokens_above_avg = self.analyze_price_action(active_tokens)
            volume_bullish, volume_notes, weekly_volume, prev_week_volume = self.analyze_volume(active_tokens)
            distribution_bullish, distribution_notes, up_day_volume = self.analyze_volume_distribution(active_tokens)
            strength_bullish, strength_notes, sol_performance, ai_tokens_performance = self.analyze_relative_strength(active_tokens)
            
            # Count bullish signals
            bullish_signals = sum([
                price_bullish,
                volume_bullish, 
                distribution_bullish,
                strength_bullish
            ])
            
            # Calculate confidence based on proportion of bullish signals
            confidence = (bullish_signals / 4) * 100
            
            # Determine sentiment based on proportion of bullish signals
            if bullish_signals >= 3:  # 75-100% bullish signals
                sentiment = "BULLISH"
            elif bullish_signals <= 1:  # 0-25% bullish signals
                sentiment = "BEARISH"
            else:  # 50% bullish signals
                sentiment = "NEUTRAL"
            
            # Compile reasons
            reasons = [
                f"Price Action: {price_notes}",
                f"Volume Trend: {volume_notes}",
                f"Volume Distribution: {distribution_notes}",
                f"Relative Strength: {strength_notes}"
            ]
            
            result = {
                "classification": sentiment,
                "confidence": confidence,
                "bullishSignals": bullish_signals,
                "notes": "\n".join(reasons),  # Join array into single string with line breaks
                "createdAt": datetime.now(timezone.utc).isoformat(),
                # Add new metrics
                "totalTokens": total_tokens,
                "tokensAbove7dAvg": tokens_above_avg,
                "weeklyVolume": weekly_volume,
                "prevWeekVolume": prev_week_volume,
                "upDayVolume": up_day_volume,
                "solPerformance": sol_performance,
                "aiTokensPerformance": ai_tokens_performance
            }
            
            logger.info(f"\nMarket Sentiment Analysis:")
            logger.info(f"Sentiment: {sentiment}")
            logger.info(f"Confidence: {confidence:.1f}%")
            logger.info(f"Bullish Signals: {bullish_signals}/4")
            logger.info("\nReasons:")
            for reason in reasons:
                logger.info(f"• {reason}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error calculating market sentiment: {e}")
            raise

async def main():
    try:
        logger = setup_logging()
        logger.info("Starting market sentiment analysis...")
        
        analyzer = MarketSentimentAnalyzer()
        sentiment = await analyzer.calculate_sentiment()
        
        # Save to MARKET_SENTIMENT table
        sentiment_table = Airtable(
            os.getenv('KINKONG_AIRTABLE_BASE_ID'),
            'MARKET_SENTIMENT',
            os.getenv('KINKONG_AIRTABLE_API_KEY')
        )
        
        logger.info("Saving sentiment analysis to Airtable...")
        logger.debug(f"Sentiment data: {sentiment}")
        
        sentiment_table.insert(sentiment)
        logger.info("[SUCCESS] Market sentiment recorded successfully")
        
    except Exception as e:
        logger.error(f"Script failed: {e}", exc_info=True)
        raise

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
