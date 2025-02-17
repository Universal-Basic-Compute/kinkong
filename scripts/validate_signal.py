from typing import Dict, Optional
from dataclasses import dataclass

@dataclass
class TradeCosts:
    lp_fee_min: float = 0.008  # 0.8%
    lp_fee_max: float = 0.02   # 2%
    gas_fee_min: float = 0.001  # 0.1%
    gas_fee_max: float = 0.002  # 0.2%
    slippage_min: float = 0.005 # 0.5%
    slippage_max: float = 0.01  # 1%

    def get_min_roundtrip_cost(self) -> float:
        return 2 * (self.lp_fee_min + self.gas_fee_min + self.slippage_min)

    def get_max_roundtrip_cost(self) -> float:
        return 2 * (self.lp_fee_max + self.gas_fee_max + self.slippage_max)

@dataclass
class TimeframeRequirements:
    timeframe: str
    min_target: float
    typical_target: tuple[float, float]
    stop_loss: float

TIMEFRAME_REQS = {
    'SCALP': TimeframeRequirements(
        timeframe='SCALP',
        min_target=0.08,      # Reduced from 0.15 (15%) to 8%
        typical_target=(0.10, 0.20),  # Reduced from (20-30%) to 10-20%
        stop_loss=0.10        # Keep same stop loss
    ),
    'INTRADAY': TimeframeRequirements(
        timeframe='INTRADAY',
        min_target=0.12,      # Reduced from 0.20 (20%) to 12%
        typical_target=(0.15, 0.30),  # Reduced from (25-40%) to 15-30%
        stop_loss=0.15        # Keep same stop loss
    ),
    'SWING': TimeframeRequirements(
        timeframe='SWING',
        min_target=0.20,      # Reduced from 0.30 (30%) to 20%
        typical_target=(0.25, 0.50),  # Reduced from (40-80%) to 25-50%
        stop_loss=0.20        # Keep same stop loss
    ),
    'POSITION': TimeframeRequirements(
        timeframe='POSITION',
        min_target=0.30,      # Reduced from 0.50 (50%) to 30%
        typical_target=(0.40, 0.80),  # Reduced from (100%+) to 40-80%
        stop_loss=0.25        # Keep same stop loss
    )
}

def validate_signal(
    timeframe: str,
    signal_data: Dict,
    token_info: Dict,
    market_data: Optional[Dict] = None
) -> Dict:
    """
    Validate if a signal should be executed based on costs and requirements.
    
    Returns:
    {
        'valid': bool,
        'reason': str,
        'expected_profit': float,
        'costs': float,
        'risk_reward': float
    }
    """
    try:
        # Map timeframe from chart (15m, 2h, 8h) to strategy timeframe
        timeframe_mapping = {
            '15m': 'SCALP',
            '2h': 'INTRADAY',
            '8h': 'SWING'
        }
        strategy_timeframe = timeframe_mapping.get(timeframe, 'INTRADAY')
        
        # Get requirements for this timeframe
        reqs = TIMEFRAME_REQS[strategy_timeframe]
        costs = TradeCosts()
        
        # Extract prices from signal
        entry_price = float(signal_data.get('entryPrice', 0))
        target_price = float(signal_data.get('targetPrice', 0))
        stop_loss_price = float(signal_data.get('stopLoss', 0))
        
        if not all([entry_price, target_price, stop_loss_price]):
            return {
                'valid': False,
                'reason': 'Missing price levels',
                'expected_profit': 0,
                'costs': 0,
                'risk_reward': 0
            }

        # Calculate potential profit and loss percentages
        if signal_data.get('signal') == 'BUY':
            potential_profit_pct = (target_price - entry_price) / entry_price
            potential_loss_pct = (entry_price - stop_loss_price) / entry_price
        else:  # SELL
            potential_profit_pct = (entry_price - target_price) / entry_price
            potential_loss_pct = (stop_loss_price - entry_price) / entry_price

        # Calculate round-trip costs
        max_costs = costs.get_max_roundtrip_cost()
        
        # Calculate expected profit after costs
        expected_profit = potential_profit_pct - max_costs
        
        # Calculate risk/reward ratio
        risk_reward = potential_profit_pct / potential_loss_pct if potential_loss_pct != 0 else 0

        # Validation checks
        validations = [
            (expected_profit >= reqs.min_target, 
             f"Expected profit ({expected_profit:.1%}) below minimum target ({reqs.min_target:.1%})"),
            
            (potential_loss_pct <= reqs.stop_loss,
             f"Stop loss ({potential_loss_pct:.1%}) exceeds maximum ({reqs.stop_loss:.1%})"),
            
            (risk_reward >= 1.5,
             f"Risk/Reward ratio ({risk_reward:.2f}) below minimum (1.5)"),
        ]

        # Add liquidity check if market data available
        if market_data and market_data.get('liquidity'):
            min_liquidity = 30000  # $30k minimum liquidity
            validations.append(
                (market_data['liquidity'] >= min_liquidity,
                 f"Insufficient liquidity (${market_data['liquidity']:,.2f} < ${min_liquidity:,.2f})")
            )

        # Check all validations
        for is_valid, reason in validations:
            if not is_valid:
                return {
                    'valid': False,
                    'reason': reason,
                    'expected_profit': expected_profit,
                    'costs': max_costs,
                    'risk_reward': risk_reward
                }

        return {
            'valid': True,
            'reason': 'Signal meets all requirements',
            'expected_profit': expected_profit,
            'costs': max_costs,
            'risk_reward': risk_reward
        }

    except Exception as e:
        return {
            'valid': False,
            'reason': f'Validation error: {str(e)}',
            'expected_profit': 0,
            'costs': 0,
            'risk_reward': 0
        }
