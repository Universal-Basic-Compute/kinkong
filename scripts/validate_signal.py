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
    Validate if a signal should be executed based on technical merits and market conditions.
    Status-independent validation.
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

        # Map timeframe to requirements
        timeframe_mapping = {
            '15m': 'SCALP',
            '2h': 'INTRADAY', 
            '8h': 'SWING'
        }
        strategy_timeframe = timeframe_mapping.get(timeframe, 'INTRADAY')
        reqs = TIMEFRAME_REQS[strategy_timeframe]

        # Different validation rules for BUY vs SELL
        if signal_data.get('signal') == 'BUY':
            validations = [
                (expected_profit >= reqs.min_target, 
                 f"Expected profit ({expected_profit:.1%}) below minimum target ({reqs.min_target:.1%})"),
                
                (potential_loss_pct <= reqs.stop_loss,
                 f"Stop loss ({potential_loss_pct:.1%}) exceeds maximum ({reqs.stop_loss:.1%})"),
                
                (risk_reward >= 1.5,
                 f"Risk/Reward ratio ({risk_reward:.2f}) below minimum (1.5)")
            ]
        else:  # SELL signal
            price_change_24h = market_data.get('price_change_24h', 0) if market_data else 0
            
            # If price is already dropping significantly, be more lenient
            if price_change_24h < -5:
                validations = [
                    (expected_profit >= reqs.min_target * 0.5,  # Half the usual minimum target
                     f"Expected profit ({expected_profit:.1%}) below emergency minimum target ({reqs.min_target * 0.5:.1%})"),
                    
                    (potential_loss_pct <= reqs.stop_loss * 1.5,
                     f"Stop loss ({potential_loss_pct:.1%}) exceeds emergency maximum ({reqs.stop_loss * 1.5:.1%})")
                ]
            else:
                validations = [
                    (expected_profit >= reqs.min_target,  # Must meet minimum target
                     f"Expected profit ({expected_profit:.1%}) below minimum target ({reqs.min_target:.1%})"),
                    
                    (potential_loss_pct <= reqs.stop_loss,
                     f"Stop loss ({potential_loss_pct:.1%}) exceeds maximum ({reqs.stop_loss:.1%})"),
                    
                    (risk_reward >= 1.5,
                     f"Risk/Reward ratio ({risk_reward:.2f}) below minimum (1.5)")
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


if __name__ == "__main__":
    import os
    from datetime import datetime, timezone
    from airtable import Airtable
    from dotenv import load_dotenv
    from analyze_charts import get_dexscreener_data, send_telegram_message
    
    # Debug: Print environment variables
    print("\n🔍 Debug Information")
    print("=" * 50)
    
    # Load environment variables
    load_dotenv()
    
    try:
        # Initialize Airtable
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        if not base_id or not api_key:
            print("❌ Error: Missing Airtable configuration")
            exit(1)
            
        # Get signals and tokens tables
        signals_table = Airtable(base_id, 'SIGNALS', api_key)
        tokens_table = Airtable(base_id, 'TOKENS', api_key)
        
        # Debug: Print available fields in TOKENS table
        print("\nChecking TOKENS table structure...")
        records = tokens_table.get_all(maxRecords=1)
        if records:
            print("Available fields in TOKENS table:", list(records[0]['fields'].keys()))
        else:
            print("No records found in TOKENS table")
        
        # Get signals that haven't expired
        signals = signals_table.get_all(
            formula="expiryDate>=TODAY()"  # Only check expiry date
        )
    except Exception as e:
        print(f"❌ Error: {e}")
        exit(1)
    
    print("\n🔍 Validating Signals")
    print("=" * 50)
    
    for signal in signals:
        fields = signal['fields']
        
        # Debug: Try queries with increasing complexity
        print(f"\nLooking up token: {fields['token']}")
        
        # First try without any filter
        print("\nTrying to get all records...")
        all_records = tokens_table.get_all()
        print(f"Found {len(all_records)} total records")
        
        if all_records:
            print("Sample record fields:", list(all_records[0]['fields'].keys()))
        
        # Then try with just the symbol filter
        symbol_filter = f"{{symbol}}='{fields['token']}'"  # Use symbol field name
        print(f"\nTrying filter: {symbol_filter}")
        token_records = tokens_table.get_all(
            formula=symbol_filter
        )
        
        if not token_records:
            print(f"No records found for token {fields['token']}")
            continue
            
        print(f"Found {len(token_records)} records with matching symbol")
            
        token_info = token_records[0]['fields']
        
        # Get market data
        market_data = get_dexscreener_data(token_info['mint'])
        if not market_data:
            print(f"\n⚠️ No market data available for {fields['token']}")
            continue
            
        print(f"\n📊 Signal Analysis for {fields['token']}")
        print(f"Signal ID: {signal['id']}")
        print(f"Type: {fields['type']}")
        print("\nPrice Levels:")
        print(f"Entry:     ${fields.get('entryPrice', 0):.4f}")
        print(f"Target:    ${fields.get('targetPrice', 0):.4f}")
        print(f"Stop Loss: ${fields.get('stopLoss', 0):.4f}")
        
        print("\nMarket Conditions:")
        print(f"Current Price: ${market_data['price']:.4f}")
        print(f"Liquidity:     ${market_data['liquidity']:,.2f}")
        print(f"24h Change:    {market_data['price_change_24h']:.1f}%")
        
        print("\nValidation Results:")
        print("-" * 40)
        
        # Track if signal passes validation on any timeframe
        passed_validation = False
        valid_timeframes = []
        
        # Test all timeframes
        for timeframe in ['15m', '2h', '8h']:
            print(f"\n⏰ {timeframe} Timeframe:")
            result = validate_signal(
                timeframe=timeframe,
                signal_data={
                    'signal': fields['type'],
                    'entryPrice': float(fields.get('entryPrice', 0)),
                    'targetPrice': float(fields.get('targetPrice', 0)),
                    'stopLoss': float(fields.get('stopLoss', 0))
                },
                token_info=token_info,
                market_data=market_data
            )
            
            print(f"Valid:           {'✅' if result['valid'] else '❌'}")
            print(f"Expected Profit: {result['expected_profit']:.1%}")
            print(f"Trading Costs:   {result['costs']:.1%}")
            print(f"Risk/Reward:     {result['risk_reward']:.2f}")
            print(f"Result:          {result['reason']}")
            
            if result['valid']:
                passed_validation = True
                valid_timeframes.append(timeframe)
        
        # If signal passed validation on any timeframe, create trade
        if passed_validation:
            try:
                # Create trade record
                trades_table = Airtable(base_id, 'TRADES', api_key)
                trade_data = {
                    'fields': {
                        'signalId': signal['id'],
                        'timestamp': datetime.now(timezone.utc).isoformat(),
                        'token': fields['token'],
                        'action': fields['type'],  # Changed from 'type' to 'action'
                        'timeframe': ','.join(valid_timeframes),
                        'price': float(fields['entryPrice']),  # Changed from entryPrice to price
                        'amount': 0,  # Will be set when trade executes
                        'status': 'PENDING'  # Initial trade status
                    }
                }
                
                # Add trade record
                trade_result = trades_table.insert(trade_data)
                print(f"\n✅ Created trade record: {trade_result['id']}")
                
                # Update signal status
                signals_table.update(signal['id'], {
                    'tradeId': trade_result['id'],
                    'lastUpdateTime': datetime.now(timezone.utc).isoformat()
                })
                
                # Send notification
                message = f"""🎯 New Trade Created

Token: ${fields['token']}
Type: {fields['type']}
Timeframes: {', '.join(valid_timeframes)}
Entry: ${float(fields['entryPrice']):.4f}
Target: ${float(fields['targetPrice']):.4f}
Stop: ${float(fields['stopLoss']):.4f}
Current Price: ${market_data['price']:.4f}

Signal ID: {signal['id']}
Trade ID: {trade_result['id']}"""

                send_telegram_message(message)
                
            except Exception as e:
                print(f"\n❌ Failed to create trade: {e}")
        else:
            print(f"\n⚠️ Signal {signal['id']} did not pass validation on any timeframe")
