import sys
from pathlib import Path
import os
from datetime import datetime
import json

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.absolute())
if project_root not in sys.path:
    sys.path.append(project_root)

from backend.src.airtable.tables import getTable
from analyze_x_sentiment import analyze_x_sentiment

def test_x_sentiment():
    try:
        # Sample X.com content with different scenarios
        test_content = """
Recent X.com Posts:

@solana: Introducing Solana Breakpoint 2024! Join us in Amsterdam this November for the biggest Solana conference of the year. Early bird tickets available now.

@JupiterExchange: $UBC volume is going crazy! 24h stats:
• Volume: $2.5M (+156%)
• TVL: $890K
• Holders: 2,450 (+12%)
Incredible growth in the AI token sector! 🚀

@phantom: New token alert! $COMPUTE just launched on @JupiterExchange:
• Initial price: $0.85
• Launch volume: $1.2M
• Strong backing from @MonkeVentures
Looking solid! 📈

@RealCryptoWhale: $UBC chart looking super bearish right now. Multiple indicators showing overbought conditions. Taking profits and waiting for better entry.

@AISolanaTrader: Market analysis for AI tokens:
$UBC: Strong uptrend, holding support
$COMPUTE: Breaking out, volume confirming
$AGENT: Consolidating, accumulation phase
Overall sector sentiment: BULLISH 🎯

@SolanaNews: Breaking: Major partnership announcement between @UBC_Protocol and @Anthropic_AI!
• AI model integration
• Shared compute resources
• Token utility expansion
This is huge for the AI ecosystem! 🤖

@MarketMaker123: Seeing massive sell walls on $UBC and $COMPUTE.
Whales distributing? 🐋
Be careful here, might see a pullback soon.

@TechAnalyst: $UBC Technical Analysis:
• RSI: 75 (overbought)
• MACD: Bearish crossover
• Volume: Declining
Short term caution advised, but long term still bullish on AI narrative.

@AIResearcher: The future of AI on Solana:
1. Decentralized compute networks
2. Token-gated AI models
3. On-chain inference
$UBC and $COMPUTE leading the way!
"""

        print('\n🚀 Testing X Sentiment Analysis')
        print(f'Time: {datetime.now().isoformat()}')
        print('\n📝 Test Content Sample:')
        print(test_content[:500] + '...\n')

        # Run analysis
        print('🔄 Running sentiment analysis...')
        result = analyze_x_sentiment(test_content)

        if result:
            print('\n✅ Analysis completed successfully!')
            print('\n📊 Results:')
            print(json.dumps(result, indent=2))

            # Validate result structure
            expected_keys = ['tokens', 'domains', 'ecosystem']
            missing_keys = [key for key in expected_keys if key not in result]
            if missing_keys:
                print(f'\n⚠️ Warning: Missing expected keys: {missing_keys}')

            # Print key metrics
            if result.get('ecosystem'):
                print('\n📈 Key Metrics:')
                print(f"Overall Sentiment: {result['ecosystem']['sentiment']}")
                print(f"Confidence: {result['ecosystem']['confidence']}%")
                
            if result.get('tokens'):
                print(f"\n💰 Analyzed Tokens: {len(result['tokens'])}")
                for token in result['tokens']:
                    print(f"- {token['symbol']}: {token['sentiment']} ({token['confidence']}% confidence)")

            # Save result to file for reference
            output_file = Path(project_root) / 'test_results' / 'x_sentiment_test.json'
            output_file.parent.mkdir(exist_ok=True)
            with open(output_file, 'w') as f:
                json.dump(result, f, indent=2)
            print(f'\n💾 Results saved to: {output_file}')

        else:
            print('\n❌ Analysis failed or returned no results')

    except Exception as e:
        print(f'\n❌ Error: {str(e)}')
        print('Type:', type(e).__name__)
        if hasattr(e, '__dict__'):
            print('Error attributes:', e.__dict__)

if __name__ == '__main__':
    test_x_sentiment()
