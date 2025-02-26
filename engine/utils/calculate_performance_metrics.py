import os
import json
import logging
import pandas as pd
import numpy as np
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

def convert_to_serializable(obj):
    """Convert NumPy types to Python standard types for JSON serialization"""
    if isinstance(obj, (np.integer, np.int64, np.uint32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64)):
        if np.isnan(obj):
            return None  # Convert NaN to None (null in JSON)
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        # Convert both keys and values
        return {
            str(k) if isinstance(k, (np.integer, np.int64, np.uint32)) else k: 
            convert_to_serializable(v) 
            for k, v in obj.items()
        }
    elif isinstance(obj, list):
        return [convert_to_serializable(i) for i in obj]
    else:
        return obj

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
        
        # Create output directory for reports
        self.output_dir = Path('public/performances')
        self.output_dir.mkdir(exist_ok=True, parents=True)

    def fetch_signals(self, days_back=30):
        """Fetch signals from Airtable and convert to DataFrame"""
        logger.info(f"Fetching signals from the last {days_back} days...")
        
        # Calculate date threshold
        cutoff_date = (datetime.now() - timedelta(days=days_back)).isoformat()
        
        # Fetch signals created after the cutoff date
        # Only include failed BUY signals with HIGH confidence and non-null/non-zero actualReturn values
        signals = self.signals_table.all(
            formula=f"AND(createdAt >= '{cutoff_date}', NOT(actualReturn = 0), NOT(actualReturn = ''), type='BUY', confidence='HIGH', actualReturn < 0)"
        )
        
        logger.info(f"Retrieved {len(signals)} completed BUY signals")
        
        if not signals:
            logger.warning("No completed signals found in the specified time period")
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
        
        # 2. Confidence level distribution
        if 'confidence' in df.columns:
            confidence_counts = df['confidence'].value_counts()
            metrics['high_confidence'] = confidence_counts.get('HIGH', 0)
            metrics['medium_confidence'] = confidence_counts.get('MEDIUM', 0)
            
            metrics['high_confidence_percentage'] = (metrics['high_confidence'] / metrics['total_signals'] * 100) if metrics['total_signals'] > 0 else 0
            metrics['medium_confidence_percentage'] = (metrics['medium_confidence'] / metrics['total_signals'] * 100) if metrics['total_signals'] > 0 else 0
        
        # 3. Timeframe distribution
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
        
        # 4. Return metrics
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
                
                # Calculate standard deviation of returns
                metrics['return_std_dev'] = actual_returns.std()
                
                # Calculate risk-adjusted return (Sharpe ratio with 0% risk-free rate)
                metrics['sharpe_ratio'] = actual_returns.mean() / actual_returns.std() if actual_returns.std() > 0 else 0
                
                # Calculate win rate
                metrics['win_rate'] = (actual_returns > 0).mean() * 100
                
                # Calculate average win and average loss
                wins = actual_returns[actual_returns > 0]
                losses = actual_returns[actual_returns <= 0]
                
                metrics['average_win'] = wins.mean() if not wins.empty else 0
                metrics['average_loss'] = losses.mean() if not losses.empty else 0
                
                # Calculate win/loss ratio
                metrics['win_loss_ratio'] = abs(metrics['average_win'] / metrics['average_loss']) if metrics['average_loss'] != 0 else float('inf')
                
                # Calculate profit factor
                total_wins = wins.sum() if not wins.empty else 0
                total_losses = abs(losses.sum()) if not losses.empty else 0
                metrics['profit_factor'] = total_wins / total_losses if total_losses > 0 else float('inf')
                
                # Calculate maximum drawdown
                cumulative_returns = (1 + actual_returns / 100).cumprod()
                running_max = cumulative_returns.cummax()
                drawdown = (cumulative_returns / running_max - 1) * 100
                metrics['max_drawdown'] = abs(drawdown.min())
                
                # Calculate recovery factor
                metrics['recovery_factor'] = actual_returns.mean() / metrics['max_drawdown'] if metrics['max_drawdown'] > 0 else float('inf')
            else:
                metrics['signals_with_results'] = 0
        
        # 5. Success rate
        if 'isSuccessful' in df.columns:
            successful_signals = df['isSuccessful'].dropna()
            if not successful_signals.empty:
                metrics['success_rate'] = (successful_signals.sum() / len(successful_signals) * 100)
            else:
                metrics['success_rate'] = 0
        
        # Performance by confidence level analysis removed as we're only focusing on failed HIGH confidence signals
        
        # 7. Performance by timeframe
        if all(col in df.columns for col in ['timeframe', 'actualReturn']):
            timeframe_performance = df.groupby('timeframe')['actualReturn'].mean().to_dict()
            metrics['scalp_return'] = timeframe_performance.get('SCALP', 0)
            metrics['intraday_return'] = timeframe_performance.get('INTRADAY', 0)
            metrics['swing_return'] = timeframe_performance.get('SWING', 0)
            metrics['position_return'] = timeframe_performance.get('POSITION', 0)
            
            # Calculate success rate by timeframe
            if 'isSuccessful' in df.columns:
                timeframe_success = df.groupby('timeframe')['isSuccessful'].mean().to_dict()
                metrics['scalp_success_rate'] = timeframe_success.get('SCALP', 0) * 100
                metrics['intraday_success_rate'] = timeframe_success.get('INTRADAY', 0) * 100
                metrics['swing_success_rate'] = timeframe_success.get('SWING', 0) * 100
                metrics['position_success_rate'] = timeframe_success.get('POSITION', 0) * 100
        
        # 8. Performance by token (top tokens)
        if all(col in df.columns for col in ['token', 'actualReturn']):
            token_performance = df.groupby('token').agg({
                'actualReturn': ['mean', 'count'],
                'isSuccessful': ['mean'] if 'isSuccessful' in df.columns else []
            })
            
            # Flatten the multi-index columns
            token_performance.columns = ['_'.join(col).strip('_') for col in token_performance.columns.values]
            
            # Filter tokens with at least 3 signals
            token_performance = token_performance[token_performance['actualReturn_count'] >= 3]
            
            # Sort by mean return
            top_tokens = token_performance.sort_values('actualReturn_mean', ascending=False).head(10)
            
            # Store top token performance
            metrics['top_tokens'] = {
                token: {
                    'return': row['actualReturn_mean'],
                    'count': row['actualReturn_count'],
                    'success_rate': row['isSuccessful_mean'] * 100 if 'isSuccessful_mean' in row else 0
                }
                for token, row in top_tokens.iterrows()
            }
        
        # 9. Weekly performance
        if 'createdAt' in df.columns and 'actualReturn' in df.columns:
            df['week'] = df['createdAt'].dt.isocalendar().week
            weekly_performance = df.groupby('week')['actualReturn'].mean().to_dict()
            # Convert keys to strings to avoid NumPy type issues
            metrics['weekly_performance'] = {str(k): v for k, v in weekly_performance.items()}
            
            # Calculate weekly success rates
            if 'isSuccessful' in df.columns:
                weekly_success = df.groupby('week')['isSuccessful'].mean().to_dict()
                metrics['weekly_success_rates'] = {str(k): v * 100 for k, v in weekly_success.items()}
        
        # 10. Monthly performance
        if 'createdAt' in df.columns and 'actualReturn' in df.columns:
            df['month'] = df['createdAt'].dt.month
            monthly_performance = df.groupby('month')['actualReturn'].mean().to_dict()
            metrics['monthly_performance'] = {str(k): v for k, v in monthly_performance.items()}
            
            # Calculate monthly success rates
            if 'isSuccessful' in df.columns:
                monthly_success = df.groupby('month')['isSuccessful'].mean().to_dict()
                metrics['monthly_success_rates'] = {str(k): v * 100 for k, v in monthly_success.items()}
        
        # 11. Consistency metrics
        if 'actualReturn' in df.columns:
            actual_returns = df['actualReturn'].dropna()
            if len(actual_returns) > 1:
                # Calculate percentage of positive days
                metrics['positive_return_percentage'] = (actual_returns > 0).mean() * 100
                
                # Calculate consecutive wins/losses
                is_win = (actual_returns > 0).astype(int)
                win_groups = (is_win != is_win.shift()).cumsum()
                consecutive_wins = is_win.groupby(win_groups).sum()
                
                metrics['max_consecutive_wins'] = consecutive_wins[consecutive_wins > 0].max() if any(consecutive_wins > 0) else 0
                metrics['max_consecutive_losses'] = (consecutive_wins[consecutive_wins == 0].count()).max() if any(consecutive_wins == 0) else 0
        
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
        
        # Create public/performances directory if it doesn't exist
        performances_dir = Path('public/performances')
        performances_dir.mkdir(exist_ok=True, parents=True)
        
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
            # Save only to performances directory
            plt.savefig(performances_dir / 'signal_type_distribution.png')
            plt.close()
        
        # 2. Confidence Level Distribution (Bar Chart)
        if all(key in metrics for key in ['high_confidence', 'medium_confidence', 'low_confidence']):
            plt.figure(figsize=(10, 6))
            confidence_data = [
                metrics['high_confidence'],
                metrics['medium_confidence'],
                metrics['low_confidence']
            ]
            confidence_labels = ['HIGH', 'MEDIUM', 'LOW']
            sns.barplot(
                x=confidence_labels,
                y=confidence_data,
                hue=confidence_labels,
                palette=['#4CAF50', '#FFC107', '#F44336'],
                legend=False
            )
            plt.title('Confidence Level Distribution')
            plt.xlabel('Confidence Level')
            plt.ylabel('Number of Signals')
            plt.tight_layout()
            # Save only to performances directory
            plt.savefig(performances_dir / 'confidence_distribution.png')
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
            timeframe_labels = ['SCALP', 'INTRADAY', 'SWING', 'POSITION']
            sns.barplot(
                x=timeframe_labels,
                y=timeframe_data,
                hue=timeframe_labels,
                palette='viridis',
                legend=False
            )
            plt.title('Timeframe Distribution')
            plt.xlabel('Timeframe')
            plt.ylabel('Number of Signals')
            plt.tight_layout()
            # Save only to performances directory
            plt.savefig(performances_dir / 'timeframe_distribution.png')
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
            # Save only to performances directory
            plt.savefig(performances_dir / 'return_distribution.png')
            plt.close()
        
        # Success Rate by Confidence visualization removed as we're only focusing on failed HIGH confidence signals
        
        # 6. Success Rate by Timeframe (Bar Chart)
        if 'timeframe' in df.columns and 'isSuccessful' in df.columns:
            plt.figure(figsize=(10, 6))
            success_by_timeframe = df.groupby('timeframe')['isSuccessful'].mean() * 100
            success_by_timeframe.plot(kind='bar', color='#2196F3')
            plt.title('Success Rate by Timeframe')
            plt.xlabel('Timeframe')
            plt.ylabel('Success Rate (%)')
            plt.tight_layout()
            # Save only to performances directory
            plt.savefig(performances_dir / 'success_by_timeframe.png')
            plt.close()
        
        # 7. Average Return by Token (Top 10)
        if 'token' in df.columns and 'actualReturn' in df.columns:
            plt.figure(figsize=(12, 8))
            token_returns = df.groupby('token')['actualReturn'].agg(['mean', 'count'])
            token_returns = token_returns[token_returns['count'] >= 3]  # At least 3 signals
            token_returns = token_returns.sort_values('mean', ascending=False).head(10)
            
            tokens = token_returns.index.tolist()
            returns = token_returns['mean'].tolist()
            
            sns.barplot(
                x=tokens,
                y=returns,
                hue=tokens,
                palette='viridis',
                legend=False
            )
            plt.title('Average Return by Token (Top 10)')
            plt.xlabel('Token')
            plt.ylabel('Average Return (%)')
            plt.xticks(rotation=45)
            plt.tight_layout()
            # Save only to performances directory
            plt.savefig(performances_dir / 'return_by_token.png')
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
            # Save only to performances directory
            plt.savefig(performances_dir / 'weekly_performance.png')
            plt.close()
        
        # 9. Risk-Return Metrics
        plt.figure(figsize=(10, 6))
        risk_metrics = [
            metrics.get('sharpe_ratio', 0),
            metrics.get('win_loss_ratio', 0),
            metrics.get('profit_factor', 0),
            metrics.get('recovery_factor', 0)
        ]
        risk_labels = ['Sharpe Ratio', 'Win/Loss Ratio', 'Profit Factor', 'Recovery Factor']
        
        # Cap very high values for better visualization
        risk_metrics = [min(x, 5) if x > 5 else x for x in risk_metrics]
        
        bars = plt.bar(risk_labels, risk_metrics, color='#4CAF50')
        plt.title('Risk-Return Metrics')
        plt.ylabel('Value')
        plt.grid(axis='y', linestyle='--', alpha=0.3)
        
        # Add value labels on top of bars
        for bar in bars:
            height = bar.get_height()
            plt.text(bar.get_x() + bar.get_width()/2., height + 0.1,
                    f'{height:.2f}',
                    ha='center', va='bottom', color='white')
        
        plt.tight_layout()
        # Save only to performances directory
        plt.savefig(performances_dir / 'risk_return_metrics.png')
        plt.close()
        
        # 10. Consistency Metrics
        plt.figure(figsize=(10, 6))
        consistency_metrics = [
            metrics.get('positive_return_percentage', 0),
            metrics.get('max_consecutive_wins', 0),
            metrics.get('max_consecutive_losses', 0),
            metrics.get('average_win', 0),
            abs(metrics.get('average_loss', 0))
        ]
        consistency_labels = [
            'Positive Returns %', 
            'Max Consecutive Wins',
            'Max Consecutive Losses',
            'Avg Win %',
            'Avg Loss %'
        ]
        
        colors = ['#4CAF50', '#2196F3', '#F44336', '#4CAF50', '#F44336']
        bars = plt.bar(consistency_labels, consistency_metrics, color=colors)
        plt.title('Consistency Metrics')
        plt.ylabel('Value')
        plt.grid(axis='y', linestyle='--', alpha=0.3)
        plt.xticks(rotation=45)
        
        # Add value labels on top of bars
        for bar in bars:
            height = bar.get_height()
            plt.text(bar.get_x() + bar.get_width()/2., height + 0.1,
                    f'{height:.2f}',
                    ha='center', va='bottom', color='white')
        
        plt.tight_layout()
        # Save only to performances directory
        plt.savefig(performances_dir / 'consistency_metrics.png')
        plt.close()
        
        logger.info(f"Visualizations saved to {performances_dir}")

    def save_to_airtable(self, metrics):
        """Save performance metrics to Airtable PERFORMANCES table"""
        try:
            logger.info("Saving performance metrics to Airtable...")
            
            # Initialize the PERFORMANCES table
            performances_table = self.base.table('PERFORMANCES')
            
            # Convert NumPy types to standard Python types
            serializable_metrics = convert_to_serializable(metrics)
            
            # Replace NaN values with null (None) for JSON compatibility
            def replace_nan_with_null(obj):
                if isinstance(obj, float) and np.isnan(obj):
                    return None
                elif isinstance(obj, dict):
                    return {k: replace_nan_with_null(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [replace_nan_with_null(i) for i in obj]
                else:
                    return obj
            
            serializable_metrics = replace_nan_with_null(serializable_metrics)
            
            # Create the record with just the essential fields
            record = {
                'type': 'signals',
                'metrics': json.dumps(serializable_metrics),  # Store all metrics as a JSON string
                'createdAt': datetime.now().isoformat()
            }
            
            # Create the record in Airtable
            result = performances_table.create(record)
            
            logger.info(f"✅ Performance metrics saved to Airtable with ID: {result['id']}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Error saving performance metrics to Airtable: {e}")
            return None
            
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
        
        # Save metrics to Airtable
        self.save_to_airtable(metrics)
        
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
- Median Actual Return: {metrics.get('median_actual_return', 0):.2f}%
- Win/Loss Ratio: {metrics.get('win_loss_ratio', 0):.2f}
- Profit Factor: {metrics.get('profit_factor', 0):.2f}
- Sharpe Ratio: {metrics.get('sharpe_ratio', 0):.2f}
- Maximum Drawdown: {metrics.get('max_drawdown', 0):.2f}%
- Recovery Factor: {metrics.get('recovery_factor', 0):.2f}

## Confidence Level Distribution
- High Confidence: {metrics.get('high_confidence', 0)} ({metrics.get('high_confidence_percentage', 0):.2f}%)
- Medium Confidence: {metrics.get('medium_confidence', 0)} ({metrics.get('medium_confidence_percentage', 0):.2f}%)

## Timeframe Distribution
- Scalp: {metrics.get('scalp_signals', 0)} ({metrics.get('scalp_percentage', 0):.2f}%)
- Intraday: {metrics.get('intraday_signals', 0)} ({metrics.get('intraday_percentage', 0):.2f}%)
- Swing: {metrics.get('swing_signals', 0)} ({metrics.get('swing_percentage', 0):.2f}%)
- Position: {metrics.get('position_signals', 0)} ({metrics.get('position_percentage', 0):.2f}%)


## Performance by Timeframe
- Scalp Return: {metrics.get('scalp_return', 0):.2f}% (Success Rate: {metrics.get('scalp_success_rate', 0):.2f}%)
- Intraday Return: {metrics.get('intraday_return', 0):.2f}% (Success Rate: {metrics.get('intraday_success_rate', 0):.2f}%)
- Swing Return: {metrics.get('swing_return', 0):.2f}% (Success Rate: {metrics.get('swing_success_rate', 0):.2f}%)
- Position Return: {metrics.get('position_return', 0):.2f}% (Success Rate: {metrics.get('position_success_rate', 0):.2f}%)

## Consistency Metrics
- Positive Return Percentage: {metrics.get('positive_return_percentage', 0):.2f}%
- Maximum Consecutive Wins: {metrics.get('max_consecutive_wins', 0)}
- Maximum Consecutive Losses: {metrics.get('max_consecutive_losses', 0)}
- Average Win: {metrics.get('average_win', 0):.2f}%
- Average Loss: {metrics.get('average_loss', 0):.2f}%
"""
        
        # Add top tokens section if available
        if 'top_tokens' in metrics and metrics['top_tokens']:
            report += "\n## Top Performing Tokens (min. 3 signals)\n"
            for token, data in metrics['top_tokens'].items():
                report += f"- {token}: {data['return']:.2f}% (Success Rate: {data['success_rate']:.2f}%, Signals: {data['count']})\n"
        
        # Save report to file
        report_path = self.output_dir / f'signal_performance_report_{datetime.now().strftime("%Y%m%d")}.md'
        with open(report_path, 'w') as f:
            f.write(report)
        
        # Save metrics as JSON
        metrics_path = self.output_dir / f'signal_metrics_{datetime.now().strftime("%Y%m%d")}.json'
        with open(metrics_path, 'w') as f:
            json.dump(convert_to_serializable(metrics), f, indent=2)
        
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
            logger.info(f"Performance metrics saved to Airtable")
            
            # Print key metrics to console
            metrics = result['metrics']
            print("\n=== KEY PERFORMANCE METRICS ===")
            print(f"Total Signals: {metrics.get('total_signals', 0)}")
            print(f"Success Rate: {metrics.get('success_rate', 0):.2f}%")
            print(f"Average Return: {metrics.get('average_actual_return', 0):.2f}%")
            print(f"Win/Loss Ratio: {metrics.get('win_loss_ratio', 0):.2f}")
            print(f"Profit Factor: {metrics.get('profit_factor', 0):.2f}")
            print(f"Sharpe Ratio: {metrics.get('sharpe_ratio', 0):.2f}")
            print(f"Max Drawdown: {metrics.get('max_drawdown', 0):.2f}%")
            print("===============================\n")
            
            # Print top tokens if available
            if 'top_tokens' in metrics and metrics['top_tokens']:
                print("=== TOP PERFORMING TOKENS ===")
                for token, data in list(metrics['top_tokens'].items())[:5]:  # Show top 5
                    print(f"{token}: {data['return']:.2f}% (Success: {data['success_rate']:.1f}%)")
                print("===============================\n")
        else:
            logger.error("Failed to generate report")
    
    except Exception as e:
        logger.exception(f"Error in performance analysis: {e}")

if __name__ == "__main__":
    main()
