CHART_CONFIGS = [
    {
        'timeframe': '1D',
        'strategy_timeframe': 'POSITION',
        'duration_hours': 720,  # 30 days
        'candles_target': 60,  # 30 days = 30 daily candles
        'title': '{token}/USD Position Analysis (30D)',
        'subtitle': 'Daily candles - Position Trading View',
        'filename': '{token}_30d_position.png'  # Matches POSITION timeframe
    },
    {
        'timeframe': '4H',
        'strategy_timeframe': 'SWING',
        'duration_hours': 168,  # 7 days
        'candles_target': 60,  # 7 days = 42 4-hour candles
        'title': '{token}/USD Swing Analysis (7D)',
        'subtitle': '4-hour candles - Swing Trading View',
        'filename': '{token}_7d_swing.png'  # Matches SWING timeframe
    },
    {
        'timeframe': '1H',
        'strategy_timeframe': 'INTRADAY',
        'duration_hours': 24,
        'candles_target': 60,  # 24 hours = 24 1-hour candles
        'title': '{token}/USD Intraday Analysis (24H)',
        'subtitle': '1-hour candles - Intraday Trading View',
        'filename': '{token}_24h_intraday.png'  # Matches INTRADAY timeframe
    },
    {
        'timeframe': '15m',  # Chart interval
        'strategy_timeframe': 'SCALP',  # Strategy timeframe
        'duration_hours': 6,
        'candles_target': 60,  # 6 hours = 24 15-min candles
        'title': '{token}/USD Scalp Analysis (6H)',
        'subtitle': '15-minute candles - Scalp Trading View',
        'filename': '{token}_6h_scalp.png'  # Matches SCALP timeframe
    }
]
