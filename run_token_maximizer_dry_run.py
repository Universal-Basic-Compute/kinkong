import os
import sys
import asyncio
import logging
from dotenv import load_dotenv

# Configure logging
def setup_logging():
    logger = logging.getLogger(__name__)
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    return logger

# Set Windows event loop policy
if os.name == 'nt':  # Windows
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

async def main():
    # Load environment variables
    load_dotenv()
    
    # Setup logging
    logger = setup_logging()
    logger.info("Starting Token Maximizer dry run...")
    
    # Import the strategy
    from engine.token_maximizer_strategy import TokenMaximizerStrategy
    
    # Initialize the strategy
    strategy = TokenMaximizerStrategy()
    
    # Optional: Set token scores manually to override Claude AI
    # Uncomment the next line to set scores manually
    # strategy.set_token_scores(ubc_score=5, compute_score=-3)
    
    # Run the strategy in dry run mode
    success = await strategy.run_daily_update(dry_run=True)
    
    if success:
        logger.info("Token Maximizer dry run completed successfully")
    else:
        logger.error("Token Maximizer dry run failed")

if __name__ == "__main__":
    asyncio.run(main())
