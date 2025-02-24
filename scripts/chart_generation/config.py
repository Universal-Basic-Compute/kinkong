CHART_CONFIGS = [
    {
        'timeframe': '15m',  # Chart interval
        'strategy_timeframe': 'SCALP',  # Strategy timeframe
        'duration_hours': 6,
        'title': '{token}/USD Scalp Analysis (6H)',
        'subtitle': '15-minute candles - Scalp Trading View',
        'filename': '{token}_6h_scalp.png'
    },
    {
        'timeframe': '1H',
        'strategy_timeframe': 'INTRADAY',
        'duration_hours': 24,
        'title': '{token}/USD Intraday Analysis (24H)',
        'subtitle': '1-hour candles - Intraday Trading View',
        'filename': '{token}_24h_intraday.png'
    },
    {
        'timeframe': '4H',
        'strategy_timeframe': 'SWING',
        'duration_hours': 168,  # 7 days
        'title': '{token}/USD Swing Analysis (7D)',
        'subtitle': '4-hour candles - Swing Trading View',
        'filename': '{token}_7d_swing.png'
    },
    {
        'timeframe': '1D',
        'strategy_timeframe': 'POSITION',
        'duration_hours': 720,  # 30 days
        'title': '{token}/USD Position Analysis (30D)',
        'subtitle': 'Daily candles - Position Trading View',
        'filename': '{token}_30d_position.png'
    }
]
