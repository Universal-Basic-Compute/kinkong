from typing import Dict, Optional

def validate_signal(
    timeframe: str,
    signal_data: Dict,
    token_info: Dict,
    market_data: Optional[Dict] = None
) -> bool:
    """Basic signal validation"""
    try:
        # Basic validation
        if not all(k in signal_data for k in ['signal', 'confidence', 'entryPrice', 'targetPrice', 'stopLoss']):
            return False

        # Validate confidence - only accept HIGH
        confidence = signal_data.get('confidence', 'LOW')
        if confidence != 'HIGH':
            return False

        return True

    except Exception as e:
        print(f"Signal validation error: {e}")
        return False
from typing import Dict, Optional

def validate_signal(
    timeframe: str,
    signal_data: Dict,
    token_info: Dict,
    market_data: Optional[Dict] = None
) -> bool:
    """Basic signal validation"""
    try:
        # Basic validation
        if not all(k in signal_data for k in ['signal', 'confidence', 'entryPrice', 'targetPrice', 'stopLoss']):
            return False

        # Validate confidence
        confidence = float(signal_data.get('confidence', 0))
        if confidence < 60:
            return False

        return True

    except Exception as e:
        print(f"Signal validation error: {e}")
        return False
