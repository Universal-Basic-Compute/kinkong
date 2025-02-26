import os
import json
import logging
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pyairtable import Api, Base
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

# Setup logging
def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler()
        ]
    )
    return logging.getLogger(__name__)

logger = setup_logging()

class SignalPerformanceAnalyzer:
    def __init__(self):
        # Load environment variables
        load_dotenv()
        
        # Initialize Airtable connection
        self.api_key = os.environ.get('KINKONG_AIRTABLE_API_KEY')
        self.base_id = os.environ.get('KINKONG_AIRTABLE_BASE_ID')
        
        if not self.api_key or not self.base_id:
            raise ValueError("Missing Airtable credentials in environment variables")
        
        self.api = Api(self.api_key)
        self.base = Base(self.api, self.base_id)
        self.signals_table = self.base.table('SIGNALS')
        
        # Initialize metrics storage
        self.metrics = {}
        self.signals_df = None
        
        # Create output directory if it doesn't exist
        self.output_dir = Path('reports')
        self.output_dir.mkdir(exist_ok=True)

    def fetch_signals(self, days_back=30):
        """Fetch signals from Airtable and convert to DataFrame"""
        logger.info(f"Fetching signals from the last {days_back} days...")
        
        # Calculate date threshold
        cutoff_date = (datetime.now() - timedelta(days=days_back)).isoformat()
        
        # Fetch signals created after the cutoff date
        signals = self.signals_table.all(
            formula=f"createdAt >= '{cutoff_date}'"
        )
        
        logger.info(f"Retrieved {len(signals)} signals")
        
        if not signals:
            logger.warning("No signals found in the specified time period")
            return pd.DataFrame()
        
        # Convert to DataFrame
        records = []
        for signal in signals:
            record = signal['fields']
            record['id'] = signal['id']
            records.append(record)
        
        df = pd.DataFrame(records)
        
        # Convert date columns to datetime
        if 'createdAt' in df.columns:
            df['createdAt'] = pd.to_datetime(df['createdAt'])
        
        # Ensure numeric columns are properly typed
        numeric_columns = ['entryPrice', 'targetPrice', 'stopLoss', 'actualReturn']
        for col in numeric_columns:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        # Calculate expected return based on entry and target prices
        if all(col in df.columns for col in ['entryPrice', 'targetPrice', 'type']):
            df['expectedReturn'] = df.apply(
                lambda row: ((row['targetPrice'] - row['entryPrice']) / row['entryPrice'] * 100) 
                if row['type'] == 'BUY' 
                else ((row['entryPrice'] - row['targetPrice']) / row['entryPrice'] * 100),
                axis=1
            )
        
        # Add success flag
        if 'actualReturn' in df.columns:
            df['isSuccessful'] = df['actualReturn'] > 0
        
        self.signals_df = df
        return df

    def calculate_metrics(self):
        """Calculate all performance metrics"""
        if self.signals_df is None or self.signals_df.empty:
            logger.error("No signals data available. Run fetch_signals() first.")
            return {}
        
        df = self.signals_df
        metrics = {}
        
        # 1. Total number of signals
        metrics['total_signals'] = len(df)
        
        # 2. Signal type distribution (BUY/SELL)
        if 'type' in df.columns:
            type_counts = df['type'].value_counts()
            metrics['buy_signals'] = type_counts.get('BUY', 0)
            metrics['sell_signals'] = type_counts.get('SELL', 0)
            metrics['buy_percentage'] = (metrics['buy_signals'] / metrics['total_signals'] * 100) if metrics['total_signals'] > 0 else 0
            metrics['sell_percentage'] = (metrics['sell_signals'] / metrics['total_signals'] * 100) if metrics['total_signals'] > 0 else 0
        
        # 3. Confidence level distribution
        if 'confidence' in df.columns:
            confidence_counts = df['confidence'].value_counts()
            metrics['high_confidence'] = confidence_counts.get('HIGH', 0)
            metrics['medium_confidence'] = confidence_counts.get('MEDIUM', 0)
            metrics['low_confidence'] = confidence_counts.get('LOW', 0)
            
            metrics['high_confidence_percentage'] = (metrics['high_confidence'] / metrics['total_signals'] * 100) if metrics['total_signals'] > 0 else 0
            metrics['medium_confidence_percentage'] = (metrics['medium_confidence'] / metrics['total_signals'] * 100) if metrics['total_signals'] > 0 else 0
            metrics['low_confidence_percentage'] = (metrics['low_confidence'] / metrics['total_signals'] * 100) if metrics['total_signals'] > 0 else 0
        
        # 4. Timeframe distribution
        if 'timeframe' in df.columns:
            timeframe_counts = df['timeframe'].value_counts()
            metrics['scalp_signals'] = timeframe_counts.get('SCALP', 0)
            metrics['intraday_signals'] = timeframe_counts.get('INTRADAY', 0)
            metrics['swing_signals'] = timeframe_counts.get('SWING', 0)
            metrics['position_signals'] = timeframe_counts.get('POSITION', 0)
            
            metrics['scalp_percentage'] = (metrics['scalp_signals'] / metrics['total_signals'] * 100) if metrics['total_signals'] > 0 else 0
            metrics['intraday_percentage'] = (metrics['intraday_signals'] / metrics['total_signals'] * 100) if metrics['total_signals'] > 0 else 0
            metrics['swing_percentage'] = (metrics['swing_signals'] / metrics['total_signals'] * 100) if metrics['total_signals'] > 0 else 0
            metrics['position_percentage'] = (metrics['position_signals'] / metrics['total_signals'] * 100) if metrics['total_signals'] > 0 else 0
        
        # 5. Return metrics
        if 'expectedReturn' in df.columns:
            metrics['average_expected_return'] = df['expectedReturn'].mean()
            metrics['median_expected_return'] = df['expectedReturn'].median()
            metrics['max_expected_return'] = df['expectedReturn'].max()
            metrics['min_expected_return'] = df['expectedReturn'].min()
        
        if 'actualReturn' in df.columns:
            # Filter out None/NaN values
            actual_returns = df['actualReturn'].dropna()
            if not actual_returns.empty:
                metrics['signals_with_results'] = len(actual_returns)
                metrics['average_actual_return'] = actual_returns.mean()
                metrics['median_actual_return'] = actual_returns.median()
                metrics['max_actual_return'] = actual_returns.max()
                metrics['min_actual_return'] = actual_returns.min()
            else:
                metrics['signals_with_results'] = 0
        
        # 6. Success rate
        if 'isSuccessful' in df.columns:
            successful_signals = df['isSuccessful'].dropna()
            if not successful_signals.empty:
                metrics['success_rate'] = (successful_signals.sum() / len(successful_signals) * 100)
            else:
                metrics['success_rate'] = 0
        
        # 7. Performance by confidence level
        if all(col in df.columns for col in ['confidence', 'actualReturn']):
            confidence_performance = df.groupby('confidence')['actualReturn'].mean().to_dict()
            metrics['high_confidence_return'] = confidence_performance.get('HIGH', 0)
            metrics['medium_confidence_return'] = confidence_performance.get('MEDIUM', 0)
            metrics['low_confidence_return'] = confidence_performance.get('LOW', 0)
        
        # 8. Performance by timeframe
        if all(col in df.columns for col in ['timeframe', 'actualReturn']):
            timeframe_performance = df.groupby('timeframe')['actualReturn'].mean().to_dict()
            metrics['scalp_return'] = timeframe_performance.get('SCALP', 0)
            metrics['intraday_return'] = timeframe_performance.get('INTRADAY', 0)
            metrics['swing_return'] = timeframe_performance.get('SWING', 0)
            metrics['position_return'] = timeframe_performance.get('POSITION', 0)
        
        # 9. Performance by signal type
        if all(col in df.columns for col in ['type', 'actualReturn']):
            type_performance = df.groupby('type')['actualReturn'].mean().to_dict()
            metrics['buy_return'] = type_performance.get('BUY', 0)
            metrics['sell_return'] = type_performance.get('SELL', 0)
        
        # 10. Weekly performance
        if 'createdAt' in df.columns and 'actualReturn' in df.columns:
            df['week'] = df['createdAt'].dt.isocalendar().week
            weekly_performance = df.groupby('week')['actualReturn'].mean().to_dict()
            metrics['weekly_performance'] = weekly_performance
        
        self.metrics = metrics
        return metrics

    def generate_visualizations(self):
        """Generate visualizations for the calculated metrics"""
        if not self.metrics or self.signals_df is None or self.signals_df.empty:
            logger.error("No metrics or signals data available. Run calculate_metrics() first.")
            return
        
        df = self.signals_df
        metrics = self.metrics
        
        # Set the style
        sns.set(style="darkgrid")
        plt.rcParams.update({'font.size': 12})
        
        # 1. Signal Type Distribution (Pie Chart)
        if 'buy_signals' in metrics and 'sell_signals' in metrics:
            plt.figure(figsize=(10, 6))
            plt.pie(
                [metrics['buy_signals'], metrics['sell_signals']], 
                labels=['BUY', 'SELL'],
                autopct='%1.1f%%',
                colors=['#4CAF50', '#F44336'],
                startangle=90
            )
            plt.title('Signal Type Distribution')
            plt.tight_layout()
            plt.savefig(self.output_dir / 'signal_type_distribution.png')
            plt.close()
        
        # 2. Confidence Level Distribution (Bar Chart)
        if all(key in metrics for key in ['high_confidence', 'medium_confidence', 'low_confidence']):
            plt.figure(figsize=(10, 6))
            confidence_data = [
                metrics['high_confidence'],
                metrics['medium_confidence'],
                metrics['low_confidence']
            ]
            sns.barplot(
                x=['HIGH', 'MEDIUM', 'LOW'],
                y=confidence_data,
                palette=['#4CAF50', '#FFC107', '#F44336']
            )
            plt.title('Confidence Level Distribution')
            plt.xlabel('Confidence Level')
            plt.ylabel('Number of Signals')
            plt.tight_layout()
            plt.savefig(self.output_dir / 'confidence_distribution.png')
            plt.close()
        
        # 3. Timeframe Distribution (Bar Chart)
        if all(key in metrics for key in ['scalp_signals', 'intraday_signals', 'swing_signals', 'position_signals']):
            plt.figure(figsize=(10, 6))
            timeframe_data = [
                metrics['scalp_signals'],
                metrics['intraday_signals'],
                metrics['swing_signals'],
                metrics['position_signals']
            ]
            sns.barplot(
                x=['SCALP', 'INTRADAY', 'SWING', 'POSITION'],
                y=timeframe_data,
                palette='viridis'
            )
            plt.title('Timeframe Distribution')
            plt.xlabel('Timeframe')
            plt.ylabel('Number of Signals')
            plt.tight_layout()
            plt.savefig(self.output_dir / 'timeframe_distribution.png')
            plt.close()
        
        # 4. Expected vs Actual Return (Box Plot)
        if 'expectedReturn' in df.columns and 'actualReturn' in df.columns:
            plt.figure(figsize=(10, 6))
            returns_df = pd.DataFrame({
                'Expected Return': df['expectedReturn'].dropna(),
                'Actual Return': df['actualReturn'].dropna()
            })
            sns.boxplot(data=returns_df)
            plt.title('Expected vs Actual Return Distribution')
            plt.ylabel('Return (%)')
            plt.tight_layout()
            plt.savefig(self.output_dir / 'return_distribution.png')
            plt.close()
        
        # 5. Success Rate by Confidence (Bar Chart)
        if 'confidence' in df.columns and 'isSuccessful' in df.columns:
            plt.figure(figsize=(10, 6))
            success_by_confidence = df.groupby('confidence')['isSuccessful'].mean() * 100
            success_by_confidence.plot(kind='bar', color='#4CAF50')
            plt.title('Success Rate by Confidence Level')
            plt.xlabel('Confidence Level')
            plt.ylabel('Success Rate (%)')
            plt.tight_layout()
            plt.savefig(self.output_dir / 'success_by_confidence.png')
            plt.close()
        
        # 6. Success Rate by Timeframe (Bar Chart)
        if 'timeframe' in df.columns and 'isSuccessful' in df.columns:
            plt.figure(figsize=(10, 6))
            success_by_timeframe = df.groupby('timeframe')['isSuccessful'].mean() * 100
            success_by_timeframe.plot(kind='bar', color='#2196F3')
            plt.title('Success Rate by Timeframe')
            plt.xlabel('Timeframe')
            plt.ylabel('Success Rate (%)')
            plt.tight_layout()
            plt.savefig(self.output_dir / 'success_by_timeframe.png')
            plt.close()
        
        # 7. Average Return by Token (Top 10)
        if 'token' in df.columns and 'actualReturn' in df.columns:
            plt.figure(figsize=(12, 8))
            token_returns = df.groupby('token')['actualReturn'].agg(['mean', 'count'])
            token_returns = token_returns[token_returns['count'] >= 3]  # At least 3 signals
            token_returns = token_returns.sort_values('mean', ascending=False).head(10)
            
            sns.barplot(
                x=token_returns.index,
                y=token_returns['mean'],
                palette='viridis'
            )
            plt.title('Average Return by Token (Top 10)')
            plt.xlabel('Token')
            plt.ylabel('Average Return (%)')
            plt.xticks(rotation=45)
            plt.tight_layout()
            plt.savefig(self.output_dir / 'return_by_token.png')
            plt.close()
        
        # 8. Weekly Performance Trend
        if 'weekly_performance' in metrics:
            plt.figure(figsize=(12, 6))
            weeks = list(metrics['weekly_performance'].keys())
            returns = list(metrics['weekly_performance'].values())
            
            plt.plot(weeks, returns, marker='o', linestyle='-', color='#2196F3')
            plt.axhline(y=0, color='r', linestyle='--', alpha=0.3)
            plt.title('Weekly Performance Trend')
            plt.xlabel('Week Number')
            plt.ylabel('Average Return (%)')
            plt.grid(True, alpha=0.3)
            plt.tight_layout()
            plt.savefig(self.output_dir / 'weekly_performance.png')
            plt.close()
        
        logger.info(f"Visualizations saved to {self.output_dir}")

    def generate_report(self, days_back=30):
        """Generate a comprehensive performance report"""
        # Fetch data
        self.fetch_signals(days_back)
        
        # Calculate metrics
        metrics = self.calculate_metrics()
        
        if not metrics:
            logger.error("Failed to calculate metrics")
            return
        
        # Generate visualizations
        self.generate_visualizations()
        
        # Create report text
        report = f"""
# Signal Performance Report
## Period: Last {days_back} days
Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Summary Statistics
- Total Signals: {metrics.get('total_signals', 0)}
- Signals with Results: {metrics.get('signals_with_results', 0)}
- Overall Success Rate: {metrics.get('success_rate', 0):.2f}%
- Average Actual Return: {metrics.get('average_actual_return', 0):.2f}%
- Average Expected Return: {metrics.get('average_expected_return', 0):.2f}%

## Signal Type Distribution
- Buy Signals: {metrics.get('buy_signals', 0)} ({metrics.get('buy_percentage', 0):.2f}%)
- Sell Signals: {metrics.get('sell_signals', 0)} ({metrics.get('sell_percentage', 0):.2f}%)

## Confidence Level Distribution
- High Confidence: {metrics.get('high_confidence', 0)} ({metrics.get('high_confidence_percentage', 0):.2f}%)
- Medium Confidence: {metrics.get('medium_confidence', 0)} ({metrics.get('medium_confidence_percentage', 0):.2f}%)
- Low Confidence: {metrics.get('low_confidence', 0)} ({metrics.get('low_confidence_percentage', 0):.2f}%)

## Timeframe Distribution
- Scalp: {metrics.get('scalp_signals', 0)} ({metrics.get('scalp_percentage', 0):.2f}%)
- Intraday: {metrics.get('intraday_signals', 0)} ({metrics.get('intraday_percentage', 0):.2f}%)
- Swing: {metrics.get('swing_signals', 0)} ({metrics.get('swing_percentage', 0):.2f}%)
- Position: {metrics.get('position_signals', 0)} ({metrics.get('position_percentage', 0):.2f}%)

## Performance by Confidence Level
- High Confidence Return: {metrics.get('high_confidence_return', 0):.2f}%
- Medium Confidence Return: {metrics.get('medium_confidence_return', 0):.2f}%
- Low Confidence Return: {metrics.get('low_confidence_return', 0):.2f}%

## Performance by Timeframe
- Scalp Return: {metrics.get('scalp_return', 0):.2f}%
- Intraday Return: {metrics.get('intraday_return', 0):.2f}%
- Swing Return: {metrics.get('swing_return', 0):.2f}%
- Position Return: {metrics.get('position_return', 0):.2f}%

## Performance by Signal Type
- Buy Return: {metrics.get('buy_return', 0):.2f}%
- Sell Return: {metrics.get('sell_return', 0):.2f}%
"""
        
        # Save report to file
        report_path = self.output_dir / f'signal_performance_report_{datetime.now().strftime("%Y%m%d")}.md'
        with open(report_path, 'w') as f:
            f.write(report)
        
        # Save metrics as JSON
        metrics_path = self.output_dir / f'signal_metrics_{datetime.now().strftime("%Y%m%d")}.json'
        with open(metrics_path, 'w') as f:
            json.dump(metrics, f, indent=2)
        
        logger.info(f"Report saved to {report_path}")
        logger.info(f"Metrics saved to {metrics_path}")
        
        return {
            'report_path': str(report_path),
            'metrics_path': str(metrics_path),
            'metrics': metrics
        }

def main():
    try:
        logger.info("Starting signal performance analysis...")
        analyzer = SignalPerformanceAnalyzer()
        
        # Generate report for last 30 days
        result = analyzer.generate_report(days_back=30)
        
        if result:
            logger.info(f"Analysis complete. Report saved to {result['report_path']}")
            
            # Print key metrics to console
            metrics = result['metrics']
            print("\n=== KEY PERFORMANCE METRICS ===")
            print(f"Total Signals: {metrics.get('total_signals', 0)}")
            print(f"Success Rate: {metrics.get('success_rate', 0):.2f}%")
            print(f"Average Return: {metrics.get('average_actual_return', 0):.2f}%")
            print(f"Buy/Sell Ratio: {metrics.get('buy_percentage', 0):.1f}% / {metrics.get('sell_percentage', 0):.1f}%")
            print("===============================\n")
        else:
            logger.error("Failed to generate report")
    
    except Exception as e:
        logger.exception(f"Error in performance analysis: {e}")

if __name__ == "__main__":
    main()
