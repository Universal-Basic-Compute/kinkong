CHART_CONFIGS = [
    {
        'timeframe': '1D',
        'strategy_timeframe': 'POSITION',
        'duration_hours': 720,  # 30 days
        'candles_target': 60,  # Want 60 daily candles
        'title': '{token}/USD Position Analysis (30D)',
        'subtitle': 'Daily candles - Position Trading View',
        'filename': '{token}_30d_position.png'
    },
    {
        'timeframe': '4H',
        'strategy_timeframe': 'SWING',
        'duration_hours': 336,  # 14 days (doubled from 7)
        'candles_target': 60,  # Want 60 4h candles
        'title': '{token}/USD Swing Analysis (7D)',
        'subtitle': '4-hour candles - Swing Trading View',
        'filename': '{token}_7d_swing.png'
    },
    {
        'timeframe': '1H',
        'strategy_timeframe': 'INTRADAY', 
        'duration_hours': 48,  # 48 hours (doubled from 24)
        'candles_target': 60,  # Want 60 1h candles
        'title': '{token}/USD Intraday Analysis (24H)',
        'subtitle': '1-hour candles - Intraday Trading View',
        'filename': '{token}_24h_intraday.png'
    },
    {
        'timeframe': '15m',
        'strategy_timeframe': 'SCALP',
        'duration_hours': 12,  # 12 hours (doubled from 6)
        'candles_target': 60,  # Want 60 15m candles
        'title': '{token}/USD Scalp Analysis (6H)',
        'subtitle': '15-minute candles - Scalp Trading View',
        'filename': '{token}_6h_scalp.png'
    }
]
